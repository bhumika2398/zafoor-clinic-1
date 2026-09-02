import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { getMessages } from "@/actions/crm"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CommunicationsFilters } from "@/components/crm/communications-filters"
import { CommunicationsList } from "@/components/crm/communications-list"
import { LogMessageDialog } from "@/components/crm/log-message-dialog"

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const sp = await searchParams
  const messages = await getMessages({ channel: sp.channel })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Communication Center</h1>
          <p className="text-sm text-muted-foreground">SMS, Email, WhatsApp, and call logs across all patients.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            nativeButton={false}
            render={
              <Link href="/communications/whatsapp">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp Bulk Messaging
              </Link>
            }
          />
          <LogMessageDialog />
        </div>
      </div>

      <CommunicationsFilters />

      <Card>
        <CardContent className="p-0">
          <CommunicationsList messages={messages} />
        </CardContent>
      </Card>
    </div>
  )
}
