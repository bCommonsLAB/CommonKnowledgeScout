"use client"

/**
 * StorageWizard — gefuehrte Speicherort-Einrichtung in 4 Schritten
 * (Welle 3-IV-UX-3b, F1/F3 — Design: docs/settings-ux/05-storage-wizard.md).
 *
 * 1 Provider waehlen → 2 Anmelden → 3 Verzeichnis waehlen → 4 Abschluss-Test.
 * - Lokal ueberspringt Schritt 2; der Pfad wird manuell eingegeben
 *   (kein Listing vor Konfiguration moeglich — dokumentierte Abweichung).
 * - OneDrive: OAuth via handleOneDriveAuth; der Wizard-Zustand wird vor
 *   dem Redirect in sessionStorage gerettet (WIZARD_RESUME_KEY) und von
 *   storage-form.tsx nach der Rueckkehr wiederhergestellt.
 * - Der Wizard endet IMMER mit dem Verbindungstest (Schritt 4); der
 *   fruehere separate "Storage testen"-Button entfaellt im Wizard.
 */

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, ChevronDown, ChevronRight, Cloud, FolderOpen, Loader2, Server } from "lucide-react"
import { TestResultTable } from "./test-result-table"
import { StorageDirectoryPicker } from "./storage-directory-picker"
import { NextcloudSection } from "./nextcloud-section"
import type { UseStorageFormResult } from "./hooks/use-storage-form"

/** sessionStorage-Schluessel fuer die Wizard-Fortsetzung nach OAuth-Redirect */
export const WIZARD_RESUME_KEY = "ks_storage_wizard_resume"

const PROVIDER_OPTIONS = [
  {
    type: "local" as const,
    icon: FolderOpen,
    title: "Lokales Dateisystem",
    description: "Dateien liegen auf dem Computer bzw. Server, auf dem Knowledge Scout läuft.",
  },
  {
    type: "onedrive" as const,
    icon: Cloud,
    title: "Microsoft OneDrive",
    description: "Dateien liegen in Ihrem OneDrive — Anmeldung per Microsoft-Konto.",
  },
  {
    type: "nextcloud" as const,
    icon: Server,
    title: "Nextcloud (WebDAV)",
    description: "Dateien liegen in Ihrer Nextcloud — Zugriff per App-Passwort.",
  },
]

interface StorageWizardProps {
  hook: UseStorageFormResult
  /** Start-Schritt (z.B. 3 nach OAuth-Rueckkehr) */
  initialStep?: number
  /** Wizard abgeschlossen oder abgebrochen → zurueck zur Zusammenfassung */
  onFinished: () => void
  /** Abbrechen erlauben (nur wenn schon ein Speicherort konfiguriert ist) */
  canCancel: boolean
}

