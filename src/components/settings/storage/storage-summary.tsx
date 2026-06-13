"use client"

/**
 * StorageSummary — Read-only-Zusammenfassung des eingerichteten
 * Speicherorts (Welle 3-IV-UX-3b, F3).
 *
 * Credentials sind nach der Einrichtung nur noch maskiert sichtbar;
 * Aenderungen laufen ausschliesslich ueber den Wizard. Die fruher
 * stillen Gefahren sind hier abgesichert:
 * - D1: "Speicherort aendern" startet den Wizard erst nach Warnung.
 * - D2: "Abmelden" (OneDrive) verlangt eine Bestaetigung.
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Check, Cloud, FolderOpen, Server } from "lucide-react"
import { TestResultTable } from "./test-result-table"
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
  const {
    activeLibrary,
    tokenStatus,
    isTesting,
    testDialogOpen,
    setTestDialogOpen,
    testResults,
    handleTest,
    handleOneDriveAuth,
    handleOneDriveLogout,
  } = hook

  if (!activeLibrary) return null

  const type = activeLibrary.type as string
  const provider = PROVIDER_LABELS[type] ?? { label: type, icon: Server }
  const nc = activeLibrary.config?.nextcloud as { webdavUrl?: string; username?: string; appPassword?: string } | undefined
  const needsReauth = type === "onedrive" && (!tokenStatus.isAuthenticated || tokenStatus.isExpired)

  return (
    <div className="space-y-4">
      {/* Status-Hinweis bei abgelaufener Anmeldung */}
      {needsReauth && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {tokenStatus.isExpired ? "Anmeldung abgelaufen" : "Nicht angemeldet"}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Die Bibliothek kann ohne Anmeldung nicht auf OneDrive zugreifen.</span>
            <Button size="sm" onClick={() => void handleOneDriveAuth()}>
              Jetzt anmelden
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 pb-3 border-b">
            <provider.icon className="h-4 w-4" />
            <span className="font-medium">{provider.label}</span>
            {type === "onedrive" && tokenStatus.isAuthenticated && !tokenStatus.isExpired && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" /> verbunden
              </span>
            )}
          </div>

          <div className="divide-y">
            <SummaryRow label="Verzeichnis" value={activeLibrary.path || "/"} />
            {type === "onedrive" && (
              <>
                {(activeLibrary.config?.tenantId as string) && (
                  <SummaryRow label="Tenant ID" value={activeLibrary.config?.tenantId as string} />
                )}
                {(activeLibrary.config?.clientId as string) && (
                  <SummaryRow label="Client ID" value={activeLibrary.config?.clientId as string} />
                )}
                {(activeLibrary.config?.clientSecret as string) && (
                  <SummaryRow label="Client Secret" value="••••••••" />
                )}
              </>
            )}
            {type === "nextcloud" && (
              <>
                {nc?.webdavUrl && <SummaryRow label="WebDAV-URL" value={nc.webdavUrl} />}
                {nc?.username && <SummaryRow label="Benutzername" value={nc.username} />}
                {nc?.appPassword && <SummaryRow label="App-Passwort" value="••••••••" />}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void handleTest()} disabled={isTesting}>
          {isTesting ? "Teste…" : "Verbindung prüfen"}
        </Button>

        {type === "onedrive" && tokenStatus.isAuthenticated && !tokenStatus.isExpired && (
          <Button variant="outline" onClick={() => void handleOneDriveAuth()}>
            Neu anmelden
          </Button>
        )}

        {/* D2: Abmelden nur mit Bestaetigung */}
        {type === "onedrive" && tokenStatus.isAuthenticated && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Von OneDrive abmelden</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Von OneDrive abmelden?</AlertDialogTitle>
                <AlertDialogDescription>
                  Die Bibliothek verliert sofort den Zugriff auf ihre Dateien, bis Sie
                  sich erneut anmelden. Es werden keine Daten gelöscht.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleOneDriveLogout()}>
                  Abmelden
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* D1: Quellen-Wechsel nur mit Warnung */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="ml-auto">Quelle ändern…</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quelle wirklich ändern?</AlertDialogTitle>
              <AlertDialogDescription>
                Ihre Dateien werden dabei NICHT verschoben. Wenn die Bibliothek bereits
                Inhalte hat, zeigt sie nach dem Wechsel auf einen anderen Ort — bestehende
                Verweise können dann ins Leere laufen. Führen Sie den Wechsel nur durch,
                wenn Sie wissen, was Sie tun.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={onChangeStorage}>
                Wizard starten
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Test-Ergebnis-Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage-Provider Test</DialogTitle>
            <DialogDescription>
              Test des Storage-Providers für die Bibliothek &quot;{activeLibrary.label}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TestResultTable testResults={testResults} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setTestDialogOpen(false)} variant="secondary">
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
