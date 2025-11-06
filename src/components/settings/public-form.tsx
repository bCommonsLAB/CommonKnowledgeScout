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
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
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
  apiKey: z.string().optional(),
  isPublic: z.boolean().default(false),
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
        apiKey: "",
        isPublic: false,
        galleryHeadline: "Entdecke, was Menschen auf der SFSCon gesagt haben",
        gallerySubtitle: "Befrage das kollektive Wissen",
        galleryDescription: "Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.",
        galleryFilterDescription: "Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.",
      }
    }

    const apiKeyValue = activeLibrary.config?.publicPublishing?.apiKey || "";
    const isMasked = apiKeyValue.includes('...') || apiKeyValue.includes('••••') || (apiKeyValue.match(/\./g)?.length || 0) >= 10;

    return {
      slugName: activeLibrary.config?.publicPublishing?.slugName || "",
      publicName: activeLibrary.config?.publicPublishing?.publicName || activeLibrary.label || "",
      description: activeLibrary.config?.publicPublishing?.description || "",
      icon: activeLibrary.config?.publicPublishing?.icon || "",
      apiKey: isMasked ? apiKeyValue : "",
      isPublic: activeLibrary.config?.publicPublishing?.isPublic === true || false,
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
      // Public-Publishing-Config erstellen
      // Prüfe ob API-Key maskiert ist - wenn ja, nicht ändern
      const currentApiKey = activeLibrary?.config?.publicPublishing?.apiKey || "";
      const isMasked = currentApiKey.includes('...') || currentApiKey.includes('••••') || (currentApiKey.match(/\./g)?.length || 0) >= 10;
      const apiKeyToSave = data.apiKey && !data.apiKey.includes('...') && !data.apiKey.includes('••••') && (data.apiKey.match(/\./g)?.length || 0) < 10
        ? data.apiKey  // Neuer Key wurde eingegeben
        : (isMasked ? undefined : data.apiKey); // Wenn maskiert, undefined (behält alten), sonst verwendeter Wert
      
      const publicPublishing = {
        slugName: data.slugName,
        publicName: data.publicName,
        description: data.description,
        icon: data.icon || undefined,
        apiKey: apiKeyToSave,
        isPublic: data.isPublic,
        gallery: {
          headline: data.galleryHeadline || undefined,
          subtitle: data.gallerySubtitle || undefined,
          description: data.galleryDescription || undefined,
          filterDescription: data.galleryFilterDescription || undefined,
        },
      };

      const response = await fetch(`/api/libraries/${activeLibraryId}/public`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(publicPublishing),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fehler beim Speichern der Public-Settings');
      }

      toast({
        title: "Erfolg",
        description: "Public-Settings erfolgreich gespeichert.",
      });

      // Libraries aktualisieren, um die neuen Daten zu bekommen
      // Lade Libraries neu über die API
      if (user?.primaryEmailAddress?.emailAddress) {
        try {
          const librariesResponse = await fetch(`/api/libraries?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`);
          if (librariesResponse.ok) {
            const updatedLibraries = await librariesResponse.json();
            if (Array.isArray(updatedLibraries)) {
              // Aktualisiere das librariesAtom
              setLibraries(updatedLibraries);
              console.log('[PublicForm] Libraries nach Speichern aktualisiert');
            }
          }
        } catch (refreshError) {
          console.error('[PublicForm] Fehler beim Aktualisieren der Libraries:', refreshError);
        }
      }

      // Seiten neu laden, um aktualisierte Daten zu bekommen
      router.refresh();
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

        {form.watch("isPublic") && (
          <>
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
              name="apiKey"
              render={({ field }) => {
                const fieldValue = field.value || "";
                const isMasked = fieldValue.includes('...') || fieldValue.includes('••••') || (fieldValue.match(/\./g)?.length || 0) >= 10;
                
                return (
                  <FormItem>
                    <FormLabel>OpenAI API-Key (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type={isMasked ? "text" : "password"}
                        placeholder="sk-..."
                        value={fieldValue}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          // Wenn der Benutzer etwas eingibt, entferne die Maskierung
                          const hasMasking = newValue.includes('...') || newValue.includes('••••') || (newValue.match(/\./g)?.length || 0) >= 10;
                          if (newValue !== fieldValue && !hasMasking) {
                            field.onChange(newValue);
                          } else if (newValue === "" || newValue === fieldValue) {
                            // Wenn gelöscht oder unverändert, behalte den Wert
                            field.onChange(newValue);
                          }
                        }}
                        onFocus={(e) => {
                          // Beim Fokus: wenn maskiert, löschen damit Benutzer neuen Key eingeben kann
                          if (isMasked) {
                            e.target.value = "";
                            field.onChange("");
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: OpenAI API-Key für anonyme Chat-Anfragen. Wenn nicht gesetzt, wird der globale API-Key verwendet.
                      {isMasked && " (Aktueller Key: " + fieldValue + ")"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Gallery-Texte */}
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-lg font-semibold">Gallery-Texte</h3>
              <p className="text-sm text-muted-foreground">
                Diese Texte werden in der Gallery-Ansicht angezeigt. Sie können als Vorlage die Standard-Texte verwenden und an Ihre Library anpassen.
              </p>

              <FormField
                control={form.control}
                name="galleryHeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallery-Überschrift</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Entdecke, was Menschen auf der SFSCon gesagt haben"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Große Überschrift für die Gallery-Ansicht (z.B. &quot;Entdecke, was Menschen auf der SFSCon gesagt haben&quot;).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gallerySubtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallery-Untertitel</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Befrage das kollektive Wissen"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Untertitel unter der Überschrift (z.B. &quot;Befrage das kollektive Wissen&quot;).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="galleryDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallery-Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Beschreibungstext unter der Überschrift. Erklärt den Nutzern, wie sie die Gallery verwenden können.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="galleryFilterDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filter-Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Beschreibungstext für das Filter-Panel in der Gallery.
                    </FormDescription>
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
            Speichern
          </Button>
        </div>
      </form>
    </Form>
  );
}