export function StorageWizard({ hook, initialStep = 1, onFinished, canCancel }: StorageWizardProps) {
  const {
    form,
    activeLibrary,
    isLoading,
    isTesting,
    testResults,
    tokenStatus,
    onSubmit,
    handleOneDriveAuth,
    handleTest,
  } = hook

  const [step, setStep] = useState(initialStep)
  const [showOwnAppRegistration, setShowOwnAppRegistration] = useState(false)
  const testStartedRef = useRef(false)
  const currentType = form.watch("type")

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

  const hasTestError = testResults.some(r => r.status === "error")
  const testFinished = !isTesting && testResults.length > 0

  /** Schritt 1 → weiter: local ueberspringt das Anmelden */
  const handleProviderNext = () => setStep(currentType === "local" ? 3 : 2)

  /** Nextcloud Schritt 2: Credentials speichern, dann Verzeichnis waehlen */
  const handleNextcloudSave = async () => {
    await onSubmit(form.getValues())
    setStep(3)
  }

  /** OneDrive: Wizard-Zustand retten, dann OAuth-Redirect */
  const handleOneDriveAuthFromWizard = async () => {
    try {
      sessionStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ libraryId: activeLibrary.id, step: 3 }))
    } catch {
      // sessionStorage nicht verfuegbar → Wizard startet nach Rueckkehr bei Schritt 1
    }
    await handleOneDriveAuth()
  }

  /** Schritt 3 → 4: Pfad speichern, dann Pflicht-Test */
  const handlePathSaveAndTest = async () => {
    await onSubmit(form.getValues())
    setStep(4)
  }

  const stepTitles = ["Speicherart", "Anmelden", "Verzeichnis", "Verbindungstest"]

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Stepper-Kopf */}
        <ol className="flex items-center gap-2 text-xs">
          {stepTitles.map((title, idx) => {
            const n = idx + 1
            const isSkipped = n === 2 && currentType === "local"
            const state = n < step ? "done" : n === step ? "active" : "todo"
            return (
              <li key={title} className={`flex items-center gap-1.5 ${isSkipped ? "opacity-40" : ""}`}>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                    state === "done"
                      ? "bg-primary text-primary-foreground border-primary"
                      : state === "active"
                      ? "border-primary text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {state === "done" ? <Check className="h-3 w-3" /> : n}
                </span>
                <span className={state === "active" ? "font-medium" : "text-muted-foreground"}>{title}</span>
                {n < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </li>
            )
          })}
        </ol>

        {/* Schritt 1: Provider */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Wo sollen die Dateien dieser Bibliothek liegen?</p>
            <div className="grid gap-3 md:grid-cols-3">
              {PROVIDER_OPTIONS.map(option => (
                <Card
                  key={option.type}
                  role="button"
                  onClick={() => form.setValue("type", option.type, { shouldDirty: true })}
                  className={`cursor-pointer transition-colors ${
                    currentType === option.type ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <option.icon className="h-4 w-4" /> {option.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{option.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-between">
              {canCancel ? (
                <Button type="button" variant="ghost" onClick={onFinished}>Abbrechen</Button>
              ) : <span />}
              <Button type="button" onClick={handleProviderNext} disabled={!currentType}>
                Weiter
              </Button>
            </div>
          </div>
        )}

        {/* Schritt 2: Anmelden */}
        {step === 2 && currentType === "onedrive" && (
          <div className="space-y-4">
            {tokenStatus.isAuthenticated && !tokenStatus.isExpired ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Bei OneDrive angemeldet</AlertTitle>
                <AlertDescription>Die Verbindung zu Ihrem Microsoft-Konto ist aktiv.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <Cloud className="h-4 w-4" />
                <AlertTitle>Anmeldung erforderlich</AlertTitle>
                <AlertDescription>
                  Sie werden zu Microsoft weitergeleitet und kehren danach automatisch hierher zurück.
                </AlertDescription>
              </Alert>
            )}

            <Button type="button" onClick={() => void handleOneDriveAuthFromWizard()}>
              {tokenStatus.isAuthenticated ? "Erneut bei OneDrive anmelden" : "Bei OneDrive anmelden"}
            </Button>

            {/* Eigene App-Registrierung: Experten-Aufklapper (System-Defaults gelten sonst) */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                onClick={() => setShowOwnAppRegistration(v => !v)}
              >
                {showOwnAppRegistration ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Eigene App-Registrierung (optional, für Experten)
              </button>
              {showOwnAppRegistration && (
                <div className="space-y-4 border-t p-3">
                  <FormField control={form.control} name="tenantId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenant ID</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormDescription>Leer lassen für persönliche Microsoft-Konten.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="clientId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="clientSecret" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl><Input type="password" {...field} value={field.value || ""} /></FormControl>
                      <FormDescription>Wird beim Anmelden automatisch mitgespeichert.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>Zurück</Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                disabled={!tokenStatus.isAuthenticated || tokenStatus.isExpired}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}

        {step === 2 && currentType === "nextcloud" && (
          <div className="space-y-4">
            <NextcloudSection form={form} activeLibrary={activeLibrary} />
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>Zurück</Button>
              <Button type="button" onClick={() => void handleNextcloudSave()} disabled={isLoading}>
                {isLoading ? "Speichert…" : "Verbindung speichern & weiter"}
              </Button>
            </div>
          </div>
        )}

        {/* Schritt 3: Verzeichnis */}
        {step === 3 && (
          <div className="space-y-4">
            {currentType === "local" ? (
              <FormField control={form.control} name="path" render={({ field }) => (
                <FormItem>
                  <FormLabel>Speicherpfad</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="z. B. C:\\KnowledgeScout oder /srv/knowledge" />
                  </FormControl>
                  <FormDescription>
                    Ordner auf dem Rechner, auf dem Knowledge Scout läuft. Er wird beim Test angelegt bzw. geprüft.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie den Ordner, in dem diese Bibliothek arbeiten soll.
                </p>
                <StorageDirectoryPicker
                  libraryId={activeLibrary.id}
                  onPathChange={(p) => form.setValue("path", p, { shouldDirty: true })}
                />
                <FormField control={form.control} name="path" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Pfad (bei Bedarf manuell anpassen)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-8 font-mono text-xs" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(currentType === "local" ? 1 : 2)}>
                Zurück
              </Button>
              <Button type="button" onClick={() => void handlePathSaveAndTest()} disabled={isLoading}>
                {isLoading ? "Speichert…" : "Übernehmen & Verbindung testen"}
              </Button>
            </div>
          </div>
        )}

        {/* Schritt 4: Pflicht-Verbindungstest */}
        {step === 4 && (
          <div className="space-y-4">
            {isTesting && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Verbindung wird getestet…</AlertTitle>
                <AlertDescription>Lesen, Schreiben und Aufräumen werden geprüft.</AlertDescription>
              </Alert>
            )}
            {testFinished && !hasTestError && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Verbindung funktioniert</AlertTitle>
                <AlertDescription>
                  Ihr Speicherort ist eingerichtet. Sie können jetzt Dokumente in die Bibliothek laden.
                </AlertDescription>
              </Alert>
            )}
            {testFinished && hasTestError && (
              <Alert variant="destructive">
                <AlertTitle>Verbindung fehlgeschlagen</AlertTitle>
                <AlertDescription>
                  Bitte prüfen Sie die Details unten — häufigste Ursachen: fehlende Anmeldung oder falsches Verzeichnis.
                </AlertDescription>
              </Alert>
            )}

            <details className="rounded-md border p-3" open={hasTestError}>
              <summary className="cursor-pointer text-sm text-muted-foreground">Technische Details</summary>
              <div className="pt-3">
                <TestResultTable testResults={testResults} />
              </div>
            </details>

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(3)} disabled={isTesting}>
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void handleTest()} disabled={isTesting}>
                  Erneut testen
                </Button>
                <Button type="button" onClick={onFinished} disabled={isTesting || !testFinished || hasTestError}>
                  Fertig
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Form>
  )
}
