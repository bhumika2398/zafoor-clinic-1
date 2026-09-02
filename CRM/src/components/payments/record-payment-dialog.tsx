"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PatientPicker } from "@/components/appointments/patient-picker"
import { createPatientPayment } from "@/actions/patient-payments"
import { patientPaymentMethods } from "@/lib/validations/patient-payments"
import { paymentMethodLabels } from "@/lib/labels"

export function RecordPaymentDialog() {
  const [open, setOpen] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<(typeof patientPaymentMethods)[number]>("CASH")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function reset() {
    setPatientId("")
    setAmount("")
    setPaymentMethod("CASH")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <Button className="gap-1.5 font-medium shrink-0 self-start sm:self-auto" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Record Payment
      </Button>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Log a payment received from a patient. A doctor or admin will verify it as Paid.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!patientId) {
              toast.error("Select a patient")
              return
            }
            startTransition(async () => {
              try {
                await createPatientPayment({
                  patientId,
                  amount: Number(amount),
                  paymentMethod,
                  notes: notes.trim() || undefined,
                })
                toast.success("Payment recorded")
                setOpen(false)
                reset()
                router.refresh()
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not record payment")
              }
            })
          }}
        >
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            <PatientPicker value={patientId} onChange={setPatientId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pp-amount">Amount (₹) *</Label>
              <Input
                id="pp-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select
                items={paymentMethodLabels}
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {patientPaymentMethods.map((m) => (
                    <SelectItem key={m} value={m}>{paymentMethodLabels[m] ?? m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pp-notes">Notes (optional)</Label>
            <Textarea id="pp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" disabled={pending || !patientId || !amount} className="w-full">
            {pending ? "Recording…" : "Record Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
