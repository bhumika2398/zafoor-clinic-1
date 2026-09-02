// Additional mock data — layered on top of the base `seed.ts` run.
// Idempotent (safe to re-run: clears its own previously-seeded rows
// first), so it's safe against an already-seeded database. Populates
// every module that looked thin with just the base seed: queue, waiting
// list, follow-ups, communications, billing variety, finance, cash
// counter.
//
// Run with: npm run db:seed:extra
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function daysFrom(base: Date, offset: number, hour = 18, minute = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/**
 * The local `prisma dev` (PGlite-backed) database occasionally throws a
 * transient "bind message supplies N parameters, but prepared statement
 * requires 0" error under rapid sequential queries — a known quirk of that
 * ephemeral driver, not a real data/logic error. Retry transparently.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 150 * (i + 1)))
    }
  }
  throw lastErr
}

async function main() {
  console.log("Seeding additional mock data…")

  // Idempotency: safe to re-run after a partial failure. Deleting these
  // patients cascades away their appointments/bills/payments/encounters/
  // notes/feedback/follow-ups/waiting-list entries (all onDelete: Cascade).
  await withRetry(() => prisma.patient.deleteMany({ where: { uhid: { startsWith: "ZC-MOCK-" } } }))
  await withRetry(() =>
    prisma.expense.deleteMany({
      where: { description: { in: ["Monthly clinic rent", "Consumables and dressing supplies", "Local newspaper ad"] } },
    })
  )
  await withRetry(() => prisma.cashSession.deleteMany({ where: { openingBalance: 2000 } }))

  const doctor = await withRetry(() => prisma.user.findUniqueOrThrow({ where: { email: "doctor@zafoorclinic.test" } }))
  const receptionist = await withRetry(() => prisma.user.findUniqueOrThrow({ where: { email: "reception@zafoorclinic.test" } }))
  const admin = await withRetry(() => prisma.user.findUniqueOrThrow({ where: { email: "admin@zafoorclinic.test" } }))
  const services = await withRetry(() => prisma.service.findMany())
  const serviceBySlug = Object.fromEntries(services.map((s) => [s.slug, s]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── More patients ────────────────────────────────────────────────────
  const patientDefs = [
    { first: "Fathima", last: "Begum", gender: "FEMALE" as const, phone: "9000010001", city: "Chennai", source: "CRM" as const },
    { first: "Rahul", last: "Krishnan", gender: "MALE" as const, phone: "9000010002", city: "Chennai", source: "WEBSITE" as const },
    { first: "Priya", last: "Suresh", gender: "FEMALE" as const, phone: "9000010003", city: "Chennai", source: "WEBSITE" as const },
    { first: "Mohammed", last: "Iqbal", gender: "MALE" as const, phone: "9000010004", city: "Chennai", source: "CRM" as const },
    { first: "Kavya", last: "Ramesh", gender: "FEMALE" as const, phone: "9000010005", city: "Chennai", source: "WEBSITE" as const },
    { first: "Suresh", last: "Kumar", gender: "MALE" as const, phone: "9000010006", city: "Chennai", source: "CRM" as const },
    { first: "Ayesha", last: "Siddiqui", gender: "FEMALE" as const, phone: "9000010007", city: "Chennai", source: "WEBSITE" as const },
    { first: "Vignesh", last: "Raja", gender: "MALE" as const, phone: "9000010008", city: "Chennai", source: "CRM" as const },
    { first: "Nandini", last: "Iyer", gender: "FEMALE" as const, phone: "9000010009", city: "Chennai", source: "WEBSITE" as const },
    { first: "Zubair", last: "Ahmed", gender: "MALE" as const, phone: "9000010010", city: "Chennai", source: "CRM" as const },
  ]

  const patients: Awaited<ReturnType<typeof prisma.patient.create>>[] = []
  for (const [i, def] of patientDefs.entries()) {
    const patient = await withRetry(() =>
      prisma.patient.create({
        data: {
          uhid: `ZC-MOCK-${String(i + 1).padStart(4, "0")}`,
          firstName: def.first,
          lastName: def.last,
          gender: def.gender,
          phone: def.phone,
          email: `${def.first.toLowerCase()}.${def.last.toLowerCase()}@example.com`,
          city: def.city,
          state: "Tamil Nadu",
          source: def.source,
          registeredById: receptionist.id,
          communicationPreference: { create: { preferredChannel: i % 2 === 0 ? "SMS" : "WHATSAPP" } },
        },
      })
    )
    patients.push(patient)
  }
  console.log(`  ${patients.length} more patients created`)

  const serviceCycle = [
    "hairfall-review", "acne-review", "thyroid-review", "skin-review",
    "diabetes-review", "general-review", "skin-diabetes-general-review",
  ]

  // ── Past appointments: a mix of completed / no-show / cancelled ───────
  const pastStatuses: Array<"COMPLETED" | "NO_SHOW" | "CANCELLED"> = [
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "NO_SHOW", "CANCELLED",
  ]
  const pastAppointments = []
  for (const [i, status] of pastStatuses.entries()) {
    const patient = patients[i % patients.length]
    const service = serviceBySlug[serviceCycle[i % serviceCycle.length]]
    const scheduledAt = daysFrom(today, -(i + 1), 18 + (i % 3), 30)
    const appointment = await withRetry(() =>
      prisma.appointment.create({
        data: {
          appointmentCode: `APT-MOCK-${String(i + 1).padStart(4, "0")}`,
          patientId: patient.id,
          doctorId: doctor.id,
          serviceId: service.id,
          scheduledAt,
          type: "IN_PERSON",
          status,
          reason: `${service.name} follow-up`,
          source: patient.source === "WEBSITE" ? "WEBSITE" : "CRM",
          createdById: receptionist.id,
          checkedInAt: status !== "CANCELLED" ? scheduledAt : null,
          completedAt: status === "COMPLETED" ? scheduledAt : null,
          cancelReason: status === "CANCELLED" ? "Patient requested reschedule" : null,
          cancelledAt: status === "CANCELLED" ? scheduledAt : null,
        },
      })
    )
    pastAppointments.push({ appointment, patient, service, status })
  }
  console.log(`  ${pastAppointments.length} past appointments created (completed/no-show/cancelled)`)

  // ── Encounters + prescriptions + bills + payments for completed visits ─
  let billCount = 0
  let paymentCount = 0
  for (const { appointment, patient, service, status } of pastAppointments) {
    if (status !== "COMPLETED") continue

    const encounter = await withRetry(() =>
      prisma.encounter.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentId: appointment.id,
          chiefComplaints: [service.name.replace(" Review", "")],
          status: "FINALIZED",
          signedAt: appointment.scheduledAt,
          diagnoses: {
            create: [{ patientId: patient.id, description: `${service.name.replace(" Review", "")} — routine`, type: "PRIMARY", status: "ACTIVE" }],
          },
          clinicalNote: {
            create: {
              patientId: patient.id,
              doctorId: doctor.id,
              subjective: `Patient presented for ${service.name.toLowerCase()}.`,
              objective: "Vitals stable, no acute distress.",
              assessment: "Responding well to plan.",
              plan: "Continue current management, review in 4 weeks.",
              status: "SIGNED",
              signedAt: appointment.scheduledAt,
            },
          },
        },
      })
    )

    await withRetry(() =>
      prisma.prescription.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentId: appointment.id,
          encounterId: encounter.id,
          diagnosis: `${service.name.replace(" Review", "")} management`,
          items: { create: [{ medicineName: "As advised in clinic", frequency: "As directed", duration: "2 weeks" }] },
        },
      })
    )

    const price = Number(service.price ?? 500)
    const isDiscounted = billCount === 1
    const discount = isDiscounted ? 50 : 0
    const net = price - discount
    // Vary payment completeness: one fully paid, one partially paid, rest fully paid.
    const isPartial = billCount === 2
    const paid = isPartial ? Math.round(net / 2) : net

    const bill = await withRetry(() =>
      prisma.bill.create({
        data: {
          billNumber: `INV-MOCK-${String(billCount + 1).padStart(4, "0")}`,
          patientId: patient.id,
          appointmentId: appointment.id,
          serviceId: service.id,
          totalAmount: price,
          discountAmount: discount,
          netAmount: net,
          amountPaid: paid,
          balanceDue: net - paid,
          status: paid >= net ? "PAID" : "PARTIALLY_PAID",
          items: { create: [{ description: `${service.name} consultation`, quantity: 1, unitPrice: price, amount: price }] },
        },
      })
    )
    billCount++

    if (paid > 0) {
      await withRetry(() =>
        prisma.payment.create({
          data: {
            receiptNumber: `RCPT-MOCK-${String(paymentCount + 1).padStart(4, "0")}`,
            patientId: patient.id,
            billId: bill.id,
            amount: paid,
            method: ["CASH", "UPI", "CARD"][paymentCount % 3] as never,
            status: "SUCCESS",
            receivedById: receptionist.id,
            paidAt: appointment.scheduledAt,
          },
        })
      )
      paymentCount++
    }
  }
  console.log(`  ${billCount} bills and ${paymentCount} payments created`)

  // ── Quick patient payments (Payments module — /payments) ───────────────
  await withRetry(() => prisma.patientPayment.deleteMany({ where: { notes: { contains: "[seed-extra]" } } }))
  const quickPaymentDefs: Array<{
    patient: (typeof patients)[number]
    appointment?: (typeof pastAppointments)[number]["appointment"]
    amount: number
    paymentMethod: string
    status: "PENDING" | "PAID"
    verified: boolean
  }> = [
    { patient: patients[0], appointment: pastAppointments[0]?.appointment, amount: 600, paymentMethod: "CASH", status: "PAID", verified: true },
    { patient: patients[1], appointment: pastAppointments[1]?.appointment, amount: 450, paymentMethod: "UPI", status: "PAID", verified: true },
    { patient: patients[2], amount: 500, paymentMethod: "CARD", status: "PENDING", verified: false },
    { patient: patients[3], amount: 350, paymentMethod: "UPI", status: "PENDING", verified: false },
    { patient: patients[4], amount: 700, paymentMethod: "OTHER", status: "PAID", verified: true },
  ]
  for (const def of quickPaymentDefs) {
    await withRetry(() =>
      prisma.patientPayment.create({
        data: {
          patientId: def.patient.id,
          appointmentId: def.appointment?.id ?? null,
          amount: def.amount,
          paymentMethod: def.paymentMethod,
          status: def.status,
          notes: "[seed-extra] Front-desk quick payment log entry",
          recordedById: receptionist.id,
          verifiedById: def.verified ? doctor.id : null,
          paidAt: def.status === "PAID" ? new Date() : null,
        },
      })
    )
  }
  console.log(`  ${quickPaymentDefs.length} quick patient payments created (Payments module)`)

  // ── One refund request, for the Refunds queue ─────────────────────────
  const refundBillHolder = pastAppointments[0]
  await withRetry(() =>
    prisma.refund.create({
      data: {
        patientId: refundBillHolder.patient.id,
        amount: 100,
        reason: "Duplicate payment recorded at front desk",
        method: "CASH",
        status: "PENDING",
      },
    })
  )
  console.log("  1 pending refund request created")

  // ── Today: queue activity (arrived / in consultation) ─────────────────
  const queuePatients = patients.slice(0, 3)
  const queueStatuses: Array<"ARRIVED" | "IN_CONSULTATION"> = ["ARRIVED", "ARRIVED", "IN_CONSULTATION"]
  for (const [i, patient] of queuePatients.entries()) {
    const service = serviceBySlug[serviceCycle[i % serviceCycle.length]]
    const checkedInAt = new Date()
    checkedInAt.setMinutes(checkedInAt.getMinutes() - (30 - i * 10))
    await withRetry(() =>
      prisma.appointment.create({
        data: {
          appointmentCode: `APT-MOCK-Q${i + 1}`,
          patientId: patient.id,
          doctorId: doctor.id,
          serviceId: service.id,
          scheduledAt: checkedInAt,
          type: i === 0 ? "WALK_IN" : "IN_PERSON",
          status: queueStatuses[i],
          reason: `${service.name} — today's visit`,
          source: "CRM",
          createdById: receptionist.id,
          checkedInAt,
          startedAt: queueStatuses[i] === "IN_CONSULTATION" ? new Date() : null,
        },
      })
    )
  }
  console.log(`  ${queuePatients.length} appointments added to today's queue`)

  // ── Upcoming appointments: confirmed + pending (some from website) ────
  const upcomingDefs = [
    { offset: 1, status: "CONFIRMED" as const, source: "CRM" as const },
    { offset: 1, status: "PENDING" as const, source: "WEBSITE" as const },
    { offset: 2, status: "CONFIRMED" as const, source: "CRM" as const },
    { offset: 3, status: "PENDING" as const, source: "WEBSITE" as const },
    { offset: 4, status: "CONFIRMED" as const, source: "CRM" as const },
  ]
  for (const [i, def] of upcomingDefs.entries()) {
    const patient = patients[(i + 4) % patients.length]
    const service = serviceBySlug[serviceCycle[(i + 2) % serviceCycle.length]]
    await withRetry(() =>
      prisma.appointment.create({
        data: {
          appointmentCode: `APT-MOCK-U${i + 1}`,
          patientId: patient.id,
          doctorId: doctor.id,
          serviceId: service.id,
          scheduledAt: daysFrom(today, def.offset, 18 + (i % 4) * 1, 0),
          type: "IN_PERSON",
          status: def.status,
          reason: `${service.name} consultation`,
          source: def.source,
          createdById: def.source === "CRM" ? receptionist.id : null,
        },
      })
    )
  }
  console.log(`  ${upcomingDefs.length} upcoming appointments created`)

  // ── Waiting list ────────────────────────────────────────────────────
  const waitingDefs = [
    { patient: patients[0], status: "WAITING" as const, priority: 0, reason: "Prefers evening slot next week" },
    { patient: patients[1], status: "WAITING" as const, priority: 1, reason: "Follow-up, flexible on date" },
    { patient: patients[2], status: "NOTIFIED" as const, priority: 0, reason: "Slot opened, awaiting confirmation" },
  ]
  for (const def of waitingDefs) {
    await withRetry(() =>
      prisma.waitingListEntry.create({
        data: {
          patientId: def.patient.id,
          doctorId: doctor.id,
          requestedDate: daysFrom(today, 2),
          reason: def.reason,
          priority: def.priority,
          status: def.status,
        },
      })
    )
  }
  console.log(`  ${waitingDefs.length} waiting list entries created`)

  // ── Follow-ups ──────────────────────────────────────────────────────
  const followUpDefs = [
    { patient: patients[3], dueOffset: 3, status: "PENDING" as const, reason: "Review thyroid panel results" },
    { patient: patients[4], dueOffset: -2, status: "MISSED" as const, reason: "Diabetes diet check-in call" },
    { patient: patients[5], dueOffset: -5, status: "DONE" as const, reason: "Post-treatment skin check" },
    { patient: patients[6], dueOffset: 7, status: "PENDING" as const, reason: "Hairfall treatment 4-week review" },
  ]
  for (const def of followUpDefs) {
    await withRetry(() =>
      prisma.followUp.create({
        data: {
          patientId: def.patient.id,
          assignedToId: doctor.id,
          dueDate: daysFrom(today, def.dueOffset),
          reason: def.reason,
          status: def.status,
          completedAt: def.status === "DONE" ? daysFrom(today, def.dueOffset) : null,
        },
      })
    )
  }
  console.log(`  ${followUpDefs.length} follow-ups created`)

  // ── Communications log ─────────────────────────────────────────────
  const messageDefs = [
    { patient: patients[0], channel: "SMS" as const, body: "Reminder: your appointment at Zafoor Clinic is tomorrow at 6:30 PM." },
    { patient: patients[1], channel: "WHATSAPP" as const, body: "Thank you for visiting Zafoor Clinic. Let us know if you have any questions about your treatment." },
    { patient: patients[2], channel: "CALL" as const, body: "Called to confirm appointment — patient confirmed." },
  ]
  for (const def of messageDefs) {
    await withRetry(() =>
      prisma.message.create({
        data: { patientId: def.patient.id, channel: def.channel, direction: "OUTBOUND", body: def.body, status: "DELIVERED", sentById: receptionist.id },
      })
    )
  }
  console.log(`  ${messageDefs.length} communication log entries created`)

  // ── Patient notes ───────────────────────────────────────────────────
  await withRetry(() =>
    prisma.patientNote.create({
      data: { patientId: patients[0].id, authorId: doctor.id, body: "Prefers minimal medication; discuss lifestyle options first.", category: "CLINICAL" },
    })
  )
  await withRetry(() =>
    prisma.patientNote.create({
      data: { patientId: patients[3].id, authorId: receptionist.id, body: "Requested SMS reminders only, no calls.", category: "FRONT_DESK", pinned: true },
    })
  )
  console.log("  2 patient notes created")

  // ── Feedback ────────────────────────────────────────────────────────
  await withRetry(() => prisma.feedback.create({ data: { patientId: patients[0].id, rating: 5, comment: "Very attentive doctor, short wait time." } }))
  await withRetry(() => prisma.feedback.create({ data: { patientId: patients[1].id, rating: 4, comment: "Good experience overall, parking was tricky." } }))
  console.log("  2 feedback entries created")

  // ── Expenses ────────────────────────────────────────────────────────
  const expenseDefs = [
    { category: "RENT" as const, description: "Monthly clinic rent", amount: 25000, daysAgo: 5 },
    { category: "SUPPLIES" as const, description: "Consumables and dressing supplies", amount: 3200, daysAgo: 3 },
    { category: "MARKETING" as const, description: "Local newspaper ad", amount: 1500, daysAgo: 10 },
  ]
  for (const def of expenseDefs) {
    await withRetry(() =>
      prisma.expense.create({
        data: {
          category: def.category,
          description: def.description,
          amount: def.amount,
          expenseDate: daysFrom(today, -def.daysAgo),
          method: "CASH",
          recordedById: admin.id,
        },
      })
    )
  }
  console.log(`  ${expenseDefs.length} expenses created`)

  // ── Cash sessions: one closed (yesterday), one open (today) ───────────
  const yesterdayOpen = daysFrom(today, -1, 18, 0)
  const yesterdayClose = daysFrom(today, -1, 22, 0)
  await withRetry(() =>
    prisma.cashSession.create({
      data: {
        openedById: receptionist.id,
        closedById: receptionist.id,
        openingBalance: 2000,
        closingBalance: 6500,
        expectedClosing: 6500,
        status: "CLOSED",
        openedAt: yesterdayOpen,
        closedAt: yesterdayClose,
      },
    })
  )
  await withRetry(() =>
    prisma.cashSession.create({
      data: { openedById: receptionist.id, openingBalance: 2000, status: "OPEN", openedAt: daysFrom(today, 0, 18, 0) },
    })
  )
  console.log("  2 cash sessions created (1 closed, 1 open)")

  console.log("\nMock data seeding complete.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
