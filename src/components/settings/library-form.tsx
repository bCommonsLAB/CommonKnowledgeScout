"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback, useMemo } from "react"
import { v4 as uuidv4 } from "uuid"
import { useAtom } from "jotai"
import { useUser } from "@clerk/nextjs"

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
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Trash2, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { StorageProviderType } from "@/types/library"

// Hauptschema für das Formular mit erweiterter Konfiguration
const libraryFormSchema = z.object({
  label: z.string({
    required_error: "Bitte geben Sie einen Namen ein.",
  }).min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  type: z.enum(["local", "onedrive", "gdrive"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  transcription: z.enum(["shadowTwin", "db"], {
    required_error: "Bitte wählen Sie eine Transkriptionsstrategie.",
  }),
  templateDirectory: z.string().default("/templates"),
  // Zusätzliche Storage-Konfiguration, abhängig vom Typ
  storageConfig: z.object({
    // Lokales Dateisystem
    basePath: z.string().optional(),
    // OAuth-basierte Provider (OneDrive, Google Drive)
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),
})

type LibraryFormValues = z.infer<typeof libraryFormSchema>

// Füge die createNew-Prop hinzu
interface LibraryFormProps {
  createNew?: boolean;
}

export function LibraryForm({ createNew = false }: LibraryFormProps) {
  const { user } = useSafeUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  const defaultValues = useMemo<LibraryFormValues>(() => ({
    label: "",
    path: "",
    type: "local",
    description: "",
    isEnabled: true,
    transcription: "shadowTwin",
    templateDirectory: "/templates",
    storageConfig: {
      basePath: "",
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    }
  }), []);

  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  });

  // Funktion zum Erstellen einer neuen Bibliothek
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    // Wichtig: activeLibraryId zurücksetzen, damit keine bestehende Bibliothek überschrieben wird
    setActiveLibraryId("");
    form.reset(defaultValues);
  }, [form, defaultValues, setActiveLibraryId]);

  // Funktion zum Zurückkehren zur Bearbeitung der aktiven Bibliothek
  const handleCancelNew = useCallback(() => {
    setIsNew(false);
    // Zurück zur aktiven Bibliothek, falls vorhanden
    if (activeLibrary) {
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: activeLibrary.config?.clientSecret as string || "",
        redirectUri: activeLibrary.config?.redirectUri as string || "",
      };
      
      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: activeLibrary.config?.description as string || "",
        isEnabled: activeLibrary.isEnabled,
        transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
        templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
        storageConfig,
      });
    } else if (libraries.length > 0) {
      // Falls keine aktive Bibliothek, aber Bibliotheken vorhanden sind, zur ersten wechseln
      setActiveLibraryId(libraries[0].id);
    }
  }, [activeLibrary, libraries, form, setActiveLibraryId]);

  // Neue Bibliothek erstellen wenn createNew true ist
  useEffect(() => {
    if (createNew) {
      handleCreateNew();
    }
  }, [createNew, handleCreateNew]);

  // Form mit aktiver Bibliothek befüllen (nur wenn nicht im "Neue Bibliothek"-Modus)
  useEffect(() => {
    if (activeLibrary && !isNew) {
      // Extrahiere Storage-Konfiguration aus dem config-Objekt
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: activeLibrary.config?.clientSecret as string || "",
        redirectUri: activeLibrary.config?.redirectUri as string || "",
      };

      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: activeLibrary.config?.description as string || "",
        isEnabled: activeLibrary.isEnabled,
        transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
        templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
        storageConfig,
      });
    }
  }, [activeLibrary, isNew, form]);

  // Bibliothek speichern (neu erstellen oder aktualisieren)
  async function onSubmit(data: LibraryFormValues) {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um eine Bibliothek zu speichern.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Extrahiere die spezifischen Storage-Konfigurationen basierend auf dem Typ
      let storageConfig = {};
      
      switch(data.type) {
        case "local":
          storageConfig = {
            basePath: data.storageConfig.basePath,
          };
          break;
        case "onedrive":
        case "gdrive":
          storageConfig = {
            clientId: data.storageConfig.clientId,
            clientSecret: data.storageConfig.clientSecret,
            redirectUri: data.storageConfig.redirectUri,
          };
          break;
      }
      
      // WICHTIG: Für neue Bibliotheken IMMER eine neue ID generieren
      const newLibraryId = isNew ? uuidv4() : activeLibraryId;
      
      // Bibliotheksobjekt erstellen
      const libraryData = {
        id: newLibraryId,
        label: data.label,
        path: data.path,
        type: data.type as StorageProviderType,
        isEnabled: data.isEnabled,
        transcription: data.transcription,
        config: {
          description: data.description,
          transcription: data.transcription,
          templateDirectory: data.templateDirectory,
          ...storageConfig,
        }
      };
      
      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(libraryData),
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`);
      }
      
      // Lokalen Zustand aktualisieren
      if (isNew) {
        // Neue Bibliothek hinzufügen
        const newLibrary = {
          ...libraryData,
          icon: <AlertCircle className="h-4 w-4" />,
          config: {
            ...libraryData.config,
          }
        };
        setLibraries([...libraries, newLibrary]);
        setActiveLibraryId(newLibraryId);
        setIsNew(false);
        
        toast({
          title: "Bibliothek erstellt",
          description: `Die Bibliothek "${data.label}" wurde erfolgreich erstellt.`,
        });
        
        // Weiter direkt zu den Storage-Einstellungen navigieren
        router.push('/settings/storage');
      } else {
        // Bestehende Bibliothek aktualisieren
        const updatedLibraries = libraries.map(lib => 
          lib.id === libraryData.id ? {
            ...lib,
            ...libraryData,
            icon: lib.icon,
            config: {
              ...lib.config,
              ...libraryData.config,
            }
          } : lib
        );
        setLibraries(updatedLibraries);
        
        toast({
          title: "Bibliothek aktualisiert",
          description: `Die Bibliothek "${data.label}" wurde erfolgreich aktualisiert.`,
        });
      }
      
    } catch (error) {
      console.error('Fehler beim Speichern der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Bibliothek löschen
  const handleDeleteLibrary = async () => {
    if (!activeLibraryId || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek zum Löschen ausgewählt oder Benutzer nicht angemeldet.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // API-Anfrage zum Löschen der Bibliothek
      const response = await fetch(`/api/libraries?libraryId=${activeLibraryId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Löschen: ${response.statusText}`);
      }
      
      
      // Lokalen Zustand aktualisieren
      const updatedLibraries = libraries.filter(lib => lib.id !== activeLibraryId);
      setLibraries(updatedLibraries);
      
      // Zur ersten verbliebenen Bibliothek wechseln oder leeren Zustand setzen
      if (updatedLibraries.length > 0) {
        setActiveLibraryId(updatedLibraries[0].id);
      } else {
        setActiveLibraryId("");
        setIsNew(true);
        form.reset(defaultValues);
      }
      
      toast({
        title: "Bibliothek gelöscht",
        description: `Die Bibliothek wurde erfolgreich gelöscht.`,
      });
      
      setIsDeleteDialogOpen(false);
      
    } catch (error) {
      console.error('Fehler beim Löschen der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          {isNew ? (
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="font-medium">Neue Bibliothek erstellen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">
                {activeLibrary ? `Bibliothek bearbeiten: ${activeLibrary.label}` : "Bibliothek auswählen"}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {isNew ? (
            <Button 
              onClick={handleCancelNew}
              variant="outline"
              size="sm"
            >
              Abbrechen
            </Button>
          ) : (
            <Button 
              onClick={handleCreateNew} 
              disabled={isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Bibliothek erstellen
            </Button>
          )}
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Allgemeine Einstellungen */}
          <Card>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Geben Sie Ihrer Bibliothek einen treffenden Namen.
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
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschreibung der Bibliothek"
                        className="resize-none"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Eine kurze Beschreibung der Bibliothek und ihres Inhalts.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="transcription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transkriptionsstrategie</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Transkriptionsstrategie auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="shadowTwin">Neben Originaldatei speichern (Shadow Twin)</SelectItem>
                        <SelectItem value="db">In Datenbank speichern</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Festlegen, wie Transkriptionen gespeichert werden sollen.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="templateDirectory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template-Verzeichnis</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="/templates" />
                    </FormControl>
                    <FormDescription>
                      Verzeichnis in der Bibliothek, in dem die Secretary Service Templates gespeichert werden.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Bibliothek aktivieren
                      </FormLabel>
                      <FormDescription>
                        Wenn deaktiviert, wird die Bibliothek in der Anwendung nicht angezeigt.
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
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (activeLibrary) {
                    // Zurücksetzen-Funktion anpassen
                    const storageConfig = {
                      basePath: activeLibrary.path,
                      clientId: activeLibrary.config?.clientId as string || "",
                      clientSecret: activeLibrary.config?.clientSecret as string || "",
                      redirectUri: activeLibrary.config?.redirectUri as string || "",
                    };
                    
                    form.reset({
                      label: activeLibrary.label,
                      path: activeLibrary.path,
                      type: activeLibrary.type,
                      description: activeLibrary.config?.description as string || "",
                      isEnabled: activeLibrary.isEnabled,
                      transcription: activeLibrary.config?.transcription as "shadowTwin" | "db" || "shadowTwin",
                      templateDirectory: activeLibrary.config?.templateDirectory as string || "/templates",
                      storageConfig,
                    });
                  }
                }}
                disabled={isLoading}
              >
                Zurücksetzen
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || (!isNew && !form.formState.isDirty)}
            >
              {isLoading ? "Wird gespeichert..." : (isNew ? "Bibliothek erstellen" : "Änderungen speichern")}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* Gefahrenbereich für Bibliothek löschen, nur anzeigen wenn keine neue Bibliothek erstellt wird */}
      {!isNew && activeLibrary && (
        <div className="mt-10">
          <h3 className="text-lg font-medium text-destructive">Gefahrenzone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Hier können Sie die aktuelle Bibliothek unwiderruflich löschen.
          </p>
          
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">Bibliothek &quot;{activeLibrary.label}&quot; löschen</h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen einer Bibliothek ist permanent und kann nicht rückgängig gemacht werden.
                    Alle Einstellungen und Verweise auf diese Bibliothek gehen verloren.
                  </p>
                </div>
                
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Bibliothek &quot;{activeLibrary.label}&quot; löschen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bibliothek löschen</DialogTitle>
                      <DialogDescription>
                        Sind Sie sicher, dass Sie die Bibliothek &quot;{activeLibrary.label}&quot; löschen möchten? 
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Abbrechen
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteLibrary}
                        disabled={isLoading}
                      >
                        {isLoading ? "Wird gelöscht..." : "Bibliothek unwiderruflich löschen"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
