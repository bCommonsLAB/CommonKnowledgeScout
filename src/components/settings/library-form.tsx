"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Trash2, FolderOpen, Database, Cloud } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { StorageProviderType } from "@/types/library"

// Provider-spezifische Schemas für die Storage-Konfiguration
const filesystemConfigSchema = z.object({
  basePath: z.string().min(1, "Bitte geben Sie einen Basispfad an."),
})

const onedriveConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID ist erforderlich"),
  clientSecret: z.string().min(1, "Client Secret ist erforderlich"),
  redirectUri: z.string().url("Bitte geben Sie eine gültige URL ein"),
})

const googledriveConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID ist erforderlich"),
  clientSecret: z.string().min(1, "Client Secret ist erforderlich"),
  redirectUri: z.string().url("Bitte geben Sie eine gültige URL ein"),
})

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
  const { user } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  // Neue Bibliothek erstellen wenn createNew true ist
  useEffect(() => {
    if (createNew) {
      handleCreateNew();
    } else if (activeLibrary && isNew) {
      // Wenn createNew false wird und wir im "Neue Bibliothek"-Modus waren,
      // setzen wir auf die aktive Bibliothek zurück
      setIsNew(false);
      
      // Formular mit den Daten der aktiven Bibliothek füllen
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
          storageConfig,
        });
      }
    }
  }, [createNew, activeLibrary]);
  
  const defaultValues: LibraryFormValues = {
    label: "",
    path: "",
    type: "local",
    description: "",
    isEnabled: true,
    transcription: "shadowTwin",
    storageConfig: {
      basePath: "",
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    }
  };

  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  });

  // Aktueller Storage-Typ
  const currentType = form.watch("type");

  // Form mit aktiver Bibliothek befüllen
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
        storageConfig,
      });
    }
  }, [activeLibrary, isNew, form]);

  // Neue Bibliothek erstellen
  const handleCreateNew = () => {
    setIsNew(true);
    form.reset(defaultValues);
  };

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
      
      // Bibliotheksobjekt erstellen
      const libraryData = {
        id: isNew ? uuidv4() : activeLibraryId,
        label: data.label,
        path: data.path,
        type: data.type as StorageProviderType,
        isEnabled: data.isEnabled,
        transcription: data.transcription,
        config: {
          description: data.description,
          transcription: data.transcription,
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
      
      const result = await response.json();
      
      // Lokalen Zustand aktualisieren
      if (isNew) {
        // Neue Bibliothek hinzufügen
        setLibraries([...libraries, {
          ...libraryData,
          icon: <AlertCircle className="h-4 w-4" />,
          config: {
            ...libraryData.config,
          }
        }]);
        setActiveLibraryId(libraryData.id);
        setIsNew(false);
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
      }
      
      toast({
        title: isNew ? "Bibliothek erstellt" : "Bibliothek aktualisiert",
        description: `Die Bibliothek "${data.label}" wurde erfolgreich ${isNew ? 'erstellt' : 'aktualisiert'}.`,
      });
      
      // Zur Bibliotheksseite navigieren, wenn eine neue Bibliothek erstellt wurde
      if (isNew) {
        router.push('/library');
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
      
      const result = await response.json();
      
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

  // Provider-spezifische Konfigurationsfelder
  const StorageConfigFields = () => {
    switch (currentType) {
      case "local":
        return (
          <FormField
            control={form.control}
            name="storageConfig.basePath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Basispfad</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="/data/storage" />
                </FormControl>
                <FormDescription>
                  Der Basispfad für die Dateispeicherung auf dem lokalen System.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "onedrive":
      case "gdrive":
        return (
          <>
            <FormField
              control={form.control}
              name="storageConfig.clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Die Client ID Ihrer {currentType === "onedrive" ? "OneDrive" : "Google Drive"}-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storageConfig.clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Secret</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer {currentType === "onedrive" ? "OneDrive" : "Google Drive"}-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storageConfig.redirectUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Redirect URI</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://ihre-domain.de/auth/callback" />
                  </FormControl>
                  <FormDescription>
                    Die Redirect URI für die OAuth2-Authentifizierung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      default:
        return null;
    }
  };

  // Icon für den Storage-Typ
  const StorageTypeIcon = () => {
    switch (currentType) {
      case "local":
        return <FolderOpen className="h-4 w-4 mr-2" />;
      case "onedrive":
      case "gdrive":
        return <Cloud className="h-4 w-4 mr-2" />;
      default:
        return <Database className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Button 
            onClick={handleCreateNew} 
            disabled={isNew}
            size="sm"
          >
            Neue Bibliothek erstellen
          </Button>
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
                  <h4 className="font-medium">Bibliothek "{activeLibrary.label}" löschen</h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen einer Bibliothek ist permanent und kann nicht rückgängig gemacht werden.
                    Alle Einstellungen und Verweise auf diese Bibliothek gehen verloren.
                  </p>
                </div>
                
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Bibliothek "{activeLibrary.label}" löschen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bibliothek löschen</DialogTitle>
                      <DialogDescription>
                        Sind Sie sicher, dass Sie die Bibliothek "{activeLibrary.label}" löschen möchten? 
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
