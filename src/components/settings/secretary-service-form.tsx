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
      coverImagePrompt: '',
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      form.reset({
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || undefined,
        apiKey: activeLibrary.config?.secretaryService?.apiKey || '',
        pdfExtractionMethod: activeLibrary.config?.secretaryService?.pdfDefaults?.extractionMethod || 'mistral_ocr',
        pdfTemplate: activeLibrary.config?.secretaryService?.pdfDefaults?.template || '',
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
            pdfDefaults: {
              extractionMethod: data.pdfExtractionMethod,
              template: data.pdfTemplate?.trim() || undefined,
            },
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
              pdfDefaults: {
                extractionMethod: data.pdfExtractionMethod,
                template: data.pdfTemplate?.trim() || undefined,
              },
              ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
            }
          }
        }
      })
      
      setLibraries(updatedLibraries)
      
      toast({
        title: "Secretary Service Einstellungen aktualisiert",
        description: `Die Secretary Service Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      })
      
    } catch (error) {
      console.error('Fehler beim Speichern der Secretary Service Einstellungen:', error)
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="pdfExtractionMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PDF-Extraktionsmethode (Default)</FormLabel>
                <FormControl>
                  <select className="border rounded h-9 px-2 w-full" value={field.value || ''} onChange={e => field.onChange(e.target.value)}>
                    {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>
                  Standardwert für neue PDF-Verarbeitungsjobs, falls der Client nichts sendet.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pdfTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template (Default, ohne .md)</FormLabel>
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
                            // Zur Liste zurück: wenn der aktuelle Wert nicht in MongoDB ist, leere Auswahl setzen.
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
                  Wird in Phase 2 verwendet, wenn kein Template angegeben ist. Die Liste kommt aus MongoDB (Template-Management).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="coverImagePrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Coverbild-Prompt (Standard)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="z. B. Ich brauche ein Bild für einen Blogartikel einer Klimamassnahme..."
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={e => field.onChange(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </FormControl>
              <FormDescription>
                Standard-Prompt für alle Coverbild-Generierungen in dieser Library. Wird vorangestellt, bevor Title und Teaser hinzugefügt werden.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
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