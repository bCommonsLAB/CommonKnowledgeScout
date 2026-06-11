"use client"

/**
 * SecretaryAdvancedForm — Experten-Teil der Transformations-
 * Einstellungen (Bereich "Erweitert", Welle 3-IV-UX-3a, F8).
 *
 * PDF-Extraktionsmethode, LLM-Modell der Transformation und die
 * Service-Verbindung (eigene API-URL/Key, Desktop-Modus).
 * Nutzt useSecretaryServiceForm (siehe Hinweis dort — Submit sendet
 * die vollstaendige secretaryService-Config).
 */

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { LlmModelSelector } from "@/components/ui/llm-model-selector"
import { useSecretaryServiceForm } from "./hooks/use-secretary-service-form"

export function SecretaryAdvancedForm() {
  const {
    form,
    activeLibrary,
    isLoading,
    isCustomConfig,
    hasCustomApiUrl,
    onSubmit,
  } = useSecretaryServiceForm()

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" autoComplete="off">
        {/* ===== Transkription & Modellwahl ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Transkription & Modellwahl</h3>
            <p className="text-sm text-muted-foreground">
              Technische Standardwerte der Verarbeitung — ohne Änderung gelten
              sinnvolle Defaults.
            </p>
          </div>

          <FormField
            control={form.control}
            name="pdfExtractionMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PDF-Extraktionsmethode</FormLabel>
                <FormControl>
                  <select className="border rounded h-9 px-2 w-full" value={field.value || ''} onChange={e => field.onChange(e.target.value)}>
                    {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>
                  Standardmethode für die Text-Extraktion aus PDF-Dokumenten.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="templateLlmModel"
            render={({ field }) => (
              <FormItem>
                <LlmModelSelector
                  value={field.value || ''}
                  onChange={(v) => field.onChange(v)}
                  label="LLM-Modell (Transformation)"
                  placeholder="(kein Default)"
                  description="Das LLM-Modell, das für die Template-Transformation verwendet wird."
                  variant="form"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ===== Secretary Service Einstellungen ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Secretary Service Einstellungen</h3>
            <p className="text-sm text-muted-foreground">
              Verbindungseinstellungen zum Transformations-Backend.
            </p>
          </div>

          {/* Toggle: Standard (ENV) vs. Benutzerdefiniert */}
          <FormField
            control={form.control}
            name="useCustomConfig"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Benutzerdefinierte Verbindung
                  </FormLabel>
                  <FormDescription>
                    {field.value
                      ? 'Eigene API-URL und API-Key werden verwendet.'
                      : 'Standard-Verbindung über Umgebungsvariablen.'}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Verbindungsfelder: nur sichtbar wenn benutzerdefiniert aktiv */}
          {isCustomConfig && (
            <>
              <FormField
                control={form.control}
                name="apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API-URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://secretaryservices.example.com/api"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={e => field.onChange(e.target.value)}
                        autoComplete="off"
                        name="sec-api-url"
                        spellCheck={false}
                        autoCapitalize="none"
                        inputMode="url"
                      />
                    </FormControl>
                    <FormDescription>
                      URL des Secretary Service (z.&nbsp;B. https://secretaryservices.example.com/api).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API-Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="API-Key für die Authentifizierung"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={e => field.onChange(e.target.value)}
                        autoComplete="new-password"
                        name="sec-api-key"
                        spellCheck={false}
                        autoCapitalize="none"
                        inputMode="text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Desktop-Modus: nur anzeigen, wenn eine eigene API-URL konfiguriert ist */}
              {hasCustomApiUrl && (
                <FormField
                  control={form.control}
                  name="useDirectConnection"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Desktop-Modus
                        </FormLabel>
                        <FormDescription>
                          Aktivieren, wenn der Secretary Service diese Anwendung nicht über das Netzwerk erreichen kann
                          (z.&nbsp;B. lokale Installation oder Firewall). Ergebnisse werden dann aktiv abgeholt statt
                          per Rückmeldung zugestellt.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isDirty}
          >
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
