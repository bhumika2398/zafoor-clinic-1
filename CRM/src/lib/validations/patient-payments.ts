import { z } from "zod"

export const patientPaymentMethods = ["CASH", "UPI", "CARD", "NET_BANKING", "OTHER"] as const

export const createPatientPaymentSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  appointmentId: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paymentMethod: z.enum(patientPaymentMethods),
  notes: z.string().trim().optional(),
})
export type CreatePatientPaymentInput = z.infer<typeof createPatientPaymentSchema>

export const patientPaymentFiltersSchema = z.object({
  status: z.enum(["PENDING", "PAID"]).optional(),
  query: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})
export type PatientPaymentFiltersInput = z.infer<typeof patientPaymentFiltersSchema>
