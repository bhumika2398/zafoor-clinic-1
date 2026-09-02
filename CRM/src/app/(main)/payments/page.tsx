import { IndianRupee, CalendarDays } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { getPatientPayments, getPatientPaymentRevenue } from "@/actions/patient-payments"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog"
import { PaymentsFilters } from "@/components/payments/payments-filters"
import { PaymentsTable } from "@/components/payments/payments-table"
import { Pagination } from "@/components/shared/pagination"
import { formatCurrency } from "@/lib/format"

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const user = await getCurrentUser()
  const canViewRevenue = user.role === "DOCTOR" || user.role === "ADMIN"
  const canVerify = user.role === "DOCTOR" || user.role === "ADMIN"
  const page = Number(sp.page) || 1

  const [{ payments, total, pageSize }, revenue] = await Promise.all([
    getPatientPayments({ status: sp.status as "PENDING" | "PAID" | undefined, query: sp.q, page, pageSize: 20 }),
    canViewRevenue ? getPatientPaymentRevenue() : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Management</h1>
          <p className="text-sm text-muted-foreground">{total} payment{total === 1 ? "" : "s"} recorded</p>
        </div>
        <RecordPaymentDialog />
      </div>

      {canViewRevenue && revenue && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Today's Revenue (₹)"
            value={formatCurrency(revenue.todayRevenue)}
            icon={IndianRupee}
            tone="success"
            hint={`${revenue.todayCount} payment${revenue.todayCount === 1 ? "" : "s"} today`}
          />
          <StatCard
            label="Monthly Revenue (₹)"
            value={formatCurrency(revenue.monthRevenue)}
            icon={CalendarDays}
            tone="info"
            hint={`${revenue.monthCount} payment${revenue.monthCount === 1 ? "" : "s"} this month`}
          />
        </div>
      )}

      <PaymentsFilters />

      <Card>
        <CardContent className="p-0">
          <PaymentsTable payments={payments} canVerify={canVerify} />
        </CardContent>
      </Card>

      <Pagination total={total} pageSize={pageSize} currentPage={page} />
    </div>
  )
}
