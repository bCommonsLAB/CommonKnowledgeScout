'use client'

/**
 * Experten-Panel: Library-weite Shadow-Twin-Reparatur (Transkripte + Bilder).
 *
 * Ruft den per-Library-Reconcile-Endpoint OHNE sourceIds auf (ganze Bibliothek):
 * - Vorschau = Dry-Run (apply=false) -> zeigt nur, was passieren WUERDE.
 * - Synchronisieren = Apply (apply=true) -> schreibt gueltige Fassung je Datei,
 *   loescht ueberzaehlige Varianten, registriert fehlende Bilder (B1). Mit Bestaetigung.
 *
 * Klartext nach aussen (keine Reconcile-/Konflikt-Fachsprache). Die UI kennt nur die API.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { activeLibraryAtom } from '@/atoms/library-atom'

/** Teilmenge des Reconcile-Reports, die das Panel anzeigt. */
interface ReconcileReportView {
  apply: boolean
  totalSources: number
  changed: number
  conflicts: number
  needsReextract: number
  images: number
}

async function callReconcile(libraryId: string, apply: boolean): Promise<ReconcileReportView> {
  const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply }),
  })
  const data = (await res.json().catch(() => ({}))) as ReconcileReportView & { error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

function ReportView({ report }: { report: ReconcileReportView }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>Dateien: <strong className="text-foreground">{report.totalSources}</strong></span>
        <span>{report.apply ? 'Aktualisiert' : 'Würde ändern'}: <strong className="text-foreground">{report.changed}</strong></span>
        <span>Bilder {report.apply ? 'registriert' : 'fehlend'}: <strong className="text-foreground">{report.images}</strong></span>
        {report.conflicts > 0 && (
          <span>Uneindeutig (übersprungen): <strong className="text-foreground">{report.conflicts}</strong></span>
        )}
        {report.needsReextract > 0 && (
          <span>Neu-Erstellung nötig: <strong className="text-foreground">{report.needsReextract}</strong></span>
        )}
      </div>
    </div>
  )
}

export function ShadowTwinReconcilePanel() {
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryId = activeLibrary?.id
  const [busy, setBusy] = React.useState<'preview' | 'apply' | null>(null)
  const [report, setReport] = React.useState<ReconcileReportView | null>(null)

  const run = React.useCallback(
    async (apply: boolean) => {
      if (!libraryId) return
      setBusy(apply ? 'apply' : 'preview')
      try {
        const r = await callReconcile(libraryId, apply)
        setReport(r)
        if (apply) {
          toast.success('Mit Speicher synchronisiert', {
            description: `${r.changed} Datei(en) aktualisiert, ${r.images} Bild(er) registriert.`,
          })
        }
      } catch (e) {
        toast.error(apply ? 'Synchronisieren fehlgeschlagen' : 'Vorschau fehlgeschlagen', {
          description: e instanceof Error ? e.message : 'Unbekannter Fehler',
        })
      } finally {
        setBusy(null)
      }
    },
    [libraryId],
  )

  if (!activeLibrary) {
    return <p className="text-sm text-muted-foreground">Keine aktive Bibliothek gewählt.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Bringt die ganze Bibliothek mit dem Speicher in Einklang: setzt je Datei das
        vollständigste Transkript als gültige Fassung, räumt überzählige bzw. veraltete
        Varianten weg und registriert fehlende Seitenbilder. „Vorschau“ zeigt nur, was
        passieren würde; „Mit Speicher synchronisieren“ führt es aus.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(false)}>
          {busy === 'preview' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Vorschau
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={busy !== null}>
              {busy === 'apply' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Mit Speicher synchronisieren
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ganze Bibliothek synchronisieren?</AlertDialogTitle>
              <AlertDialogDescription>
                Schreibt die gültige Fassung je Datei, löscht überzählige bzw. veraltete
                Varianten und registriert fehlende Bilder. Das lässt sich nicht automatisch
                rückgängig machen — bei großen Bibliotheken vorher ein Datenbank-Backup
                empfohlen. Tipp: erst „Vorschau“ prüfen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run(true)}>Ja, synchronisieren</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {report && <ReportView report={report} />}
    </div>
  )
}
