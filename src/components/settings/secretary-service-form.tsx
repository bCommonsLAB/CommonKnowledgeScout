"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState, useEffect } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { mergeTemplateNames } from "@/lib/templates/template-options"
import { LlmModelSelector } from "@/components/ui/llm-model-selector"

// Formular-Schema mit Validierung
const secretaryServiceFormSchema = z.object({
  // Optional: Wenn gesetzt, muss es eine gültige URL sein
  apiUrl: z.string().url({ message: "Bitte geben Sie eine gültige URL ein." }).optional(),
  // Optional: Leer lassen → ENV verwenden
  apiKey: z.string().optional(),
  pdfExtractionMethod: z.enum([
    'native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'
  ]).optional(),
  pdfTemplate: z.string().optional(),
  /** Standard-LLM-Modell für Template-Transformation */
  templateLlmModel: z.string().optional(),
  /** Standard-Zielsprache für Transformation */
  targetLanguage: z.enum(['de', 'en']).optional(),
  /** Automatisch Cover-Bild bei Transformation generieren */
  generateCoverImage: z.boolean().optional(),
  coverImagePrompt: z.string().optional(),
})

type SecretaryServiceFormValues = z.infer<typeof secretaryServiceFormSchema>

export function SecretaryServiceForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [availableTemplateNames, setAvailableTemplateNames] = useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  
  const form = useForm<SecretaryServiceFormValues>({
    resolver: zodResolver(secretaryServiceFormSchema),
    defaultValues: {
      apiUrl: undefined,
      apiKey: '',
      pdfExtractionMethod: 'native',
      pdfTemplate: '',
      templateLlmModel: '',
      targetLanguage: 'de',
      generateCoverImage: false,
      coverImagePrompt: '',
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      // generateCoverImage: Lese aus secretaryService (chat-Fallback entfernt, da nicht im Typ)
      const generateCoverImage = 
        typeof activeLibrary.config?.secretaryService?.generateCoverImage === 'boolean'
          ? activeLibrary.config.secretaryService.generateCoverImage
          : false
      
      // targetLanguage: Lese aus secretaryService oder chat (Rückwärtskompatibilität)
      const targetLanguage = 
        activeLibrary.config?.secretaryService?.targetLanguage ||
        activeLibrary.config?.chat?.targetLanguage ||
        'de'
      
      form.reset({
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || undefined,
        apiKey: activeLibrary.config?.secretaryService?.apiKey || '',
        pdfExtractionMethod: activeLibrary.config?.secretaryService?.pdfExtractionMethod || 'mistral_ocr',
        pdfTemplate: activeLibrary.config?.secretaryService?.template || '',
        templateLlmModel: activeLibrary.config?.secretaryService?.llmModel || '',
        targetLanguage: targetLanguage as 'de' | 'en',
        generateCoverImage,
        coverImagePrompt: activeLibrary.config?.secretaryService?.coverImagePrompt || '',
      })
    }
  }, [activeLibrary, form])

  const currentPdfTemplate = form.watch('pdfTemplate')
  const mergedTemplateNames = mergeTemplateNames({
    templateNames: availableTemplateNames,
    currentTemplateName: currentPdfTemplate,
  })

  const hasMongoTemplates = mergedTemplateNames.length > 0
  const isCurrentTemplateInMongo = !!(currentPdfTemplate || '').trim() && mergedTemplateNames.some(
    (n) => n.toLowerCase() === (currentPdfTemplate || '').trim().toLowerCase()
  )
  const [templateMode, setTemplateMode] = useState<'select' | 'custom'>('select')

  // Wenn die Config einen Wert hat, der (noch) nicht in MongoDB existiert, zeige Custom-Input an.
  useEffect(() => {
    const val = (currentPdfTemplate || '').trim()
    if (!val) {
      setTemplateMode('select')
      return
    }
    setTemplateMode(isCurrentTemplateInMongo ? 'select' : 'custom')
  }, [currentPdfTemplate, isCurrentTemplateInMongo])

  // Templates aus MongoDB laden (für Dropdown)
  useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return
        setIsLoadingTemplates(true)
        const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibraryId)}`)
        if (!response.ok) {
          // Fehler still behandeln: Dropdown bleibt leer, Custom-Input bleibt nutzbar
          if (!cancelled) setAvailableTemplateNames([])
          return
        }
        const data = await response.json()
        const templates = Array.isArray((data as { templates?: unknown }).templates)
          ? (data as { templates: Array<{ name?: unknown }> }).templates
          : []
        const names = templates
          .map((t) => (typeof t?.name === 'string' ? t.name : ''))
          .filter((n) => n.length > 0)
        if (!cancelled) setAvailableTemplateNames(names)
      } catch {
        if (!cancelled) setAvailableTemplateNames([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => { cancelled = true }
  }, [activeLibraryId])

  async function onSubmit(data: SecretaryServiceFormValues) {
    setIsLoading(true)
    
    try {
      if (!activeLibrary) {
        throw new Error("Keine Bibliothek ausgewählt")
      }
      
      // Bibliotheksobjekt aktualisieren
      const updatedLibrary = {
        ...activeLibrary,
        config: {
          ...activeLibrary.config,
          secretaryService: {
            ...(data.apiUrl ? { apiUrl: data.apiUrl } : {}),
            ...(data.apiKey ? { apiKey: data.apiKey } : {}),
            // Phase 1: Transkription
            pdfExtractionMethod: data.pdfExtractionMethod,
            // Phase 2: Transformation
            template: data.pdfTemplate?.trim() || undefined,
            llmModel: data.templateLlmModel?.trim() || undefined,
            targetLanguage: data.targetLanguage || 'de',
            generateCoverImage: data.generateCoverImage ?? false,
            ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
          }
        }
      }
      
      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedLibrary),
      })
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`)
      }
      
      // Lokalen Zustand aktualisieren
      const updatedLibraries: typeof libraries = libraries.map(lib => {
        if (lib.id !== activeLibrary.id) return lib
        return {
          ...lib,
          config: {
            ...lib.config,
            secretaryService: {
              // Fülle optionale Felder defensiv mit leerem String, damit der Client-Typ stimmt
              apiUrl: data.apiUrl || lib.config?.secretaryService?.apiUrl || '',
              apiKey: data.apiKey || lib.config?.secretaryService?.apiKey || '',
              // Phase 1: Transkription
              pdfExtractionMethod: data.pdfExtractionMethod,
              // Phase 2: Transformation
              template: data.pdfTemplate?.trim() || undefined,
              llmModel: data.templateLlmModel?.trim() || undefined,
              targetLanguage: data.targetLanguage || 'de',
              generateCoverImage: data.generateCoverImage ?? false,
              ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
            }
          }
        }
      })
      
      setLibraries(updatedLibraries)
      
      toast({
        title: "Transformations-Einstellungen aktualisiert",
        description: `Die Transformations-Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      })
      
    } catch (error) {
      console.error('Fehler beim Speichern der Transformations-Einstellungen:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
        {/* ===== Phase 1: Transkription ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Phase 1: Transkription</h3>
            <p className="text-sm text-muted-foreground">
              Extrahiert Text aus PDF-Dokumenten und anderen Medien.
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
        </div>

        {/* ===== Phase 2: Transformation ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Phase 2: Transformation</h3>
            <p className="text-sm text-muted-foreground">
              Wandelt extrahierten Text mittels LLM und Template in strukturierte Inhalte um.
            </p>
          </div>

          {/* Template-Auswahl */}
          <FormField
            control={form.control}
            name="pdfTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template</FormLabel>
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
                        <option value="">{isLoadingTemplates ? 'Lade Templates…' : '(kein Default)'}</option>
                        {mergedTemplateNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
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
                  Standard-Template für die Transformation. Definiert die Ausgabestruktur.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* LLM-Modell */}
          <FormField
            control={form.control}
            name="templateLlmModel"
            render={({ field }) => (
              <FormItem>
                <LlmModelSelector
                  value={field.value || ''}
                  onChange={(v) => field.onChange(v)}
                  label="LLM-Modell"
                  placeholder="(kein Default)"
                  description="Das LLM-Modell, das für die Template-Transformation verwendet wird."
                  variant="form"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Zielsprache */}
          <FormField
            control={form.control}
            name="targetLanguage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zielsprache</FormLabel>
                <FormControl>
                  <select 
                    className="border rounded h-9 px-2 w-full" 
                    value={field.value || 'de'} 
                    onChange={e => field.onChange(e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </FormControl>
                <FormDescription>
                  Sprache, in der die transformierten Inhalte generiert werden.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cover-Bild automatisch generieren */}
          <FormField
            control={form.control}
            name="generateCoverImage"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-row items-center gap-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value || false}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Cover-Bild automatisch generieren</FormLabel>
                </div>
                <FormDescription>
                  Bei Transformation automatisch ein Cover-Bild erstellen.
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Coverbild-Prompt */}
          <FormField
            control={form.control}
            name="coverImagePrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coverbild-Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="z. B. Erstelle ein Bild für: {{title}}..."
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={e => field.onChange(e.target.value)}
                    rows={3}
                    className="font-mono text-sm"
                  />
                </FormControl>
                <FormDescription>
                  Prompt-Vorlage für die Bildgenerierung. Variablen: {`{{title}}`}, {`{{summary}}`}
                </FormDescription>
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
          <FormField
            control={form.control}
            name="apiUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API-URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="http://127.0.0.1:5001/api (optional)"
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
                  Optional. Leer lassen, um die Umgebungsvariable zu verwenden.
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
                    placeholder="(optional) API-Key oder leer für ENV"
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={e => field.onChange(e.target.value)}
                    autoComplete="new-password"
                    name="sec-api-key"
                    spellCheck={false}
                    autoCapitalize="none"
                    inputMode="text"
                  />
                </FormControl>
                <FormDescription>
                  Optional. Leer lassen, um den API-Key aus der Umgebungsvariable zu verwenden.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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