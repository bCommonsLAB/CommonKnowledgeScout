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
import { toast } from "@/components/ui/use-toast"
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TARGET_LANGUAGE_ZOD_ENUM,
  TARGET_LANGUAGE_DEFAULT,
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_LABELS,
  CHARACTER_ZOD_ENUM,
  CHARACTER_DEFAULT,
  CHARACTER_VALUES,
  CHARACTER_LABELS,
  SOCIAL_CONTEXT_ZOD_ENUM,
  SOCIAL_CONTEXT_DEFAULT,
  SOCIAL_CONTEXT_VALUES,
  SOCIAL_CONTEXT_LABELS,
  isValidSocialContext,
  isValidCharacter,
  isValidTargetLanguage,
} from '@/lib/chat/constants'

// Zod-Schema für Chat-Konfiguration
const chatFormSchema = z.object({
  placeholder: z.string().optional(),
  maxChars: z.coerce.number().int().positive().max(4000).optional(),
  maxCharsWarningMessage: z.string().optional(),
  footerText: z.string().optional(),
  companyLink: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  vectorStore: z.object({
    indexOverride: z.string().optional(),
  }).optional(),
  targetLanguage: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return TARGET_LANGUAGE_DEFAULT
      return val
    },
    TARGET_LANGUAGE_ZOD_ENUM.default(TARGET_LANGUAGE_DEFAULT)
  ),
  character: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return CHARACTER_DEFAULT
      return val
    },
    CHARACTER_ZOD_ENUM.default(CHARACTER_DEFAULT)
  ),
  socialContext: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return SOCIAL_CONTEXT_DEFAULT
      return val
    },
    SOCIAL_CONTEXT_ZOD_ENUM.default(SOCIAL_CONTEXT_DEFAULT)
  ),
  gallery: z.object({
    detailViewType: z.preprocess(
      (val) => {
        // Konvertiere leere Strings und undefined zu 'book'
        if (val === '' || val === undefined || val === null) return 'book';
        return val;
      },
      z.enum(['book', 'session']).default('book')
    ),
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
    ok?: boolean;
    indexes?: Array<{ name: string }>;
    expectedIndex?: string;
    expectedIndexName?: string;
    exists?: boolean;
    status?: number | { state?: string };
    error?: string;
    vectorCount?: number;
    dimension?: number;
  } | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatFormSchema),
    mode: 'onChange', // Echtzeit-Validierung aktivieren
    defaultValues: {
      placeholder: "Schreibe deine Frage...",
      maxChars: 500,
      maxCharsWarningMessage: "Deine Frage ist zu lang, bitte kürze sie.",
      footerText: "",
      companyLink: undefined,
      vectorStore: { indexOverride: undefined },
      targetLanguage: TARGET_LANGUAGE_DEFAULT,
      character: CHARACTER_DEFAULT,
      socialContext: SOCIAL_CONTEXT_DEFAULT,
      gallery: { 
        detailViewType: 'book',
        facets: [
          { metaKey: 'authors', label: 'Authors', type: 'string[]', multi: true, visible: true },
          { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
          { metaKey: 'region', label: 'Region', type: 'string', multi: true, visible: true },
          { metaKey: 'docType', label: 'DocType', type: 'string', multi: true, visible: true },
          { metaKey: 'source', label: 'Source', type: 'string', multi: true, visible: true },
          { metaKey: 'tags', label: 'Tags', type: 'string[]', multi: true, visible: true },
        ] 
      },
    },
  })

  useEffect(() => {
    if (activeLibrary?.config?.chat) {
      const c = activeLibrary.config.chat as unknown as Record<string, unknown>
      
      // Debug: Zeige VOLLSTÄNDIGE geladene Library
      console.log('[ChatForm] ===== LIBRARY LADEN START =====');
      console.log('[ChatForm] Active Library ID:', activeLibrary.id);
      console.log('[ChatForm] Active Library Label:', activeLibrary.label);
      console.log('[ChatForm] Full Config.Chat:', JSON.stringify(c, null, 2));
      console.log('[ChatForm] Neue Chat-Config-Felder:', {
        targetLanguage: c.targetLanguage,
        character: c.character,
        socialContext: c.socialContext,
      });
      
      // Debug: Zeige geladene Config
      console.log('[ChatForm] Lade Config aus Library:', {
        libraryId: activeLibrary.id,
        galleryConfig: JSON.stringify(c.gallery),
        detailViewType: (c.gallery as { detailViewType?: unknown })?.detailViewType
      })
      
      const galleryConfig = c.gallery as { detailViewType?: unknown; facets?: unknown } | undefined
      const detailViewType = galleryConfig?.detailViewType
      
      // Explizite Prüfung und Logging
      let finalViewType: 'book' | 'session' = 'book'
      if (detailViewType === 'session') {
        finalViewType = 'session'
        console.log('[ChatForm] ✅ Setze detailViewType auf: session')
      } else if (detailViewType === 'book') {
        finalViewType = 'book'
        console.log('[ChatForm] ✅ Setze detailViewType auf: book')
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter detailViewType:', detailViewType, '- verwende default: book')
      }
      
      // Explizite Prüfung für targetLanguage
      let finalTargetLanguage: typeof TARGET_LANGUAGE_DEFAULT = TARGET_LANGUAGE_DEFAULT
      const targetLanguageVal = c.targetLanguage
      if (isValidTargetLanguage(targetLanguageVal)) {
        finalTargetLanguage = targetLanguageVal
        console.log('[ChatForm] ✅ Setze targetLanguage auf:', finalTargetLanguage)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter targetLanguage:', targetLanguageVal, '- verwende default:', TARGET_LANGUAGE_DEFAULT)
      }
      
      // Explizite Prüfung für character
      let finalCharacter: typeof CHARACTER_DEFAULT = CHARACTER_DEFAULT
      const characterVal = c.character
      if (isValidCharacter(characterVal)) {
        finalCharacter = characterVal
        console.log('[ChatForm] ✅ Setze character auf:', finalCharacter)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter character:', characterVal, '- verwende default:', CHARACTER_DEFAULT)
      }
      
      // Explizite Prüfung für socialContext
      let finalSocialContext: typeof SOCIAL_CONTEXT_DEFAULT = SOCIAL_CONTEXT_DEFAULT
      const socialContextVal = c.socialContext
      if (isValidSocialContext(socialContextVal)) {
        finalSocialContext = socialContextVal
        console.log('[ChatForm] ✅ Setze socialContext auf:', finalSocialContext)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter socialContext:', socialContextVal, '- verwende default:', SOCIAL_CONTEXT_DEFAULT)
      }
      
      form.reset({
        placeholder: typeof c.placeholder === 'string' ? c.placeholder : "Schreibe deine Frage...",
        maxChars: typeof c.maxChars === 'number' ? c.maxChars : 500,
        maxCharsWarningMessage: typeof c.maxCharsWarningMessage === 'string' ? c.maxCharsWarningMessage : "Deine Frage ist zu lang, bitte kürze sie.",
        footerText: typeof c.footerText === 'string' ? c.footerText : "",
        companyLink: typeof c.companyLink === 'string' ? c.companyLink : undefined,
        vectorStore: {
          indexOverride: typeof (c.vectorStore as { indexOverride?: string })?.indexOverride === 'string'
            ? (c.vectorStore as { indexOverride?: string })!.indexOverride
            : undefined,
        },
        targetLanguage: finalTargetLanguage,
        character: finalCharacter,
        socialContext: finalSocialContext,
        gallery: {
          detailViewType: finalViewType,
          facets: (() => {
            const raw = galleryConfig?.facets
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
      
      // Nach dem Reset nochmal prüfen
      const afterResetValue = form.getValues('gallery.detailViewType')
      console.log('[ChatForm] Form nach reset:', {
        detailViewType: afterResetValue,
        type: typeof afterResetValue,
        allGalleryValues: form.getValues('gallery')
      })
    }
  }, [activeLibrary, form])

  async function onSubmit(data: ChatFormValues) {
    console.log('[ChatForm] ✅ onSubmit wurde aufgerufen!')
    console.log('[ChatForm] Form Errors:', form.formState.errors)
    console.log('[ChatForm] Form isValid:', form.formState.isValid)
    
    setIsLoading(true)
    try {
      if (!activeLibrary) throw new Error("Keine Bibliothek ausgewählt")

      // Debug-Output vor dem Speichern
      // eslint-disable-next-line no-console
      console.log('[ChatForm] Speichere Chat-Config …', { 
        libraryId: activeLibrary.id, 
        facets: data.gallery?.facets?.length || 0,
        detailViewType: data.gallery?.detailViewType,
        fullGallery: data.gallery 
      })

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

        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="targetLanguage"
              render={({ field }) => {
                const currentValue = field.value || TARGET_LANGUAGE_DEFAULT
                return (
                  <FormItem>
                    <FormLabel>Zielsprache</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (TARGET_LANGUAGE_VALUES.includes(value as typeof TARGET_LANGUAGE_VALUES[number])) {
                        field.onChange(value)
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TARGET_LANGUAGE_VALUES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {TARGET_LANGUAGE_LABELS[lang]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Sprache, in der der Chat antwortet.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="character"
              render={({ field }) => {
                const currentValue = field.value || CHARACTER_DEFAULT
                return (
                  <FormItem>
                    <FormLabel>Charakter/Perspektive</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (CHARACTER_VALUES.includes(value as typeof CHARACTER_VALUES[number])) {
                        field.onChange(value)
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CHARACTER_VALUES.map((char) => (
                          <SelectItem key={char} value={char}>
                            {CHARACTER_LABELS[char]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Perspektive, aus der Antworten formuliert werden.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="socialContext"
              render={({ field }) => {
                const currentValue = field.value || SOCIAL_CONTEXT_DEFAULT
                return (
                  <FormItem>
                    <FormLabel>Sozialer Kontext/Sprachebene</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (SOCIAL_CONTEXT_VALUES.includes(value as typeof SOCIAL_CONTEXT_VALUES[number])) {
                        field.onChange(value)
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOCIAL_CONTEXT_VALUES.map((ctx) => (
                          <SelectItem key={ctx} value={ctx}>
                            {SOCIAL_CONTEXT_LABELS[ctx]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Sprachstil und Komplexität der Antworten.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          </div>
        </div>

        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="gallery.detailViewType"
            render={({ field }) => {
              const currentValue = field.value || 'book';
              console.log('[ChatForm] Select Field Render:', { fieldValue: field.value, currentValue });
              
              return (
                <FormItem>
                  <FormLabel>Galerie: Detailansicht-Typ</FormLabel>
                  <Select 
                    value={currentValue} 
                    onValueChange={(value) => {
                      console.log('[ChatForm] Select onChange:', value);
                      // NUR valide Werte akzeptieren (leere Strings ignorieren!)
                      if (value === 'book' || value === 'session') {
                        field.onChange(value);
                      } else {
                        console.warn('[ChatForm] Ungültiger detailViewType ignoriert:', value);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="book">Book (Bücher, Dokumente, Kapitel)</SelectItem>
                      <SelectItem value="session">Session (Events, Präsentationen, Slides)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Legt fest, welches Detail-View-Format in der Galerie verwendet wird: Book für klassische Dokumente mit Kapiteln, Session für Event-Präsentationen mit Slides.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <div className="grid gap-3">
            <FormLabel>Galerie: Facetten</FormLabel>
            <FormDescription>Definieren Sie beliebige Facetten für die Filter-Navigation.</FormDescription>
            <FacetDefsEditor value={form.watch("gallery.facets") || []} onChange={(v) => form.setValue("gallery.facets", v, { shouldDirty: true })} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={async () => {
            setIsChecking(true)
            setHealthError(null)
            setHealthResult(null)
            try {
              if (!activeLibrary) throw new Error('Keine Bibliothek ausgewählt')
              
              console.log('[ChatForm] Index-Status-Prüfung für:', {
                libraryId: activeLibrary.id,
                libraryLabel: activeLibrary.label
              })
              
              // Prüfe Index-Status für diese spezifische Library
              const url = `/api/chat/${encodeURIComponent(activeLibrary.id)}/index-status`
              console.log('[ChatForm] Request URL:', url)
              
              const res = await fetch(url, { 
                method: 'GET', 
                cache: 'no-store' 
              })
              const data = await res.json()
              
              console.log('[ChatForm] Index-Status Response:', data)
              
              if (!res.ok) {
                const message = typeof data?.error === 'string' ? data.error : `Fehlerstatus ${res.status}`
                throw new Error(message)
              }
              
              setHealthResult(data)
              
              // Benutzerfreundliche Toast-Nachricht
              if (data.exists) {
                toast({ 
                  title: '✅ Index vorhanden', 
                  description: `Index "${data.indexName}" ist bereit (${data.vectorCount || 0} Vektoren)` 
                })
              } else {
                toast({ 
                  title: '⚠️ Index fehlt', 
                  description: `Index "${data.expectedIndexName}" existiert noch nicht. Bitte "Index anlegen" klicken.`,
                  variant: 'destructive'
                })
              }
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
          <Button 
            type="submit" 
            disabled={isLoading}
            onClick={() => {
              console.log('[ChatForm] Button wurde geklickt!')
              console.log('[ChatForm] Form State:', {
                isValid: form.formState.isValid,
                isDirty: form.formState.isDirty,
                errors: form.formState.errors,
                values: form.getValues()
              })
            }}
          >
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>

        {(healthResult || healthError) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-2">
              {healthResult?.exists !== undefined ? 'Index Status' : 'Pinecone Health Check'}
            </div>
            {healthError ? (
              <div className="text-sm text-destructive">{healthError}</div>
            ) : healthResult?.exists === true ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-green-600 dark:text-green-400">✅ Index vorhanden</div>
                <div className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">Index:</span> {healthResult.expectedIndexName || healthResult.expectedIndex}</div>
                  <div><span className="text-muted-foreground">Vektoren:</span> {(healthResult.vectorCount || 0).toLocaleString('de-DE')}</div>
                  <div><span className="text-muted-foreground">Dimension:</span> {healthResult.dimension}</div>
                  <div><span className="text-muted-foreground">Status:</span> {(healthResult as Record<string, unknown>).status ? String((healthResult as Record<string, unknown>).status) : 'Unknown'}</div>
                </div>
              </div>
            ) : healthResult?.exists === false ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">⚠️ Index fehlt</div>
                <div className="text-xs">
                  <div><span className="text-muted-foreground">Erwarteter Name:</span> {healthResult.expectedIndexName || healthResult.expectedIndex}</div>
                  <div className="text-sm text-muted-foreground mt-2">Bitte &quot;Index anlegen&quot; klicken, um zu starten.</div>
                </div>
              </div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap break-words">{healthResult ? JSON.stringify(healthResult, null, 2) : ''}</pre>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}


