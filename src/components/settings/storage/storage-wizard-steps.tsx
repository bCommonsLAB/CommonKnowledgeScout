"use client"

/**
 * Einzelne Schritte des Quellen-Wizards (Archive · 1 Quelle), aus
 * storage-wizard.tsx herausgeloest (200-Zeilen-Regel): Verzeichnis waehlen
 * und Pflicht-Verbindungstest.
 */

import {
  Alert, AlertDescription, AlertTitle, Button,
  FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input,
} from '@ks/ui'
import { Check, Loader2 } from "lucide-react"
import { TestResultTable } from "./test-result-table"
import { StorageDirectoryPicker } from "./storage-directory-picker"
import type { UseStorageFormResult } from "./hooks/use-storage-form"

interface StepProps {
  hook: UseStorageFormResult
  onBack: () => void
}

/** Schritt 3: Verzeichnis — lokal als Pfad, sonst ueber das Listing der Verbindung. */
export function DirectoryStep({ hook, onBack, onNext }: StepProps & { onNext: () => void }) {
  const { form, activeLibrary, isLoading, currentType } = hook
  if (!activeLibrary) return null
  return (
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
          <p className="text-sm text-muted-foreground">Wählen Sie den Ordner, in dem diese Bibliothek arbeiten soll.</p>
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
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" className="whitespace-nowrap" onClick={onBack}>Zurück</Button>
        <Button type="button" className="whitespace-nowrap" onClick={onNext} disabled={isLoading}>
          {isLoading ? "Speichert…" : "Übernehmen & testen"}
        </Button>
      </div>
    </div>
  )
}

/** Schritt 4: Pflicht-Verbindungstest; erst grün = fertig. */
export function TestStep({ hook, onBack, onFinished }: StepProps & { onFinished: () => void }) {
  const { isTesting, testResults, handleTest } = hook
  const hasTestError = testResults.some(r => r.status === "error")
  const testFinished = !isTesting && testResults.length > 0
  return (
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
          <AlertDescription>Ihre Quelle ist eingerichtet. Sie können jetzt Dokumente in die Bibliothek laden.</AlertDescription>
        </Alert>
      )}
      {testFinished && hasTestError && (
        <Alert variant="destructive">
          <AlertTitle>Verbindung fehlgeschlagen</AlertTitle>
          <AlertDescription>
            Bitte prüfen Sie die Details unten — häufigste Ursachen: Verbindung nicht angemeldet oder falsches Verzeichnis.
          </AlertDescription>
        </Alert>
      )}
      <details className="rounded-md border p-3" open={hasTestError}>
        <summary className="cursor-pointer text-sm text-muted-foreground">Technische Details</summary>
        <div className="pt-3"><TestResultTable testResults={testResults} /></div>
      </details>
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" className="whitespace-nowrap" onClick={onBack} disabled={isTesting}>Zurück</Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => void handleTest()} disabled={isTesting}>
            Erneut testen
          </Button>
          <Button type="button" className="whitespace-nowrap" onClick={onFinished} disabled={isTesting || !testFinished || hasTestError}>
            Fertig
          </Button>
        </div>
      </div>
    </div>
  )
}
