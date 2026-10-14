"use client"

/**
 * StorageSummary — Read-only-Zusammenfassung der eingerichteten Quelle
 * (Welle 3-IV-UX-3b, F3). Seit Teil A des Plans
 * speicher-verbindungen-und-library-anlage zeigt sie Typ, Speicher-Verbindung
 * und Verzeichnis; Zugangsdaten und OneDrive-Anmeldung liegen an der
 * Verbindung (Mein Konto → Speicher-Verbindungen).
 * - D1: "Quelle ändern" startet den Wizard erst nach Warnung.
 * Knopfzeile bricht nie um (Owner-Regel).
 */

import Link from "next/link"
import {
  Alert, AlertDescription, AlertTitle,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Button, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@ks/ui'
import { AlertTriangle, Check, Cloud, FolderOpen, Server } from "lucide-react"
import { TestResultTable } from "./test-result-table"
import { STORAGE_CONNECTIONS_HREF } from "./connection-picker"
import type { UseStorageFormResult } from "./hooks/use-storage-form"

const PROVIDER_LABELS: Record<string, { label: string; icon: typeof Cloud }> = {
  local: { label: "Lokales Dateisystem", icon: FolderOpen },
  onedrive: { label: "Microsoft OneDrive", icon: Cloud },
  nextcloud: { label: "Nextcloud (WebDAV)", icon: Server },
  gdrive: { label: "Google Drive (nicht mehr unterstützt)", icon: Cloud },
}

interface StorageSummaryProps {
  hook: UseStorageFormResult
  /** Startet den Wizard neu (nach D1-Warnung) */
  onChangeStorage: () => void
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  )
}

export function StorageSummary({ hook, onChangeStorage }: StorageSummaryProps) {
  const { activeLibrary, activeConnection, tokenStatus, isTesting, testDialogOpen, setTestDialogOpen, testResults, handleTest } = hook
  if (!activeLibrary) return null

  const type = activeLibrary.type as string
  const provider = PROVIDER_LABELS[type] ?? { label: type, icon: Server }
  const needsReauth = type === "onedrive" && !tokenStatus.loading && !tokenStatus.isAuthenticated

  return (
    <div className="space-y-4">
      {needsReauth && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verbindung nicht angemeldet</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Die Bibliothek kann ohne Anmeldung der Speicher-Verbindung nicht auf OneDrive zugreifen.</span>
            <Button size="sm" asChild className="whitespace-nowrap shrink-0">
              <Link href={STORAGE_CONNECTIONS_HREF}>Zur Anmeldung</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 pb-3 border-b">
            <provider.icon className="h-4 w-4" />
            <span className="font-medium">{provider.label}</span>
            {type === "onedrive" && tokenStatus.isAuthenticated && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                <Check className="h-3.5 w-3.5" /> verbunden
              </span>
            )}
          </div>
          <div className="divide-y">
            {type !== "local" && (
              <SummaryRow label="Speicher-Verbindung" value={activeConnection ? activeConnection.label : "nicht gefunden — bitte neu wählen"} />
            )}
            {activeConnection?.nextcloud && <SummaryRow label="Zugang" value={`${activeConnection.nextcloud.username} · ${activeConnection.nextcloud.webdavUrl}`} />}
            <SummaryRow label="Verzeichnis" value={activeLibrary.path || "/"} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto">
        <Button variant="outline" className="whitespace-nowrap shrink-0" onClick={() => void handleTest()} disabled={isTesting}>
          {isTesting ? "Teste…" : "Verbindung prüfen"}
        </Button>
        {type !== "local" && (
          <Button variant="outline" asChild className="whitespace-nowrap shrink-0">
            <Link href={STORAGE_CONNECTIONS_HREF}>Verbindungen verwalten</Link>
          </Button>
        )}
        {/* D1: Quellen-Wechsel nur mit Warnung */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="ml-auto whitespace-nowrap shrink-0">Quelle ändern…</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quelle wirklich ändern?</AlertDialogTitle>
              <AlertDialogDescription>
                Ihre Dateien werden dabei NICHT verschoben. Wenn die Bibliothek bereits Inhalte hat,
                zeigt sie nach dem Wechsel auf einen anderen Ort — bestehende Verweise können dann ins
                Leere laufen. Führen Sie den Wechsel nur durch, wenn Sie wissen, was Sie tun.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={onChangeStorage}>Wizard starten</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage-Provider Test</DialogTitle>
            <DialogDescription>Test des Storage-Providers für die Bibliothek &quot;{activeLibrary.label}&quot;</DialogDescription>
          </DialogHeader>
          <div className="py-4"><TestResultTable testResults={testResults} /></div>
          <div className="flex justify-end">
            <Button onClick={() => setTestDialogOpen(false)} variant="secondary">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
