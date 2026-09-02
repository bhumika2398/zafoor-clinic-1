"use server"

import { revalidatePath } from "next/cache"
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, requireRole } from "@/lib/auth"
import { toPlain } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"
import {
  createPatientPaymentSchema,
  patientPaymentFiltersSchema,
  type CreatePatientPaymentInput,
  type PatientPaymentFiltersInput,
} from "@/lib/validations/patient-payments"

// ── Create (Receptionist, Doctor, Admin) ───────────────────────────────────

export async function createPatientPayment(input: CreatePatientPaymentInput) {
  const data = createPatientPaymentSchema.parse(input)
  const user = await requireRole("ADMIN", "DOCTOR", "RECEPTIONIST")

  const payment = await prisma.patientPayment.create({
    data: {
      patientId: data.patientId,
      appointmentId: data.appointmentId || null,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      notes: data.notes || null,
      recordedById: user.id,
    },
  })

  await logAudit({
    action: "PATIENT_PAYMENT_RECORDED",
    entityType: "PatientPayment",
    entityId: payment.id,
    metadata: { patientId: data.patientId, amount: data.amount, paymentMethod: data.paymentMethod },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/payments")
  return toPlain(payment)
}

// ── Mark PAID / verify (Doctor & Admin ONLY) ────────────────────────────────

export async function togglePatientPaymentStatus(id: string) {
  const user = await requireRole("ADMIN", "DOCTOR")

  const existing = await prisma.patientPayment.findUniqueOrThrow({ where: { id } })
  const nextStatus = existing.status === "PAID" ? "PENDING" : "PAID"

  const updated = await prisma.patientPayment.update({
    where: { id },
    data:
      nextStatus === "PAID"
        ? { status: "PAID", verifiedById: user.id, paidAt: new Date() }
        : { status: "PENDING", verifiedById: null, paidAt: null },
  })

  await logAudit({
    action: "PATIENT_PAYMENT_VERIFIED",
    entityType: "PatientPayment",
    entityId: id,
    metadata: { status: nextStatus, patientId: existing.patientId, amount: Number(existing.amount) },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/payments")
  return toPlain(updated)
}

// ── List (all authenticated staff) ──────────────────────────────────────────

export async function getPatientPayments(params: PatientPaymentFiltersInput) {
  await getCurrentUser()
  const { status, query, from, to, page, pageSize } = patientPaymentFiltersSchema.parse(params)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: startOfDay(new Date(from)) } : {}),
      ...(to ? { lte: endOfDay(new Date(to)) } : {}),
    }
  }
  if (query) {
    where.patient = {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { uhid: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    }
  }

  const [payments, total] = await Promise.all([
    prisma.patientPayment.findMany({
      where,
      include: { patient: true, recordedBy: true, verifiedBy: true, appointment: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patientPayment.count({ where }),
  ])

  return { payments: toPlain(payments), total, page, pageSize }
}

// ── Revenue metrics (Doctor & Admin ONLY) ───────────────────────────────────

export async function getPatientPaymentRevenue() {
  const user = await getCurrentUser()
  if (user.role !== "DOCTOR" && user.role !== "ADMIN") {
    throw new Error("403 Forbidden: only doctors and admins may view revenue metrics")
  }

  const now = new Date()
  const [todayAgg, monthAgg] = await Promise.all([
    prisma.patientPayment.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.patientPayment.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return {
    todayRevenue: Number(todayAgg._sum.amount ?? 0),
    todayCount: todayAgg._count,
    monthRevenue: Number(monthAgg._sum.amount ?? 0),
    monthCount: monthAgg._count,
  }
}
