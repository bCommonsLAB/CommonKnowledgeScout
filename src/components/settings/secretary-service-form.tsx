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
  apiUrl: z.string().url({
    message: "Bitte geben Sie eine gültige URL ein.",
  }),
  apiKey: z.string().min(1, {
    message: "Der API-Key ist erforderlich.",
  }),
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
      apiUrl: "http://127.0.0.1:5001/api",
      apiKey: "",
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      form.reset({
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || "http://127.0.0.1:5001/api",
        apiKey: activeLibrary.config?.secretaryService?.apiKey || "",
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
            apiUrl: data.apiUrl,
            apiKey: data.apiKey,
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
      const updatedLibraries = libraries.map(lib => 
        lib.id === activeLibrary.id ? {
          ...lib,
          config: {
            ...lib.config,
            secretaryService: {
              apiUrl: data.apiUrl,
              apiKey: data.apiKey,
            }
          }
        } : lib
      )
      
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="apiUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API-URL</FormLabel>
              <FormControl>
                <Input placeholder="http://127.0.0.1:5001/api" {...field} />
              </FormControl>
              <FormDescription>
                Die Basis-URL des Common Secretary Service.
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
                <Input type="password" placeholder="Ihr API-Key" {...field} />
              </FormControl>
              <FormDescription>
                Der API-Key für die Authentifizierung beim Common Secretary Service.
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