"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { getPatients } from "@/actions/patients"
import { createWhatsAppTemplate, deleteWhatsAppTemplate, bulkSendWhatsApp } from "@/actions/whatsapp"
import { MessageCircle, Search, Plus, Trash2, Send } from "lucide-react"

type Template = { id: string; name: string; category: string; body: string }
type Tag = { id: string; name: string; color: string }
type PatientRow = { id: string; firstName: string; lastName: string | null; phone: string }

export function WhatsAppBlastClient({ templates, tags }: { templates: Template[]; tags: Tag[] }) {
  const [query, setQuery] = useState("")
  const [tagId, setTagId] = useState<string>("")
  const [results, setResults] = useState<PatientRow[]>([])
  const [selected, setSelected] = useState<Map<string, PatientRow>>(new Map())
  const [templateId, setTemplateId] = useState<string>("")
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()
  const [searching, setSearching] = useState(false)

  const selectedList = useMemo(() => Array.from(selected.values()), [selected])

  useEffect(() => {
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function search() {
    setSearching(true)
    startTransition(async () => {
      const { patients } = await getPatients({ query: query || undefined, tagId: tagId || undefined, pageSize: 50 })
      setResults(patients as any)
      setSearching(false)
    })
  }

  function toggle(p: PatientRow) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.set(p.id, p)
      return next
    })
  }

  function selectAllResults() {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const p of results) next.set(p.id, p)
      return next
    })
  }

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((t) => t.id === id)
    if (t) setBody(t.body)
  }

  function send() {
    if (!selectedList.length) return toast.error("Select at least one patient")
    if (!body.trim()) return toast.error("Message body is empty")
    startTransition(async () => {
      const res = await bulkSendWhatsApp({ patientIds: selectedList.map((p) => p.id), body })
      toast.success(`Sent ${res.sent} message(s)${res.failed ? `, ${res.failed} failed` : ""}`)
      setSelected(new Map())
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" /> Recipients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search name, UHID, phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Select value={tagId || "all"} onValueChange={(v) => setTagId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Any tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any tag</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={search} disabled={searching} size="icon" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {results.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{results.length} found</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAllResults}>
                Select all shown
              </Button>
            </div>
          )}

          <ScrollArea className="h-72 rounded-md border">
            <div className="p-2 space-y-1">
              {results.length === 0 && (
                <p className="text-sm text-muted-foreground p-4 text-center">Search or filter by tag to find patients/leads.</p>
              )}
              {results.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer text-sm"
                >
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p)} />
                  <span className="flex-1">
                    {p.firstName} {p.lastName || ""}
                  </span>
                  <span className="text-muted-foreground">{p.phone}</span>
                </label>
              ))}
            </div>
          </ScrollArea>

          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedList.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.firstName}
                  <button onClick={() => toggle(p)} className="ml-1 opacity-60 hover:opacity-100">×</button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Message</CardTitle>
          <TemplateManager templates={templates} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a saved template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Message body</Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}}, this is Zafoor Clinic..."
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: <code>{"{{firstName}}"}</code> <code>{"{{fullName}}"}</code>{" "}
              <code>{"{{clinicName}}"}</code> <code>{"{{clinicPhone}}"}</code>
            </p>
          </div>

          <Button onClick={send} disabled={pending} className="w-full gap-2">
            <Send className="h-4 w-4" />
            Send to {selectedList.length} recipient{selectedList.length === 1 ? "" : "s"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Delivered via the Meta WhatsApp Cloud API. Set <code>WHATSAPP_ACCESS_TOKEN</code> and{" "}
            <code>WHATSAPP_PHONE_NUMBER_ID</code> in <code>.env</code> to send for real — until then, sends are
            logged in Communications but not delivered.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function TemplateManager({ templates }: { templates: Template[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("General")
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  function create() {
    if (!name.trim() || !body.trim()) return toast.error("Name and body are required")
    startTransition(async () => {
      await createWhatsAppTemplate({ name, category, body })
      toast.success("Template saved")
      setName(""); setBody("")
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteWhatsAppTemplate(id)
      toast.success("Template deleted")
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Manage templates
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp Templates</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-56 overflow-y-auto">
          {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
          {templates.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-2 rounded-md border p-2.5">
              <div className="text-sm">
                <p className="font-medium">{t.name} <Badge variant="outline" className="ml-1">{t.category}</Badge></p>
                <p className="text-muted-foreground line-clamp-2">{t.body}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <Input placeholder="Template name (e.g. New Lead Welcome)" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["General","Lead Follow-up","Appointment Reminder","Billing","Promotion","Feedback Request"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={4} placeholder="Hi {{firstName}}, ..." value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={pending}>Save template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
