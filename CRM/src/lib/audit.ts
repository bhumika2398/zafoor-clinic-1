import { getSupabase } from "@/lib/supabase"
import { getCurrentUserOrNull } from "@/lib/auth"
import { nanoid } from "nanoid"

export type AuditAction =
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "PATIENT_LOCKED"
  | "PATIENT_OVERRIDE"
  | "PATIENT_DELETED"
  | "APPOINTMENT_BOOKED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_STATUS_CHANGED"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "STOCK_ADJUSTMENT"
  | "STOCK_RETURN"
  | "MEDICINE_CREATED"
  | "MEDICINE_UPDATED"
  | "MEDICINE_ARCHIVED"
  | "ALERT_CREATED"
  | "ALERT_UPDATED"
  | "ALERT_ACKNOWLEDGED"
  | "ALERT_RESOLVED"
  | "BILL_CREATED"
  | "BILL_FINALIZED"
  | "BILL_CANCELLED"
  | "PAYMENT_RECORDED"
  | "INVOICE_GENERATED"
  | "RECEIPT_GENERATED"
  | "REFUND_CREATED"
  | "USER_LOGIN"
  | "PERMISSION_OVERRIDE"
  | "PATIENT_PAYMENT_RECORDED"
  | "PATIENT_PAYMENT_VERIFIED"

interface LogAuditParams {
  action: AuditAction
  entityType: "Patient" | "Appointment" | "InventoryItem" | "InventoryAlert" | "Bill" | "Payment" | "PatientPayment" | "Refund" | "User" | "System"
  entityId?: string
  metadata?: Record<string, unknown> | null
  userId?: string
  userName?: string
  userRole?: string
  ipAddress?: string
  tx?: any
}

export async function logAudit(params: LogAuditParams) {
  try {
    const supabase = getSupabase()
    let userId = params.userId
    let userName = params.userName
    let userRole = params.userRole

    if (!userId) {
      const currentUser = await getCurrentUserOrNull()
      if (currentUser) {
        userId = currentUser.id
        userName = currentUser.name
        userRole = currentUser.role
      }
    }

    const { data, error } = await supabase.from("AuditLog").insert({
      id: "aud_" + nanoid(20),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      metadata: params.metadata || null,
      userId: userId || null,
      userName: userName || "System",
      userRole: userRole || "SYSTEM",
      ipAddress: params.ipAddress || null,
    }).select().single()

    if (error) {
      console.error("[AuditLog] Supabase insert error:", error)
      return null
    }

    return data
  } catch (err) {
    console.error("[AuditLog] Failed to record audit entry:", err)
    return null
  }
}
