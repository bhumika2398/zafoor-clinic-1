"use client"

import { Pill, Printer, Stethoscope } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, calculateAge } from "@/lib/format"
import type { getPatientPrescriptions } from "@/actions/patients"

type Prescriptions = Awaited<ReturnType<typeof getPatientPrescriptions>>

const CLINIC = {
  name: "Zafoor Clinic",
  doctor: "Dr. Mufeeda Roohi",
  qualifications: "MBBS., FFM., FAM., FID",
  specialty: "Family Physician, Diabetologist & Aesthetic Physician",
  address: "No. 69/70 St. Xavier Street, Opp. Huda Masjid & Next to MedPlus, Seven Wells, Chennai - 600 001.",
  phone: "+91 89403 99403",
  email: "zafoorclinic@gmail.com",
  timings: "Mon - Sat: Evening 6:00 PM - 10:00PM · Sunday: Closed",
}

function genderInitial(g?: string | null) {
  if (g === "MALE") return "M"
  if (g === "FEMALE") return "F"
  return g ? g[0] : "—"
}

export function PrescriptionsTab({
  patientName,
  uhid,
  dob,
  gender,
  prescriptions,
}: {
  patientName: string
  uhid: string
  dob?: Date | string | null
  gender?: string | null
  prescriptions: Prescriptions
}) {
  const age = dob ? calculateAge(dob) : null

  function handlePrint(prescription: Prescriptions[number]) {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const itemsHtml = prescription.items
      .map(
        (item, idx) => `
        <tr>
          <td style="padding:8px 6px; vertical-align:top; width:26px;">${idx + 1}.</td>
          <td style="padding:8px 6px; vertical-align:top;">
            <div style="font-weight:600;">${item.medicineName}</div>
            ${item.instructions ? `<div style="font-size:12px; color:#555; font-style:italic;">${item.instructions}</div>` : ""}
          </td>
          <td style="padding:8px 6px; vertical-align:top; white-space:nowrap;">${item.dosage || "—"}</td>
          <td style="padding:8px 6px; vertical-align:top; white-space:nowrap;">${item.frequency || "—"}</td>
          <td style="padding:8px 6px; vertical-align:top; white-space:nowrap;">${item.duration || "—"}</td>
        </tr>`
      )
      .join("")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription — ${patientName} (${uhid})</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1a1a1a; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
            .doctor-name { font-size: 26px; font-weight: bold; color:#111; }
            .doctor-name span { color:#0f766e; }
            .quals { font-size: 12px; font-weight:600; color:#333; margin-top:2px; }
            .specialty { font-size: 12px; color:#555; margin-top:2px; }
            .rx-mark { font-size: 30px; font-weight:bold; color:#0f766e; font-style:italic; }
            .meta-row { display:flex; justify-content:space-between; margin: 18px 0 10px; font-size: 14px; }
            .meta-row div { line-height:1.7; }
            table { width:100%; border-collapse:collapse; margin-top: 8px; font-size: 14px; }
            th { text-align:left; font-size:11px; text-transform:uppercase; color:#666; border-bottom:1px solid #ccc; padding: 6px; }
            .diagnosis { font-size:14px; margin: 10px 0; }
            .notes { margin-top:20px; font-size:13px; background:#f7f7f7; border-left:3px solid #0f766e; padding:10px 14px; }
            .footer { margin-top:50px; border-top:1px solid #ddd; padding-top:14px; display:flex; justify-content:space-between; font-size:11.5px; color:#555; }
            .sig { text-align:right; }
            @media print { button { display:none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="doctor-name">Dr.<span>${CLINIC.doctor.replace("Dr. ", "")}</span></div>
              <div class="quals">${CLINIC.qualifications}</div>
              <div class="specialty">${CLINIC.specialty}</div>
            </div>
            <div style="text-align:right;">
              <div class="rx-mark">℞</div>
              <div style="font-size:12px; color:#555;">Date: ${formatDate(prescription.issuedAt || new Date())}</div>
            </div>
          </div>
          <div class="meta-row">
            <div>
              <div><strong>Name:</strong> ${patientName}</div>
              <div><strong>Age/Gender:</strong> ${age ?? "—"}/${genderInitial(gender)} &nbsp;·&nbsp; <strong>UHID:</strong> ${uhid}</div>
            </div>
            <div><strong>Doctor:</strong> Dr. ${prescription.doctor?.name || CLINIC.doctor}</div>
          </div>
          ${prescription.diagnosis ? `<div class="diagnosis"><strong>Complaint:</strong> ${prescription.diagnosis}</div>` : ""}
          <table>
            <thead><tr><th></th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${prescription.notes ? `<div class="notes"><strong>Advice:</strong> ${prescription.notes}</div>` : ""}
          <div class="footer">
            <div>${CLINIC.address}<br/>${CLINIC.phone} · ${CLINIC.email}<br/>${CLINIC.timings}</div>
            <div class="sig">
              <br/><br/>_____________________<br/>
              <strong>Dr. ${prescription.doctor?.name || CLINIC.doctor}</strong><br/>
              ${prescription.doctor?.specialization || CLINIC.specialty}
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Prescriptions</h2>
          <p className="text-sm text-muted-foreground">Digital soft copy of every Rx issued ({prescriptions.length} total).</p>
        </div>
      </div>

      {prescriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Pill className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            No prescriptions recorded for this patient yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {prescriptions.map((prescription) => (
            <Card key={prescription.id} className="overflow-hidden border-2 border-teal-700/20 shadow-sm py-0">
              <CardContent className="p-0">
                {/* Letterhead */}
                <div className="flex items-start justify-between gap-4 border-b-2 border-teal-700 px-6 py-4 bg-teal-50/50 dark:bg-teal-950/20">
                  <div>
                    <p className="text-xl font-bold text-foreground">
                      Dr.<span className="text-teal-700 dark:text-teal-400">
                        {(prescription.doctor?.name || CLINIC.doctor).replace("Dr. ", "")}
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{CLINIC.qualifications}</p>
                    <p className="text-xs text-muted-foreground">
                      {prescription.doctor?.specialization || CLINIC.specialty}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold italic text-teal-700 dark:text-teal-400 leading-none">℞</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(prescription.issuedAt || new Date())}</p>
                  </div>
                </div>

                {/* Patient meta row */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm border-b bg-muted/20">
                  <div className="space-x-4">
                    <span><span className="font-semibold">Name:</span> {patientName}</span>
                    <span><span className="font-semibold">Age/Gender:</span> {age ?? "—"}/{genderInitial(gender)}</span>
                    <span><span className="font-semibold">UHID:</span> {uhid}</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handlePrint(prescription)}>
                    <Printer className="h-3.5 w-3.5" /> Print Rx
                  </Button>
                </div>

                {prescription.diagnosis && (
                  <div className="px-6 pt-3 text-sm">
                    <span className="font-semibold">Complaint:</span> {prescription.diagnosis}
                  </div>
                )}

                {/* Rx body */}
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-serif italic text-lg mb-2">
                    <Stethoscope className="h-4 w-4" /> ℞
                  </div>
                  <ol className="space-y-2.5">
                    {prescription.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No medication items listed.</p>
                    ) : (
                      prescription.items.map((item, idx) => (
                        <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm border-b border-dashed pb-2 last:border-0">
                          <span className="text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="font-medium">{item.medicineName}</span>
                          {item.dosage && <span className="text-muted-foreground">— {item.dosage}</span>}
                          {item.frequency && <span className="text-muted-foreground">· {item.frequency}</span>}
                          {item.duration && <span className="text-muted-foreground">× {item.duration}</span>}
                          {item.instructions && (
                            <span className="w-full text-xs italic text-muted-foreground pl-5">{item.instructions}</span>
                          )}
                        </li>
                      ))
                    )}
                  </ol>

                  {prescription.notes && (
                    <div className="mt-4 text-xs bg-muted/30 border-l-2 border-teal-700 px-3 py-2">
                      <span className="font-semibold">Advice:</span> {prescription.notes}
                    </div>
                  )}
                </div>

                {/* Footer / letterhead bottom */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-[11px] text-muted-foreground bg-muted/10">
                  <span>{CLINIC.address}</span>
                  <span>{CLINIC.phone} · {CLINIC.email}</span>
                  <span>{CLINIC.timings}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
