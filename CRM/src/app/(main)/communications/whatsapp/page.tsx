import { getWhatsAppTemplates } from "@/actions/whatsapp"
import { listAllTags } from "@/actions/patients"
import { WhatsAppBlastClient } from "@/components/crm/whatsapp-blast-client"

export default async function WhatsAppBlastPage() {
  const [templates, tags] = await Promise.all([getWhatsAppTemplates(), listAllTags()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Bulk Messaging</h1>
        <p className="text-sm text-muted-foreground">
          Send a templated WhatsApp message to many patients or leads at once.
        </p>
      </div>
      <WhatsAppBlastClient templates={templates} tags={tags} />
    </div>
  )
}
