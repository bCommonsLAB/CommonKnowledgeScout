"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Cloud, Database, FolderOpen } from "lucide-react"
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
import { StorageProviderType } from "@/types/library"

// Hauptschema für das Formular
const storageFormSchema = z.object({
  type: z.enum(["local", "onedrive", "gdrive"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  // Zusätzliche Storage-Konfiguration
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  redirectUri: z.string().optional(),
});

type StorageFormValues = z.infer<typeof storageFormSchema>

export function StorageForm() {
  const router = useRouter();
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const [isLoading, setIsLoading] = useState(false);
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  const defaultValues: StorageFormValues = {
    type: "local",
    path: "",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
  };
  
  const form = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues,
  });
  
  // Aktueller Storage-Typ
  const currentType = form.watch("type");
  
  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      form.reset({
        type: activeLibrary.type as StorageProviderType,
        path: activeLibrary.path || "",
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: activeLibrary.config?.clientSecret as string || "",
        redirectUri: activeLibrary.config?.redirectUri as string || "",
      });
    }
  }, [activeLibrary, form]);
  
  async function onSubmit(data: StorageFormValues) {
    setIsLoading(true);
    
    try {
      if (!activeLibrary) {
        throw new Error("Keine Bibliothek ausgewählt");
      }
      
      // Extrahiere die spezifischen Storage-Konfigurationen basierend auf dem Typ
      let storageConfig = {};
      
      switch(data.type) {
        case "local":
          storageConfig = {};
          break;
        case "onedrive":
        case "gdrive":
          storageConfig = {
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            redirectUri: data.redirectUri,
          };
          break;
      }
      
      // Bibliotheksobjekt aktualisieren
      const updatedLibrary = {
        ...activeLibrary,
        type: data.type,
        path: data.path,
        config: {
          ...activeLibrary.config,
          ...storageConfig,
        }
      };
      
      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedLibrary),
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Lokalen Zustand aktualisieren
      const updatedLibraries = libraries.map(lib => 
        lib.id === activeLibrary.id ? {
          ...lib,
          type: data.type,
          path: data.path,
          config: {
            ...lib.config,
            ...storageConfig,
          }
        } : lib
      );
      
      setLibraries(updatedLibraries);
      
      toast({
        title: "Storage-Einstellungen aktualisiert",
        description: `Die Storage-Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      });
      
    } catch (error) {
      console.error('Fehler beim Speichern der Storage-Einstellungen:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Storage-Typ-Icons
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
  }
  
  // Provider-spezifische Konfigurationsfelder
  const StorageConfigFields = () => {
    switch (currentType) {
      case "onedrive":
      case "gdrive":
        return (
          <>
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
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
              name="clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Secret</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} value={field.value || ""} />
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
              name="redirectUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Redirect URI</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="https://ihre-domain.de/auth/callback" />
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
  
  if (!activeLibrary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <StorageTypeIcon />
              <CardTitle>Storage-Einstellungen für {activeLibrary.label}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Speichertyp</FormLabel>
                  <Select 
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Speichertyp auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">Lokales Dateisystem</SelectItem>
                      <SelectItem value="onedrive">OneDrive</SelectItem>
                      <SelectItem value="gdrive">Google Drive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Der Typ des Speichers, in dem die Bibliotheksdateien gespeichert werden.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Speicherpfad</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Der Pfad, unter dem die Bibliotheksdateien gespeichert werden.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Spezifische Storage-Konfiguration basierend auf dem Typ */}
            {currentType !== "local" && (
              <div className="pt-2 space-y-4">
                <StorageConfigFields />
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (activeLibrary) {
                form.reset({
                  type: activeLibrary.type as StorageProviderType,
                  path: activeLibrary.path || "",
                  clientId: activeLibrary.config?.clientId as string || "",
                  clientSecret: activeLibrary.config?.clientSecret as string || "",
                  redirectUri: activeLibrary.config?.redirectUri as string || "",
                });
              }
            }}
            disabled={isLoading}
          >
            Zurücksetzen
          </Button>
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