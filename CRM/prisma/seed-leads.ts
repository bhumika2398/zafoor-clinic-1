// Adds 30 sample "leads" — prospective patients captured from marketing
// channels, not yet confirmed at the front desk — with full contact/
// demographic data, a source tag, a follow-up task, and an intake note.
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const firstNames = ["Aisha","Fatima","Ayesha","Zainab","Meera","Kavya","Divya","Sneha","Priya","Anjali","Ravi","Arjun","Karthik","Suresh","Imran","Faisal","Yusuf","Rahul","Vikram","Naveen","Sana","Nida","Reshma","Pooja","Lakshmi","Deepa","Farhan","Salman","Manoj","Ganesh"]
const lastNames = ["Khan","Sharma","Iyer","Reddy","Nair","Rao","Patel","Ahmed","Fernandes","Menon"]
const cities = [["Bengaluru","Karnataka","560001"],["Chennai","Tamil Nadu","600001"],["Hyderabad","Telangana","500001"],["Kochi","Kerala","682001"],["Mysuru","Karnataka","570001"],["Coimbatore","Tamil Nadu","641001"]]
const sources = ["Instagram Ad","Google Ads","Website Form","Referral","Walk-in Enquiry","Facebook Ad","WhatsApp Enquiry"]
const reasons = ["Hairfall consultation interest","Acne treatment enquiry","Thyroid review follow-up","Skin consultation callback","Diabetes review enquiry","General review interest"]

function pick<T>(arr: T[], i: number) { return arr[i % arr.length] }

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@zafoorclinic.com" } })
  let tag = await prisma.tag.findUnique({ where: { name: "Lead" } })
  if (!tag) tag = await prisma.tag.create({ data: { name: "Lead", color: "#D97706" } })

  const existing = await prisma.patient.count({ where: { uhid: { startsWith: "LEAD-" } } })
  let created = 0
  for (let i = 0; i < 30; i++) {
    const n = existing + i + 1
    const uhid = `LEAD-2026-${String(n).padStart(4, "0")}`
    const first = pick(firstNames, i)
    const last = pick(lastNames, i + 3)
    const [city, state, postalCode] = pick(cities, i)
    const gender = i % 3 === 0 ? "MALE" : i % 3 === 1 ? "FEMALE" : "OTHER"
    const phone = `9${String(700000000 + n * 137).padStart(9, "0")}`
    const source = pick(sources, i)
    const dob = new Date(1985 + (i % 30), i % 12, (i % 27) + 1)

    const patient = await prisma.patient.upsert({
      where: { uhid },
      update: {},
      create: {
        uhid,
        firstName: first,
        lastName: last,
        dob,
        gender: gender as any,
        occupation: pick(["Software Engineer","Teacher","Homemaker","Business Owner","Student","Nurse","Accountant","Sales Executive"], i),
        phone,
        alternatePhone: i % 4 === 0 ? `8${String(600000000 + n * 91).padStart(9, "0")}` : null,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${n}@example.com`,
        addressLine1: `${100 + n}, ${pick(["MG Road","Park Street","Anna Nagar","Jubilee Hills","Marine Drive","Church Street"], i)}`,
        city, state, postalCode, country: "India",
        status: "ACTIVE",
        source,
        registrationStatus: "SUBMITTED",
        registeredById: admin?.id,
        notesSummary: `Lead via ${source}.`,
        tags: { create: [{ tagId: tag.id }] },
        notes: {
          create: [{ body: `Inbound lead via ${source}. Interested in: ${pick(reasons, i)}.`, category: "GENERAL", authorId: admin?.id }],
        },
        followUps: {
          create: [{
            dueDate: new Date(Date.now() + (i % 7 + 1) * 24 * 60 * 60 * 1000),
            reason: pick(reasons, i),
            status: "PENDING",
            assignedToId: admin?.id,
            notes: "Auto-created lead follow-up — call to convert to appointment.",
          }],
        },
      },
    })
    if (patient) created++
  }

  console.log(`✅ ${created} leads ready (tagged "Lead", UHID LEAD-2026-0001..0030)`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
