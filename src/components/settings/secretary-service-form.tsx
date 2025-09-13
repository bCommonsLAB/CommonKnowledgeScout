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
import { toast } from "@/components/ui/use-toast"

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
})

type SecretaryServiceFormValues = z.infer<typeof secretaryServiceFormSchema>

export function SecretaryServiceForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  
  const form = useForm<SecretaryServiceFormValues>({
    resolver: zodResolver(secretaryServiceFormSchema),
    defaultValues: {
      apiUrl: undefined,
      apiKey: '',
      pdfExtractionMethod: 'native',
      pdfTemplate: '',
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      form.reset({
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || undefined,
        apiKey: activeLibrary.config?.secretaryService?.apiKey || '',
        pdfExtractionMethod: activeLibrary.config?.secretaryService?.pdfDefaults?.extractionMethod || 'native',
        pdfTemplate: activeLibrary.config?.secretaryService?.pdfDefaults?.template || '',
      })
    }
  }, [activeLibrary, form])

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
            }
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
              }
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
                  <Input placeholder="pdfanalyse" {...field} />
                </FormControl>
                <FormDescription>
                  Wird in Phase 2 verwendet, wenn kein Template angegeben ist.
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