"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useMemo } from "react"
import { useAtom } from "jotai"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "../ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"

/**
 * Build-Zeit-sichere Hook-Wrapper für useUser
 */
function useSafeUser() {
  try {
    return useUser();
  } catch {
    return { user: null, isLoaded: true };
  }
}

// Schema für Public-Publishing-Formular
const publicFormSchema = z.object({
  slugName: z.string({
    required_error: "Bitte geben Sie einen Slug-Namen ein.",
  })
    .min(3, "Der Slug muss mindestens 3 Zeichen lang sein.")
    .max(50, "Der Slug darf maximal 50 Zeichen lang sein.")
    .regex(/^[a-z0-9-]+$/, "Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten."),
  publicName: z.string({
    required_error: "Bitte geben Sie einen öffentlichen Namen ein.",
  })
    .min(3, "Der öffentliche Name muss mindestens 3 Zeichen lang sein.")
    .max(100, "Der öffentliche Name darf maximal 100 Zeichen lang sein."),
  description: z.string({
    required_error: "Bitte geben Sie eine Beschreibung ein.",
  })
    .min(10, "Die Beschreibung muss mindestens 10 Zeichen lang sein.")
    .max(500, "Die Beschreibung darf maximal 500 Zeichen lang sein."),
  icon: z.string().optional(),
  isPublic: z.boolean().default(false),
  requiresAuth: z.boolean().default(false),
  siteEnabled: z.boolean().default(false),
  // Flag: ob die Library auf der Homepage gelistet wird (fehlend => true)
  showOnHomepage: z.boolean().default(true),
  // Hintergrundbild-URL für die Homepage
  backgroundImageUrl: z.union([
    z.string().url("Bitte geben Sie eine gültige URL ein."),
    z.literal("")
  ]).optional(),
  // Gallery-Texte
  galleryHeadline: z.string().optional(),
  gallerySubtitle: z.string().optional(),
  galleryDescription: z.string().optional(),
  galleryFilterDescription: z.string().optional(),
})

type PublicFormValues = z.infer<typeof publicFormSchema>

// Häufig verwendete Lucide-Icons für die Auswahl
const COMMON_ICONS = [
  { value: "BookOpen", label: "Buch" },
  { value: "Building2", label: "Gebäude" },
  { value: "Code2", label: "Code" },
  { value: "Users", label: "Benutzer" },
  { value: "Leaf", label: "Blatt" },
  { value: "Globe", label: "Globus" },
  { value: "GraduationCap", label: "Abschlusskappe" },
  { value: "Lightbulb", label: "Glühbirne" },
  { value: "MessageSquare", label: "Nachricht" },
  { value: "Library", label: "Bibliothek" },
  { value: "FileText", label: "Dokument" },
  { value: "Zap", label: "Blitz" },
  { value: "Heart", label: "Herz" },
  { value: "Star", label: "Stern" },
  { value: "Target", label: "Ziel" },
] as const

