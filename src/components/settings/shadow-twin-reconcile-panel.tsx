'use client'

/**
 * @fileoverview Settings-Panel „Mit Speicher abgleichen": Pruefen / Reparieren.
 *
 * @description
 * DER Primaer-Flow der konsolidierten Sync-Engine (Welle 4 + 5d, Design §2):
 * - „Prüfen" (mode=check): EIN Report, nichts wird veraendert.
 * - „Reparieren" (mode=repair, preset=repair): fuehrt exakt den geprueften
 *   Plan aus (gueltige Fassung je Datei, Aufraeumen, Bilder registrieren,
 *   Namens-Migration, Quellen ohne Datenbank-Eintrag uebernehmen).
 * - Disclosure „Erweiterte Aktionen" (Welle 5d):
 *   „Aus Dateisystem laden" (preset=import — nur Storage→Datenbank) und
 *   „Ins Dateisystem exportieren" (preset=export — nur Datenbank→Storage).
 *   Beide fahren DIESELBE Engine; der fruehere eigene Migrations-Lauf entfaellt.
 *
 * Klartext nach aussen; die UI kennt nur die API (storage-abstraction.mdc).
 */

import * as React from 'react'
import { toast } from 'sonner'
import { HardDriveDownload, HardDriveUpload, Loader2, Search, Wrench } from 'lucide-react'
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@ks/ui'
import { useActiveLibrary } from '@ks/shell/react'
import { ShadowTwinSyncReportView, type SyncReportView } from './shadow-twin-sync-report-view'

type PanelAction = 'check' | 'repair' | 'export' | 'import'

async function callSyncEngine(
  libraryId: string,
  mode: 'check' | 'repair',
  preset: 'repair' | 'export' | 'import',
): Promise<SyncReportView> {
  const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Ohne scope = ganze Bibliothek (erfasst auch Eintraege, deren Datei fehlt).
    body: JSON.stringify({ mode, preset }),
  })
  const data = (await res.json().catch(() => ({}))) as SyncReportView & { error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export function ShadowTwinReconcilePanel() {
  const activeLibrary = useActiveLibrary()
  const libraryId = activeLibrary?.id
  const [busy, setBusy] = React.useState<PanelAction | null>(null)
  const [report, setReport] = React.useState<SyncReportView | null>(null)

  const run = React.useCallback(
    async (action: PanelAction) => {
      if (!libraryId) return
      setBusy(action)
      try {
        const r = await callSyncEngine(
          libraryId,
          action === 'check' ? 'check' : 'repair',
          action === 'export' || action === 'import' ? action : 'repair',
        )
        setReport(r)
        if (action === 'repair') {
          toast.success('Reparatur abgeschlossen', {
            description: `${r.changed} Datei(en) repariert, ${r.errors} Fehler.`,
          })
        }
        if (action === 'export') {
          toast.success('Export abgeschlossen', {
            description: `${r.changed} Datei(en) ins Dateisystem geschrieben, ${r.errors} Fehler.`,
          })
        }
        if (action === 'import') {
          toast.success('Import abgeschlossen', {
            description: `${r.changed} Datei(en) aus dem Dateisystem übernommen, ${r.errors} Fehler.`,
          })
        }
      } catch (e) {
        const titles: Record<PanelAction, string> = {
          check: 'Prüfen fehlgeschlagen',
          repair: 'Reparieren fehlgeschlagen',
          export: 'Export fehlgeschlagen',
          import: 'Import fehlgeschlagen',
        }
        toast.error(titles[action], {
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
        Gleicht Datenbank und Dateisystem ab: setzt je Datei das vollständigste Transkript
        als gültige Fassung, übernimmt außen bearbeitete Texte, räumt überzählige Varianten
        weg und registriert fehlende Seitenbilder. „Prüfen“ zeigt nur, was zu tun wäre;
        „Reparieren“ führt genau das aus.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('check')}>
          {busy === 'check' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Prüfen
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={busy !== null}>
              {busy === 'repair' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
              Reparieren
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ganze Bibliothek reparieren?</AlertDialogTitle>
              <AlertDialogDescription>
                Schreibt die gültige Fassung je Datei, löscht überzählige bzw. veraltete
                Varianten und registriert fehlende Bilder. Das lässt sich nicht automatisch
                rückgängig machen — bei großen Bibliotheken vorher ein Datenbank-Backup
                empfohlen. Tipp: erst „Prüfen“.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run('repair')}>Ja, reparieren</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {report && <ShadowTwinSyncReportView report={report} />}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none">Erweiterte Aktionen</summary>
        <div className="mt-2 flex items-start justify-between gap-4 rounded border p-3">
          <div>
            <div className="text-sm font-medium">Aus Dateisystem laden</div>
            <p className="text-xs text-muted-foreground">
              Liest Texte und Bilder aus dem Dateisystem und übernimmt sie in die Datenbank —
              zum Wiederherstellen einer Bibliothek, die nur als Dateien vorliegt. Im
              Dateisystem wird dabei nichts verändert; ist die Datenbank-Fassung
              vollständiger, bleibt sie erhalten.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={busy !== null}>
                {busy === 'import' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <HardDriveUpload className="h-4 w-4 mr-2" />
                )}
                Laden
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aus dem Dateisystem laden?</AlertDialogTitle>
                <AlertDialogDescription>
                  Übernimmt Texte und Bilder aus dem Dateisystem in die Datenbank. Bestehende
                  Datenbank-Einträge werden nur ersetzt, wenn die Datei-Fassung vollständiger
                  ist; Widersprüche werden im Bericht gemeldet. Kann je nach Größe der
                  Bibliothek einige Minuten dauern.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => void run('import')}>Laden</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="mt-2 flex items-start justify-between gap-4 rounded border p-3">
          <div>
            <div className="text-sm font-medium">Ins Dateisystem exportieren</div>
            <p className="text-xs text-muted-foreground">
              Schreibt alle Texte und Bilder aus der Datenbank ins Dateisystem — als Backup
              oder für ein neues System. Die Datenbank bleibt unverändert.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={busy !== null}>
                {busy === 'export' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <HardDriveDownload className="h-4 w-4 mr-2" />
                )}
                Exportieren
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alles ins Dateisystem exportieren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Schreibt alle Texte und Bilder aus der Datenbank ins Dateisystem.
                  Vorhandene Artefakt-Dateien werden dabei überschrieben.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => void run('export')}>Exportieren</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </details>
    </div>
  )
}
