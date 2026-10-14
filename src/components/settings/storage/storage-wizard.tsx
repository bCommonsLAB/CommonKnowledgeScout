"use client"

/**
 * StorageWizard — gefuehrte Einrichtung der Quelle in 4 Schritten
 * (Welle 3-IV-UX-3b, F1/F3; seit Teil A des Plans
 * speicher-verbindungen-und-library-anlage auf Speicher-Verbindungen umgestellt).
 *
 * 1 Typ waehlen → 2 Verbindung waehlen → 3 Verzeichnis waehlen → 4 Abschluss-Test.
 * - Lokal ueberspringt Schritt 2 (kein Geheimnis, Owner-Entscheid E1).
 * - Zugangsdaten und OneDrive-Anmeldung liegen an der Verbindung (Mein Konto
 *   → Speicher-Verbindungen); hier wird nur noch gewaehlt.
 */

import { useEffect, useRef, useState } from "react"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Form, FormMessage } from '@ks/ui'
import { Check, ChevronRight, Cloud, FolderOpen, Server } from "lucide-react"
import { ConnectionPicker } from "./connection-picker"
import { DirectoryStep, TestStep } from "./storage-wizard-steps"
import type { UseStorageFormResult } from "./hooks/use-storage-form"

const PROVIDER_OPTIONS = [
  { type: "local" as const, icon: FolderOpen, title: "Lokales Dateisystem", description: "Dateien liegen auf dem Computer bzw. Server, auf dem Knowledge Scout läuft." },
  { type: "onedrive" as const, icon: Cloud, title: "Microsoft OneDrive", description: "Dateien liegen in Ihrem OneDrive — über eine Speicher-Verbindung Ihres Kontos." },
  { type: "nextcloud" as const, icon: Server, title: "Nextcloud (WebDAV)", description: "Dateien liegen in Ihrer Nextcloud — über eine Speicher-Verbindung Ihres Kontos." },
]

const STEP_TITLES = ["Quelle", "Verbindung", "Verzeichnis", "Verbindungstest"]

interface StorageWizardProps {
  hook: UseStorageFormResult
  /** Wizard abgeschlossen oder abgebrochen → zurueck zur Zusammenfassung */
  onFinished: () => void
  /** Abbrechen erlauben (nur wenn schon eine Quelle eingerichtet ist) */
  canCancel: boolean
}

export function StorageWizard({ hook, onFinished, canCancel }: StorageWizardProps) {
  const { form, activeLibrary, isLoading, connections, connectionsError, activeConnection, onSubmit, handleTest } = hook
  const [step, setStep] = useState(1)
  const testStartedRef = useRef(false)
  const currentType = form.watch("type")
  const connectionId = form.watch("storageConnectionId") ?? ""

  // Schritt 4: Verbindungstest automatisch starten (einmal pro Betreten)
  useEffect(() => {
    if (step === 4 && !testStartedRef.current) {
      testStartedRef.current = true
      void handleTest()
    }
    if (step !== 4) testStartedRef.current = false
  }, [step, handleTest])

  if (!activeLibrary) {
    return <div className="text-center text-muted-foreground">Keine Bibliothek ausgewählt.</div>
  }

  const isLocal = currentType === "local"
  const onedriveOhneLogin = currentType === "onedrive" && activeConnection !== null && activeConnection.onedrive?.loggedIn !== true

  /** Speichern und weiter; bricht ab, wenn onSubmit einen Feldfehler setzt. */
  const saveAndGo = async (next: number) => {
    await onSubmit(form.getValues())
    if (!form.formState.errors.storageConnectionId) setStep(next)
  }

  return (
    <Form {...form}>
      <div className="space-y-6">
        <ol className="flex items-center gap-2 overflow-x-auto text-xs">
          {STEP_TITLES.map((title, idx) => {
            const n = idx + 1
            const state = n < step ? "done" : n === step ? "active" : "todo"
            return (
              <li key={title} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap ${n === 2 && isLocal ? "opacity-40" : ""}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  state === "done" ? "bg-primary text-primary-foreground border-primary" : state === "active" ? "border-primary text-primary font-semibold" : "text-muted-foreground"
                }`}>
                  {state === "done" ? <Check className="h-3 w-3" /> : n}
                </span>
                <span className={state === "active" ? "font-medium" : "text-muted-foreground"}>{title}</span>
                {n < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </li>
            )
          })}
        </ol>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Woher kommen die Dokumente dieser Bibliothek?</p>
            <div className="grid gap-3 md:grid-cols-3">
              {PROVIDER_OPTIONS.map(option => (
                <Card
                  key={option.type}
                  role="button"
                  onClick={() => form.setValue("type", option.type, { shouldDirty: true })}
                  className={`cursor-pointer transition-colors ${currentType === option.type ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><option.icon className="h-4 w-4" /> {option.title}</CardTitle>
                  </CardHeader>
                  <CardContent><CardDescription>{option.description}</CardDescription></CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              {canCancel ? <Button type="button" variant="ghost" className="whitespace-nowrap" onClick={onFinished}>Abbrechen</Button> : <span />}
              <Button type="button" className="whitespace-nowrap" onClick={() => setStep(isLocal ? 3 : 2)} disabled={!currentType}>Weiter</Button>
            </div>
          </div>
        )}

        {step === 2 && (currentType === "nextcloud" || currentType === "onedrive") && (
          <div className="space-y-4">
            <ConnectionPicker
              type={currentType}
              connections={connections}
              error={connectionsError}
              value={connectionId}
              onChange={(id) => form.setValue("storageConnectionId", id, { shouldDirty: true })}
            />
            <FormMessage>{form.formState.errors.storageConnectionId?.message}</FormMessage>
            {onedriveOhneLogin && (
              <p className="text-sm text-destructive">
                Diese Verbindung ist noch nicht bei Microsoft angemeldet — bitte unter &bdquo;Verbindungen verwalten&ldquo; anmelden.
              </p>
            )}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" className="whitespace-nowrap" onClick={() => setStep(1)}>Zurück</Button>
              <Button type="button" className="whitespace-nowrap" onClick={() => void saveAndGo(3)} disabled={isLoading || connectionId === "" || onedriveOhneLogin}>
                {isLoading ? "Speichert…" : "Verbindung übernehmen & weiter"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && <DirectoryStep hook={hook} onBack={() => setStep(isLocal ? 1 : 2)} onNext={() => void saveAndGo(4)} />}
        {step === 4 && <TestStep hook={hook} onBack={() => setStep(3)} onFinished={onFinished} />}
      </div>
    </Form>
  )
}
