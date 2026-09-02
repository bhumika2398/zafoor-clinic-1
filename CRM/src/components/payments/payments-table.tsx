"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { formatDateTime } from "@/lib/format"
import { formatCurrency } from "@/lib/format"
import { patientDisplayName } from "@/lib/format"
import { paymentMethodLabels, patientPaymentStatusLabels, patientPaymentStatusColors } from "@/lib/labels"
import { togglePatientPaymentStatus } from "@/actions/patient-payments"
import { cn } from "@/lib/utils"

type PatientPaymentRow = {
  id: string
  amount: number
  paymentMethod: string
  status: "PENDING" | "PAID"
  notes: string | null
  paidAt: Date | string | null
  createdAt: Date | string
  patient: { firstName: string; lastName: string | null; uhid: string }
  recordedBy: { name: string } | null
  verifiedBy: { name: string } | null
}

export function PaymentsTable({
  payments,
  canVerify,
}: {
  payments: PatientPaymentRow[]
  canVerify: boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle(id: string) {
    startTransition(async () => {
      try {
        await togglePatientPaymentStatus(id)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update payment status")
      }
    })
  }

  if (payments.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No payments recorded yet.</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Recorded By</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <div className="font-medium">{patientDisplayName(p.patient)}</div>
              <div className="text-xs text-muted-foreground">{p.patient.uhid}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
            <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
            <TableCell>{paymentMethodLabels[p.paymentMethod] ?? p.paymentMethod}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.recordedBy?.name ?? "—"}</TableCell>
            <TableCell>
              <Badge className={cn("border-0", patientPaymentStatusColors[p.status])}>
                {patientPaymentStatusLabels[p.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {canVerify ? (
                <label className="inline-flex items-center gap-2 justify-end cursor-pointer select-none">
                  <span className="text-xs text-muted-foreground">Mark Paid</span>
                  <Checkbox
                    checked={p.status === "PAID"}
                    disabled={pending}
                    onCheckedChange={() => handleToggle(p.id)}
                  />
                </label>
              ) : (
                <span
                  className="text-xs text-muted-foreground"
                  title="Only doctors can verify/mark payment completed"
                >
                  Read-only
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
