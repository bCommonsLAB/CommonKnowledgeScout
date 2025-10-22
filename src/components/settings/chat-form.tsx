"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'

// Zod-Schema für Chat-Konfiguration
const chatFormSchema = z.object({
  public: z.boolean().default(false),
  titleAvatarSrc: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  welcomeMessage: z.string().min(1, "Bitte geben Sie eine Begrüßungsnachricht ein."),
  errorMessage: z.string().optional(),
  placeholder: z.string().optional(),
  maxChars: z.coerce.number().int().positive().max(4000).optional(),
  maxCharsWarningMessage: z.string().optional(),
  footerText: z.string().optional(),
  companyLink: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  features: z.object({
    citations: z.boolean().default(true),
    streaming: z.boolean().default(true),
  }).default({ citations: true, streaming: true }),
  rateLimit: z.object({
    windowSec: z.coerce.number().int().positive().default(60),
    max: z.coerce.number().int().positive().default(30),
  }).optional(),
  vectorStore: z.object({
    indexOverride: z.string().optional(),
  }).optional(),
  gallery: z.object({
    facets: z.array(z.object({
      metaKey: z.string().min(1),
      label: z.string().optional(),
      type: z.enum(["string","number","boolean","string[]","date","integer-range"]).default("string"),
      multi: z.boolean().default(true),
      visible: z.boolean().default(true),
      sort: z.enum(['alpha','count']).optional(),
      max: z.coerce.number().int().positive().optional(),
      columns: z.coerce.number().int().min(1).max(2).optional(),
    })).default([
      { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
      { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
      { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
      { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
      { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
      { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
    ])
  }).optional(),
})

type ChatFormValues = z.infer<typeof chatFormSchema>

export function ChatForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [healthResult, setHealthResult] = useState<{
    ok: boolean;
    indexes?: Array<{ name: string }>;
    expectedIndex?: string;
    exists?: boolean;
    status?: number;
    error?: string;
  } | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatFormSchema),
    defaultValues: {
      public: false,
      titleAvatarSrc: undefined,
      welcomeMessage: "Hallo! Ich bin dein wissensbasierter Chatbot.",
      errorMessage: "Etwas ist schiefgegangen. Versuche es bitte nochmal.",
      placeholder: "Schreibe deine Frage...",
      maxChars: 500,
      maxCharsWarningMessage: "Deine Frage ist zu lang, bitte kürze sie.",
      footerText: "",
      companyLink: undefined,
      features: { citations: true, streaming: true },
      rateLimit: { windowSec: 60, max: 30 },
      vectorStore: { indexOverride: undefined },
      gallery: { facets: [
        { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
        { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
        { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
        { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
        { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
        { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
      ] },
    },
  })

  useEffect(() => {
    if (activeLibrary?.config?.chat) {
      const c = activeLibrary.config.chat as unknown as Record<string, unknown>
      form.reset({
        public: Boolean(c.public ?? false),
        titleAvatarSrc: typeof c.titleAvatarSrc === 'string' ? c.titleAvatarSrc : undefined,
        welcomeMessage: typeof c.welcomeMessage === 'string' && c.welcomeMessage ? c.welcomeMessage : "Hallo! Ich bin dein wissensbasierter Chatbot.",
        errorMessage: typeof c.errorMessage === 'string' ? c.errorMessage : "Etwas ist schiefgegangen. Versuche es bitte nochmal.",
        placeholder: typeof c.placeholder === 'string' ? c.placeholder : "Schreibe deine Frage...",
        maxChars: typeof c.maxChars === 'number' ? c.maxChars : 500,
        maxCharsWarningMessage: typeof c.maxCharsWarningMessage === 'string' ? c.maxCharsWarningMessage : "Deine Frage ist zu lang, bitte kürze sie.",
        footerText: typeof c.footerText === 'string' ? c.footerText : "",
        companyLink: typeof c.companyLink === 'string' ? c.companyLink : undefined,
        features: {
          citations: Boolean((c.features as { citations?: boolean })?.citations ?? true),
          streaming: Boolean((c.features as { streaming?: boolean })?.streaming ?? true),
        },
        rateLimit: {
          windowSec: Number((c.rateLimit as { windowSec?: number })?.windowSec ?? 60),
          max: Number((c.rateLimit as { max?: number })?.max ?? 30),
        },
        vectorStore: {
          indexOverride: typeof (c.vectorStore as { indexOverride?: string })?.indexOverride === 'string'
            ? (c.vectorStore as { indexOverride?: string })!.indexOverride
            : undefined,
        },
        gallery: {
          facets: (() => {
            const raw = (c.gallery as { facets?: unknown } | undefined)?.facets
            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') return raw as Array<Record<string, unknown>>
            if (Array.isArray(raw)) {
              return (raw as Array<unknown>).map(v => String(v)).filter(Boolean).map((k) => (
                k === 'authors' ? { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true }
                : k === 'year' ? { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true }
                : { metaKey: k, label: k, type: 'string', multi: true, visible: true }
              ))
            }
            return [
              { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
              { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
              { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
              { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
              { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
              { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
            ]
          })(),
        },
      })
    }
  }, [activeLibrary, form])

  async function onSubmit(data: ChatFormValues) {
    setIsLoading(true)
    try {
      if (!activeLibrary) throw new Error("Keine Bibliothek ausgewählt")

      // Debug-Output vor dem Speichern
      // eslint-disable-next-line no-console
      console.log('[ChatForm] Speichere Chat-Config …', { libraryId: activeLibrary.id, facets: data.gallery?.facets?.length || 0 })

      // Nur Chat-Config mergen, Server behält restliche Config sicher bei
      const response = await fetch(`/api/libraries/${encodeURIComponent(activeLibrary.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeLibrary.id, config: { chat: data } }),
      })
      const respJson = await response.json().catch(() => ({}))
      // eslint-disable-next-line no-console
      console.log('[ChatForm] PATCH response', { status: response.status, body: respJson })
      if (!response.ok) throw new Error(`Fehler beim Speichern: ${respJson?.error || response.statusText}`)

      const updatedLibraries = libraries.map(lib => lib.id === activeLibrary.id
        ? { ...lib, config: { ...lib.config, chat: data } }
        : lib)
      setLibraries(updatedLibraries)

      toast({ title: "Chat-Einstellungen gespeichert", description: `Library: ${activeLibrary.label}` })
    } catch (error) {
      console.error('Fehler beim Speichern der Chat-Einstellungen:', error)
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
      <div className="text-center text-muted-foreground">Bitte wählen Sie eine Bibliothek aus.</div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="public"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Öffentlich zugänglich</FormLabel>
                  <FormDescription>
                    Wenn aktiviert, kann der Chat ohne Anmeldung verwendet werden (Rate-Limit beachten).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="titleAvatarSrc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://.../avatar.png" {...field} />
                </FormControl>
                <FormDescription>Optionales Avatarbild für die Chat-Ansicht.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="welcomeMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Begrüßung</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Willkommensnachricht..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="errorMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fehlermeldung</FormLabel>
                <FormControl>
                  <Input placeholder="Allgemeine Fehlermeldung..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="placeholder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platzhalter</FormLabel>
                  <FormControl>
                    <Input placeholder="Schreibe deine Frage..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxChars"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Zeichen pro Nachricht</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={4000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="maxCharsWarningMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warnhinweis bei Überschreitung</FormLabel>
                <FormControl>
                  <Input placeholder="Deine Frage ist zu lang, bitte kürze sie." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="footerText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer-Text</FormLabel>
                  <FormControl>
                    <Input placeholder="Powered by ..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer-Link</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.example.org" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="features.citations"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Zitate/Quellen anzeigen</FormLabel>
                    <FormDescription>Quellverweise zu Antworten im Chat einblenden.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features.streaming"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Streaming aktivieren</FormLabel>
                    <FormDescription>Antworten während der Generierung anzeigen.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rateLimit.windowSec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate-Limit Fenster (Sekunden)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rateLimit.max"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Requests pro Fenster</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="vectorStore.indexOverride"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Index-Override (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Standard: Library-Name als Index" {...field} />
                </FormControl>
                <FormDescription>
                  Nur ausfüllen, wenn der Standardindex (Libraryname) nicht verwendet werden soll.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-3">
          <FormLabel>Galerie: Facetten</FormLabel>
          <FormDescription>Definieren Sie beliebige Facetten.</FormDescription>
          <FacetDefsEditor value={form.watch("gallery.facets") || []} onChange={(v) => form.setValue("gallery.facets", v, { shouldDirty: true })} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={async () => {
            setIsChecking(true)
            setHealthError(null)
            setHealthResult(null)
            try {
              const res = await fetch('/api/health/pinecone', { method: 'GET', cache: 'no-store' })
              const data = await res.json()
              if (!res.ok || data?.ok === false) {
                const message = typeof data?.error === 'string' ? data.error : `Fehlerstatus ${res.status}`
                throw new Error(message)
              }
              setHealthResult(data)
              toast({ title: 'Index Status', description: 'Pinecone-Verbindung OK' })
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
              setHealthError(msg)
              toast({ title: 'Fehler', description: msg, variant: 'destructive' })
            } finally {
              setIsChecking(false)
            }
          }}>
            {isChecking ? 'Prüfe...' : 'Index Status prüfen'}
          </Button>
          <Button type="button" variant="outline" onClick={async () => {
            try {
              if (!activeLibrary) throw new Error('Keine Bibliothek ausgewählt')
              const res = await fetch(`/api/chat/${encodeURIComponent(activeLibrary.id)}/index`, { method: 'POST' })
              const data = await res.json()
              if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Anlegen des Index')
              toast({ title: data.status === 'exists' ? 'Index vorhanden' : 'Index angelegt', description: typeof data?.index === 'object' ? JSON.stringify(data.index) : undefined })
            } catch (e) {
              toast({ title: 'Fehler', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
            }
          }}>
            Index anlegen
          </Button>
          <Button type="button" variant="secondary" onClick={async () => {
            try {
              if (!activeLibrary) throw new Error('Keine Bibliothek ausgewählt')
              const res = await fetch(`/api/chat/${encodeURIComponent(activeLibrary.id)}/ingest`, { method: 'POST' })
              if (!res.ok) throw new Error(`Fehler beim Starten der Ingestion: ${res.statusText}`)
              const data = await res.json()
              toast({ title: 'Index-Aufbau gestartet', description: `Job-ID: ${data.jobId}` })
            } catch (e) {
              toast({ title: 'Fehler', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
            }
          }}>
            Index neu aufbauen
          </Button>
          <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>

        {(healthResult || healthError) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-2">Pinecone Health Check</div>
            {healthError ? (
              <div className="text-sm text-destructive">{healthError}</div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap break-words">{healthResult ? JSON.stringify(healthResult, null, 2) : ''}</pre>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}


