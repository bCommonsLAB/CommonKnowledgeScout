"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useMemo } from "react"
import { useAtom } from "jotai"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, CheckCircle2, Copy, Globe, Loader2, Lock, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { useSafeUser } from "@/hooks/use-safe-user"
import { LibraryVerificationWarning } from "@/components/library/library-verification-warning"

// Schema für Public-Publishing-Formular
const publicFormSchema = z.object({
  slugName: z.string({
    required_error: "Bitte geben Sie eine Web-Adresse ein.",
  })
    .min(3, "Die Web-Adresse muss mindestens 3 Zeichen lang sein.")
    .max(50, "Die Web-Adresse darf maximal 50 Zeichen lang sein.")
    .regex(/^[a-z0-9-]+$/, "Die Web-Adresse darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten."),
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
  // Logo-URL der Website-Landingpage (TopNav im Site-Kontext, Phase C2)
  logoUrl: z.union([
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
        logoUrl: "",
        // E2-Fix: keine SFSCon-Hardcodes mehr — leer = Galerie-Fallbacks
        galleryHeadline: "",
        gallerySubtitle: "",
        galleryDescription: "",
        galleryFilterDescription: "",
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
      logoUrl: activeLibrary.config?.publicPublishing?.logoUrl || "",
      // Gallery-Texte: gespeicherte Werte; leer = Galerie-Fallbacks (E2-Fix)
      galleryHeadline: activeLibrary.config?.publicPublishing?.gallery?.headline || "",
      gallerySubtitle: activeLibrary.config?.publicPublishing?.gallery?.subtitle || "",
      galleryDescription: activeLibrary.config?.publicPublishing?.gallery?.description || "",
      galleryFilterDescription: activeLibrary.config?.publicPublishing?.gallery?.filterDescription || "",
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
      } catch (err) {
        // H5-Fix: Slug-Check-API-Fehler loggen — null = Status unbekannt
        console.error('[PublicForm] Slug-Check fehlgeschlagen:', err);
        setSlugAvailable(null);  // null = Unbekannt (kein grüner/roter Hinweis)
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
      logoUrl: data.logoUrl || undefined,
      // E2-Fix: Galerie-Texte wurden bisher NIE gesendet (Schema ohne UI/Body)
      // — die API merged sie nach publicPublishing.gallery.
      gallery: {
        headline: data.galleryHeadline || undefined,
        subtitle: data.gallerySubtitle || undefined,
        description: data.galleryDescription || undefined,
        filterDescription: data.galleryFilterDescription || undefined,
      },
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
        description: 'Die Web-Adresse wird noch auf Verfügbarkeit geprüft.',
      })
      return false
    }
    if (slugAvailable === false) {
      toast({
        title: 'Web-Adresse nicht verfügbar',
        description: 'Diese Web-Adresse ist bereits vergeben. Bitte eine andere wählen.',
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
        description: "Bitte zuerst eine gültige Web-Adresse setzen.",
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

  // Status-Header (UX-5): Sichtbarkeit aus den (ggf. ungespeicherten) Schaltern
  const watchedIsPublic = form.watch("isPublic")
  const watchedRequiresAuth = form.watch("requiresAuth")

  return (
    <Form {...form} key={activeLibraryId}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* A1: Nicht-blockierende Warnung, falls die Library nicht geprüft ist. */}
        <LibraryVerificationWarning context="publish" libraryId={activeLibraryId ?? undefined} />

        {/* Status auf einen Blick: Was sehen Fremde JETZT? */}
        <Alert
          className={
            watchedIsPublic
              ? watchedRequiresAuth
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                : "border-green-300 bg-green-50 dark:bg-green-950/30"
              : ""
          }
        >
          {watchedIsPublic ? (
            watchedRequiresAuth ? <ShieldCheck className="h-4 w-4" /> : <Globe className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          <AlertTitle>
            {watchedIsPublic
              ? watchedRequiresAuth
                ? "Öffentlich mit Freigabe"
                : "Öffentlich"
              : "Privat"}
            {form.formState.isDirty && " — ungespeicherte Änderungen"}
          </AlertTitle>
          <AlertDescription>
            {watchedIsPublic
              ? watchedRequiresAuth
                ? "Fremde sehen die Bibliothek erst nach genehmigter Zugriffsanfrage."
                : "Jeder mit dem Link sieht die Galerie dieser Bibliothek."
              : "Nur Sie und eingeladene Personen sehen diese Bibliothek."}
          </AlertDescription>
        </Alert>

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

        {/* Website-Landingpage: zeigt am Slug die Website statt der Galerie (Live-Docs, kein Snapshot). */}
        {activeLibraryId && slugName && slugName.length >= 3 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="text-base font-semibold">Website-Landingpage</h3>
              <p className="text-sm text-muted-foreground">
                Wird aus den Dokumenten mit <code className="text-xs">detailViewType: website</code> gerendert (Menü nach <code className="text-xs">menu_order</code>). Kein <code className="text-xs">web/</code>-Snapshot mehr.
              </p>
            </div>
            <FormField
              control={form.control}
              name="siteEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Website am Slug anzeigen</FormLabel>
                    <FormDescription>
                      Wenn aktiviert, öffnet der Slug (<code className="text-xs">/explore/{slugName}</code>) direkt die Website-Landingpage statt der Galerie. Die Galerie bleibt über das Menü erreichbar.
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
            {siteEnabled && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading || isCheckingSlug || slugAvailable !== true}
                  onClick={async () => {
                    const persisted = await ensurePublicSettingsPersistedForSiteActions()
                    if (!persisted) return
                    window.open(`/explore/${encodeURIComponent(slugName)}`, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Website öffnen
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
                  <FormLabel>Web-Adresse (Slug)</FormLabel>
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
                    <FormMessage>Diese Web-Adresse ist bereits vergeben.</FormMessage>
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
                  placeholder="Wird automatisch aus der Web-Adresse erstellt"
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
                Dieser Link führt direkt zur öffentlichen Ansicht (auch wenn „Auf der Startseite anzeigen“ deaktiviert ist).
              </FormDescription>
            </div>

            <FormField
              control={form.control}
              name="showOnHomepage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Auf der Startseite anzeigen</FormLabel>
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

            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website-Logo-URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://…/website/images/logo.png"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Logo für die Website-Landingpage — wird oben links in
                    der Navigation angezeigt (Explore-Seite und eigene Domain).
                    Muss eine öffentlich (anonym) ladbare URL sein.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* E2-Fix (UX-5): Galerie-Texte — Schema existierte seit jeher,
                aber ohne UI-Felder; die Galerie liest die Werte bereits. */}
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium">Galerie-Texte (Explore)</h4>
                <p className="text-xs text-muted-foreground">
                  Begrüßung und Erklärungen, die Besucher über der öffentlichen
                  Galerie sehen. Leer lassen für die Standard-Texte.
                </p>
              </div>
              <FormField
                control={form.control}
                name="galleryHeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Überschrift</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. Entdecke, was Menschen auf der Konferenz gesagt haben"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gallerySubtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Untertitel</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. Befrage das kollektive Wissen"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="galleryDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einleitung</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="z. B. Verschaffe dir zuerst einen Überblick über alle Inhalte. Filtere nach Themen — und wechsle in den Story-Modus, um Fragen zu stellen."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="galleryFilterDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filter-Erklärung</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="z. B. Filtere nach Themen, um die Inhalte zu finden, die dich interessieren."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || slugAvailable === false}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Veröffentlichung speichern
          </Button>
        </div>
      </form>
    </Form>
  );
}

