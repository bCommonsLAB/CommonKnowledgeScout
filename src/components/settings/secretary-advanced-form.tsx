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
import { getDefaultTemplateNameForViewType } from "@/lib/templates/default-templates"
import { checkTemplateConsistency } from "@/lib/templates/template-consistency"

export function SecretaryAdvancedForm() {
  const {
    form,
    activeLibrary,
    isLoading,
    isLoadingTemplates,
    templateMode,
    setTemplateMode,
    mergedTemplateNames,
    hasMongoTemplates,
    templatesMeta,
    libraryViewType,
    isCustomConfig,
    hasCustomApiUrl,
    onSubmit,
  } = useSecretaryServiceForm()

  // Live-Konsistenz der gewaehlten Vorlage (F11)
  const watchedTemplate = (form.watch('pdfTemplate') ?? '').trim()
  const consistency = checkTemplateConsistency({
    templateName: watchedTemplate,
    viewType: libraryViewType,
    knownTemplates: templatesMeta,
  })

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
        {/* ===== Vorlage (Experten-Auswahl, F11) ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Vorlage (Journalist)</h3>
            <p className="text-sm text-muted-foreground">
              Welche Vorlage die Verarbeitung nutzt. „Automatisch“ garantiert
              die zum Inhaltstyp passende Standard-Vorlage — Abweichungen sind
              Experten-Sache und werden beim Speichern geprüft.
            </p>
          </div>

          <FormField
            control={form.control}
            name="pdfTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vorlage</FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-2">
                    {templateMode === 'select' ? (
                      <select
                        className="border rounded h-9 px-2 w-full"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => {
                          const next = e.target.value
                          if (next === '__custom__') {
                            setTemplateMode('custom')
                            return
                          }
                          field.onChange(next)
                        }}
                        disabled={isLoadingTemplates && !hasMongoTemplates}
                      >
                        <option value="">
                          {`Automatisch — Standard für „${libraryViewType}“ (empfohlen)`}
                        </option>
                        {mergedTemplateNames.map((name) => {
                          const meta = templatesMeta.find(
                            (t) => t.name.toLowerCase() === name.toLowerCase()
                          )
                          const suffix = meta?.builtin
                            ? ' (Standard)'
                            : meta?.detailViewType
                            ? meta.detailViewType === libraryViewType
                              ? ' ✓'
                              : ` — Typ: ${meta.detailViewType}`
                            : ''
                          return (
                            <option key={name} value={name}>{`${name}${suffix}`}</option>
                          )
                        })}
                        <option value="__custom__">Benutzerdefiniert…</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="z. B. pdfanalyse-commoning"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const val = (typeof field.value === 'string' ? field.value : '').trim()
                            if (val && !mergedTemplateNames.some((n) => n.toLowerCase() === val.toLowerCase())) {
                              field.onChange('')
                            }
                            setTemplateMode('select')
                          }}
                        >
                          Aus Liste
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Standard-Vorlage des Inhaltstyps: <code>{getDefaultTemplateNameForViewType(libraryViewType)}</code>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Live-Konsistenz-Hinweis (F11) */}
          <p
            className={
              consistency.level === 'error'
                ? 'text-sm text-destructive'
                : consistency.level === 'warn'
                ? 'text-sm text-amber-600 dark:text-amber-400'
                : 'text-sm text-muted-foreground'
            }
          >
            {consistency.message}
          </p>
        </div>

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
