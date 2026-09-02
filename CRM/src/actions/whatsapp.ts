"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { NotificationService } from "@/lib/notifications"

const CLINIC_NAME = "Zafoor Clinic"
const CLINIC_PHONE = "8940399403"

function fillTemplate(body: string, patient: { firstName: string; lastName?: string | null }) {
  return body
    .replaceAll("{{firstName}}", patient.firstName)
    .replaceAll("{{fullName}}", `${patient.firstName} ${patient.lastName || ""}`.trim())
    .replaceAll("{{clinicName}}", CLINIC_NAME)
    .replaceAll("{{clinicPhone}}", CLINIC_PHONE)
}

// ── Templates ──────────────────────────────────────────────────────────

export async function getWhatsAppTemplates() {
  return prisma.whatsAppTemplate.findMany({ orderBy: { createdAt: "desc" } })
}

export async function createWhatsAppTemplate(input: { name: string; category: string; body: string }) {
  await getCurrentUser()
  const t = await prisma.whatsAppTemplate.create({ data: input })
  revalidatePath("/communications/whatsapp")
  return t
}

export async function deleteWhatsAppTemplate(id: string) {
  await getCurrentUser()
  await prisma.whatsAppTemplate.delete({ where: { id } })
  revalidatePath("/communications/whatsapp")
}

// ── Bulk send ──────────────────────────────────────────────────────────

export async function bulkSendWhatsApp(params: { patientIds: string[]; body: string }) {
  const user = await getCurrentUser()
  const { patientIds, body } = params
  if (!patientIds.length) return { sent: 0, failed: 0, results: [] }

  const patients = await prisma.patient.findMany({ where: { id: { in: patientIds } } })

  const results: { patientId: string; name: string; success: boolean }[] = []
  for (const p of patients) {
    const message = fillTemplate(body, p)
    const res = await NotificationService.send("WHATSAPP", {
      to: { name: `${p.firstName} ${p.lastName || ""}`.trim(), phone: p.phone },
      message,
    })
    await prisma.message.create({
      data: {
        patientId: p.id,
        channel: "WHATSAPP",
        direction: "OUTBOUND",
        body: message,
        status: res.success ? "SENT" : "FAILED",
        sentById: user?.id,
      },
    })
    results.push({ patientId: p.id, name: `${p.firstName} ${p.lastName || ""}`.trim(), success: res.success })
  }

  revalidatePath("/communications")
  revalidatePath("/communications/whatsapp")
  return {
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  }
}