export function PublicForm() {
  const { user } = useSafeUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [sitePublishLoading, setSitePublishLoading] = useState(false);
  const [siteDepublishLoading, setSiteDepublishLoading] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);

  // Berechne Default-Werte dynamisch aus der Library (falls vorhanden)
  // Das verhindert das Flackern zwischen Default-Werten und geladenen Werten
  const defaultValues = useMemo((): PublicFormValues => {
    if (!activeLibrary) {
      return {
        slugName: "",
        publicName: "",
        description: "",
        icon: "",
        isPublic: false,
        requiresAuth: false,
        siteEnabled: false,
        showOnHomepage: true,
        backgroundImageUrl: "",
        galleryHeadline: "Entdecke, was Menschen auf der SFSCon gesagt haben",
        gallerySubtitle: "Befrage das kollektive Wissen",
        galleryDescription: "Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.",
        galleryFilterDescription: "Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.",
      }
    }

    return {
      slugName: activeLibrary.config?.publicPublishing?.slugName || "",
      publicName: activeLibrary.config?.publicPublishing?.publicName || activeLibrary.label || "",
      description: activeLibrary.config?.publicPublishing?.description || "",
      icon: activeLibrary.config?.publicPublishing?.icon || "",
      isPublic: activeLibrary.config?.publicPublishing?.isPublic === true || false,
      requiresAuth: activeLibrary.config?.publicPublishing?.requiresAuth === true || false,
      siteEnabled: activeLibrary.config?.publicPublishing?.siteEnabled === true || false,
      // Backwards-Compatibility: fehlend => true
      showOnHomepage: activeLibrary.config?.publicPublishing?.showOnHomepage !== false,
      backgroundImageUrl: activeLibrary.config?.publicPublishing?.backgroundImageUrl || "",
      // Gallery-Texte: Verwende gespeicherte Werte oder Defaults
      galleryHeadline: activeLibrary.config?.publicPublishing?.gallery?.headline || "Entdecke, was Menschen auf der SFSCon gesagt haben",
      gallerySubtitle: activeLibrary.config?.publicPublishing?.gallery?.subtitle || "Befrage das kollektive Wissen",
      galleryDescription: activeLibrary.config?.publicPublishing?.gallery?.description || "Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.",
      galleryFilterDescription: activeLibrary.config?.publicPublishing?.gallery?.filterDescription || "Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.",
    }
  }, [activeLibrary])

  const form = useForm<PublicFormValues>({
    resolver: zodResolver(publicFormSchema),
    defaultValues: defaultValues,
    // Verwende values, um die Werte sofort zu setzen, wenn die Library geladen ist
    // Das verhindert das Flackern zwischen Default-Werten und geladenen Werten
    values: defaultValues,
  })

  // Slug-Validierung beim Tippen
  const slugName = form.watch("slugName")
  const isPublic = form.watch("isPublic")
  const siteEnabled = form.watch("siteEnabled")
  useEffect(() => {
    if (!slugName || slugName.length < 3) {
      setSlugAvailable(null);
      return;
    }

    // Validierung: nur lowercase, alphanumerisch, Bindestriche
    if (!/^[a-z0-9-]+$/.test(slugName)) {
      setSlugAvailable(false);
      return;
    }

    // Debounce für API-Check
    const timeoutId = setTimeout(async () => {
      if (!activeLibraryId) return;
      
      setIsCheckingSlug(true);
      try {
        const response = await fetch(
          `/api/libraries/${activeLibraryId}/public/check-slug?slug=${encodeURIComponent(slugName)}`
        );
        const data = await response.json();
        setSlugAvailable(data.available === true);
      } catch {
        setSlugAvailable(null);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [slugName, activeLibraryId]);

  const publicLink = useMemo(() => {
    const path = slugName ? `/explore/${slugName}` : ""
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return origin ? `${origin}${path}` : path
  }, [slugName])

  /**
   * Gemeinsames PUT für Public-Settings (wie beim Speichern-Button).
   * Wirft bei API-Fehler — für handleSubmit / Auto-Save vor Startseiten-Aktionen.
   */
  async function putPublicSettings(data: PublicFormValues): Promise<void> {
    if (!user?.primaryEmailAddress?.emailAddress) {
      throw new Error('Sie müssen angemeldet sein, um Public-Settings zu speichern.')
    }
    if (!activeLibraryId) {
      throw new Error('Bitte wählen Sie zuerst eine Bibliothek aus.')
    }

    const publicPublishing = {
      slugName: data.slugName,
      publicName: data.publicName,
      description: data.description,
      icon: data.icon || undefined,
      isPublic: data.isPublic,
      requiresAuth: data.requiresAuth,
      siteEnabled: data.siteEnabled,
      showOnHomepage: data.showOnHomepage,
      backgroundImageUrl: data.backgroundImageUrl || undefined,
    }

    const response = await fetch(`/api/libraries/${activeLibraryId}/public`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(publicPublishing),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        typeof errorData.error === 'string' ? errorData.error : 'Fehler beim Speichern der Public-Settings',
      )
    }

    if (user?.primaryEmailAddress?.emailAddress) {
      try {
        const librariesResponse = await fetch(
          `/api/libraries?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`,
        )
        if (librariesResponse.ok) {
          const updatedLibraries = await librariesResponse.json()
          if (Array.isArray(updatedLibraries)) {
            setLibraries(updatedLibraries)
          }
        }
      } catch (refreshError) {
        console.error('[PublicForm] Libraries nach putPublicSettings:', refreshError)
      }
    }

    router.refresh()
  }

  /**
   * Vor „Draft testen“ / „Veröffentlichen“: ungespeicherte Änderungen sichern,
   * sonst stimmt der Slug in MongoDB nicht mit dem Formular überein (404 / Fehler).
   */
  async function ensurePublicSettingsPersistedForSiteActions(): Promise<boolean> {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein, um Public-Settings zu speichern.',
        variant: 'destructive',
      })
      return false
    }
    if (!activeLibraryId) {
      toast({
        title: 'Fehler',
        description: 'Bitte wählen Sie zuerst eine Bibliothek aus.',
        variant: 'destructive',
      })
      return false
    }
    if (isCheckingSlug) {
      toast({
        title: 'Bitte kurz warten',
        description: 'Der Slug wird noch auf Verfügbarkeit geprüft.',
      })
      return false
    }
    if (slugAvailable === false) {
      toast({
        title: 'Slug nicht verfügbar',
        description: 'Dieser Slug ist bereits vergeben. Bitte einen anderen wählen.',
        variant: 'destructive',
      })
      return false
    }

    // Keine Änderungen: nichts nach dem Server schicken
    if (!form.formState.isDirty) {
      return true
    }

    return await new Promise<boolean>((resolve) => {
      void form.handleSubmit(
        async (data) => {
          setIsLoading(true)
          try {
            await putPublicSettings(data)
            toast({
              title: 'Gespeichert',
              description:
                'Änderungen wurden gespeichert, bevor die Startseiten-Aktion ausgeführt wird.',
            })
            resolve(true)
          } catch (error) {
            console.error('[PublicForm] Auto-Save vor Startseiten-Aktion:', error)
            toast({
              title: 'Speichern fehlgeschlagen',
              description:
                error instanceof Error ? error.message : 'Fehler beim Speichern der Public-Settings.',
              variant: 'destructive',
            })
            resolve(false)
          } finally {
            setIsLoading(false)
          }
        },
        () => {
          toast({
            title: 'Eingaben unvollständig',
            description:
              'Bitte prüfen Sie die Felder unter „Veröffentlichen“ und beheben Sie die markierten Fehler.',
            variant: 'destructive',
          })
          resolve(false)
        },
      )()
    })
  }

  async function handleCopyPublicLink() {
    if (!publicLink) {
      toast({
        title: "Kein Link verfügbar",
        description: "Bitte zuerst einen gültigen Slug setzen.",
        variant: "destructive",
      })
      return
    }

    try {
      if (!navigator?.clipboard?.writeText) throw new Error("Clipboard API nicht verfügbar")
      await navigator.clipboard.writeText(publicLink)
      toast({
        title: "Kopiert",
        description: "Der öffentliche Link wurde in die Zwischenablage kopiert.",
      })
    } catch {
      toast({
        title: "Kopieren fehlgeschlagen",
        description: "Bitte kopieren Sie den Link manuell.",
        variant: "destructive",
      })
    }
  }

  async function onSubmit(data: PublicFormValues) {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Public-Settings zu speichern.",
        variant: "destructive",
      });
      return;
    }

    if (!activeLibraryId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie zuerst eine Bibliothek aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await putPublicSettings(data);

      toast({
        title: "Erfolg",
        description: "Public-Settings erfolgreich gespeichert.",
      });
      console.log('[PublicForm] Libraries nach Speichern aktualisiert');
    } catch (error) {
      console.error('Fehler beim Speichern der Public-Settings:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Fehler beim Speichern der Public-Settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!activeLibrary) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Keine Bibliothek ausgewählt</AlertTitle>
        <AlertDescription>
          Bitte wählen Sie zuerst eine Bibliothek aus, um die Public-Settings zu konfigurieren.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form} key={activeLibraryId}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Library veröffentlichen</FormLabel>
                <FormDescription>
                  Stellen Sie diese Library öffentlich zur Verfügung. Nutzer können sie dann ohne Anmeldung aufrufen.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Startseite (web/): unabhängig vom Public-Flag — Publish läuft über eigene API (Owner + Co-Creator). */}
        {activeLibraryId && slugName && slugName.length >= 3 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="text-base font-semibold">Startseite verwalten</h3>
              <p className="text-sm text-muted-foreground">
                Entwurf liegt im Storage unter <code className="text-xs">web/</code>. Testen im Explore-Modus; Live erst nach explizitem Veröffentlichen (Azure-Snapshot).
              </p>
            </div>
            <FormField
              control={form.control}
              name="siteEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Startseite anzeigen</FormLabel>
                    <FormDescription>
                      Zeigt den Tab „Startseite“ in Explore und in der normalen Galerie-Ansicht an. Wenn deaktiviert, bleibt die Website verborgen, auch wenn Dateien unter <code className="text-xs">web/</code> liegen.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {activeLibrary?.config?.publicPublishing?.sitePublished && (
              <p className="text-sm">
                Live-Version v{activeLibrary.config.publicPublishing.siteVersion ?? '—'}
                {activeLibrary.config.publicPublishing.sitePublishedAt
                  ? ` · ${new Date(activeLibrary.config.publicPublishing.sitePublishedAt).toLocaleString()}`
                  : ''}
              </p>
            )}
            {siteEnabled && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading || sitePublishLoading || siteDepublishLoading || isCheckingSlug || slugAvailable !== true}
                  onClick={async () => {
                    const persisted = await ensurePublicSettingsPersistedForSiteActions()
                    if (!persisted) return
                    window.open(`/explore/${encodeURIComponent(slugName)}?view=site`, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Draft testen
                </Button>
                <Button
                  type="button"
                  disabled={isLoading || sitePublishLoading || siteDepublishLoading || isCheckingSlug || slugAvailable !== true}
                  onClick={async () => {
                    if (!activeLibraryId) return
                    const persisted = await ensurePublicSettingsPersistedForSiteActions()
                    if (!persisted) return
                    setSitePublishLoading(true)
                    try {
                      const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/publish-site`, {
                        method: 'POST',
                      })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        throw new Error(typeof data.error === 'string' ? data.error : 'Veröffentlichen fehlgeschlagen')
                      }
                      toast({
                        title: 'Startseite veröffentlicht',
                        description: data.siteUrl ? `Version ${data.siteVersion}` : 'OK',
                      })
                      router.refresh()
                      if (user?.primaryEmailAddress?.emailAddress) {
                        const librariesResponse = await fetch(
                          `/api/libraries?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`,
                        )
                        if (librariesResponse.ok) {
                          const updatedLibraries = await librariesResponse.json()
                          if (Array.isArray(updatedLibraries)) setLibraries(updatedLibraries)
                        }
                      }
                    } catch (e) {
                      toast({
                        title: 'Fehler',
                        description: e instanceof Error ? e.message : 'Veröffentlichen fehlgeschlagen',
                        variant: 'destructive',
                      })
                    } finally {
                      setSitePublishLoading(false)
                    }
                  }}
                >
                  {sitePublishLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {activeLibrary?.config?.publicPublishing?.sitePublished
                    ? 'Neu veröffentlichen'
                    : 'Veröffentlichen'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={sitePublishLoading || siteDepublishLoading || !activeLibrary?.config?.publicPublishing?.sitePublished}
                  onClick={async () => {
                    if (!activeLibraryId) return
                    setSiteDepublishLoading(true)
                    try {
                      const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/depublish-site`, {
                        method: 'POST',
                      })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        throw new Error(typeof data.error === 'string' ? data.error : 'Depublizieren fehlgeschlagen')
                      }
                      toast({ title: 'Live-Startseite deaktiviert', description: 'Anonyme Nutzer sehen nur noch die Galerie.' })
                      router.refresh()
                      if (user?.primaryEmailAddress?.emailAddress) {
                        const librariesResponse = await fetch(
                          `/api/libraries?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`,
                        )
                        if (librariesResponse.ok) {
                          const updatedLibraries = await librariesResponse.json()
                          if (Array.isArray(updatedLibraries)) setLibraries(updatedLibraries)
                        }
                      }
                    } catch (e) {
                      toast({
                        title: 'Fehler',
                        description: e instanceof Error ? e.message : 'Depublizieren fehlgeschlagen',
                        variant: 'destructive',
                      })
                    } finally {
                      setSiteDepublishLoading(false)
                    }
                  }}
                >
                  {siteDepublishLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Depublizieren
                </Button>
              </div>
            )}
          </div>
        )}

        {form.watch("isPublic") && (
          <>
            <FormField
              control={form.control}
              name="requiresAuth"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Zugriff nur für freigegebene Benutzer</FormLabel>
                    <FormDescription>
                      Benutzer müssen angemeldet sein und eine Freigabe erhalten (oder per Einladung eingeladen werden).
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slugName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug-Name</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="z.B. sfscon-talks"
                        {...field}
                        onChange={(e) => {
                          // Automatisch zu lowercase konvertieren
                          const value = e.target.value.toLowerCase();
                          field.onChange(value);
                        }}
                      />
                      {isCheckingSlug && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {slugAvailable === true && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {slugAvailable === false && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Eindeutiger Name für die URL (z.B. /explore/sfscon-talks). Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.
                  </FormDescription>
                  {slugAvailable === false && (
                    <FormMessage>Dieser Slug-Name ist bereits vergeben.</FormMessage>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Öffentlicher Link</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  value={publicLink}
                  readOnly
                  placeholder="Wird automatisch aus dem Slug erstellt"
                  aria-label="Öffentlicher Link"
                  disabled={!isPublic || !slugName || slugName.length < 3 || slugAvailable === false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPublicLink}
                  disabled={!isPublic || !publicLink || slugAvailable === false}
                  aria-label="Öffentlichen Link kopieren"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>
                Dieser Link führt direkt zur öffentlichen Ansicht (auch wenn „Show on Homepage“ deaktiviert ist).
              </FormDescription>
            </div>

            <FormField
              control={form.control}
              name="showOnHomepage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Show on Homepage</FormLabel>
                    <FormDescription>
                      Wenn deaktiviert, ist die Library weiterhin über den Slug erreichbar, wird aber nicht auf der Homepage gelistet.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publicName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Öffentlicher Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. SFSCon Talks (Bozen)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Der Name, der auf der Homepage und in öffentlichen Ansichten angezeigt wird.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Öffentliche Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschreibung der Library für die öffentliche Ansicht..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Diese Beschreibung wird auf der Homepage und in öffentlichen Ansichten angezeigt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      // Konvertiere "none" zu undefined für leeren Wert
                      field.onChange(value === "none" ? undefined : value)
                    }} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Icon auswählen (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Kein Icon</SelectItem>
                      {COMMON_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wählen Sie ein Icon für die öffentliche Ansicht aus.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="backgroundImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hintergrundbild-URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: URL für ein Hintergrundbild, das auf der Homepage als Hintergrundbild der Library verwendet wird.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || slugAvailable === false}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </div>
      </form>
    </Form>
  );
}

