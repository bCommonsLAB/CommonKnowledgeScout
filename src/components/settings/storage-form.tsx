"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback, Suspense } from "react"
import { useAtom, useAtomValue } from "jotai"
import { useSearchParams } from "next/navigation"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cloud, Database, FolderOpen, PlayCircle, CheckCircle, XCircle, Info, MoreHorizontal, ChevronDown } from "lucide-react"
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
import { toast } from "sonner"
import { StorageProviderType, ClientLibrary } from "@/types/library"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { StorageFactory } from "@/lib/storage/storage-factory"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { OneDriveProvider } from "@/lib/storage/onedrive-provider"
import { Badge } from "@/components/ui/badge"

// Hauptschema für das Formular
const storageFormSchema = z.object({
  type: z.enum(["local", "onedrive", "gdrive"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  // Zusätzliche Storage-Konfiguration
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

type StorageFormValues = z.infer<typeof storageFormSchema>

// Test-Ergebnis Typ
interface TestLogEntry {
  step: string;
  status: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
  details?: {
    request?: {
      url?: string;
      method?: string;
      params?: Record<string, unknown>;
    };
    response?: unknown;
    data?: unknown;
    error?: unknown;
  };
}

// Wrapper-Komponente für useSearchParams
function StorageFormWithSearchParams() {
  const searchParams = useSearchParams();
  return <StorageFormContent searchParams={searchParams} />;
}

// Hauptkomponente ohne useSearchParams
function StorageFormContent({ searchParams }: { searchParams: URLSearchParams }) {
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestLogEntry[]>([]);
  const [processedAuthParams, setProcessedAuthParams] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [oauthDefaults, setOauthDefaults] = useState<{
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }>({
    tenantId: "",
    clientId: "",
    clientSecret: "",
  });
  
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  const defaultValues: StorageFormValues = {
    type: "local",
    path: "",
    tenantId: "",
    clientId: "",
    clientSecret: "",
  };
  
  const form = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues,
  });
  
  // Aktueller Storage-Typ
  const currentType = form.watch("type");
  
  // Logging für Mount und wichtige State-Änderungen
  useEffect(() => {
    console.log('[StorageForm] Komponente gemountet/aktualisiert:', {
      pathname: window.location.pathname,
      search: window.location.search,
      activeLibraryId,
      activeLibraryLabel: activeLibrary?.label,
      librariesCount: libraries.length,
      formValues: form.getValues()
    });
  }, [activeLibraryId, activeLibrary, libraries.length, form]);
  
  // Lade OAuth-Standardwerte über die API
  useEffect(() => {
    async function loadOAuthDefaults() {
      try {
        console.log('[StorageForm] Lade OAuth-Standardwerte...');
        const response = await fetch('/api/settings/oauth-defaults');
        
        if (!response.ok) {
          throw new Error(`Fehler beim Laden der OAuth-Standardwerte: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[StorageForm] Geladene OAuth-Defaults:', {
          hasDefaults: data.hasDefaults,
          tenantId: data.defaults?.tenantId ? 'vorhanden' : 'nicht vorhanden',
          clientId: data.defaults?.clientId ? 'vorhanden' : 'nicht vorhanden',
          clientSecret: data.defaults?.clientSecret ? 'vorhanden' : 'nicht vorhanden',
        });
        
        if (data.hasDefaults) {
          setOauthDefaults({
            tenantId: data.defaults.tenantId,
            clientId: data.defaults.clientId,
            clientSecret: data.defaults.clientSecret,
          });
          console.log('[StorageForm] OAuth-Standardwerte gesetzt');
        } else {
          console.log('[StorageForm] Keine OAuth-Standardwerte gefunden');
        }
      } catch (error) {
        console.error('[StorageForm] Fehler beim Laden der OAuth-Standardwerte:', error);
      }
    }
    
    loadOAuthDefaults();
  }, []);
  
  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      console.log('[StorageForm] Befülle Form mit Library-Daten:', {
        libraryLabel: activeLibrary.label,
        type: activeLibrary.type,
        path: activeLibrary.path,
        config: activeLibrary.config
      });
      
      // Wenn Bibliothek gewechselt wird, Formular mit den Werten befüllen
      const formData = {
        type: activeLibrary.type as StorageProviderType,
        path: activeLibrary.path || "",
        // Alle Werte direkt aus der Bibliothek oder aus den Defaults verwenden, keine Maskierung
        tenantId: activeLibrary.config?.tenantId as string || oauthDefaults.tenantId,
        clientId: activeLibrary.config?.clientId as string || oauthDefaults.clientId,
        clientSecret: activeLibrary.config?.clientSecret as string || oauthDefaults.clientSecret,
      };
      
      console.log('[StorageForm] Form-Daten zum Befüllen:', formData);
      form.reset(formData);
    } else {
      console.log('[StorageForm] Keine aktive Library zum Befüllen der Form');
    }
  }, [activeLibrary, form, oauthDefaults, setLibraries]);
  
  // OAuth Erfolgs-/Fehlermeldungen aus URL-Parametern verarbeiten
  useEffect(() => {
    // Nur verarbeiten wenn:
    // 1. Libraries geladen sind (sonst können wir die Library nicht finden)
    // 2. Wir die Parameter noch nicht verarbeitet haben
    // 3. Es überhaupt Auth-Parameter gibt
    const hasAuthSuccess = searchParams.get('authSuccess') === 'true';
    const hasAuthError = searchParams.get('authError');
    
    if (!processedAuthParams && libraries.length > 0 && (hasAuthSuccess || hasAuthError)) {
      console.log('[StorageForm] useEffect für Query-Parameter ausgeführt', {
        pathname: window.location.pathname,
        search: window.location.search,
        authSuccess: searchParams.get('authSuccess'),
        authError: searchParams.get('authError'),
        libraryId: searchParams.get('libraryId'),
        activeLibraryId,
        librariesLoaded: libraries.length
      });
      
      // Erfolgreiche Authentifizierung
      if (hasAuthSuccess) {
        const authenticatedLibraryId = searchParams.get('libraryId');
        console.log('[StorageForm] OAuth erfolgreich für Library:', authenticatedLibraryId);
        
        // Erfolgsmeldung setzen
        setAuthSuccessMessage("Die Authentifizierung bei OneDrive war erfolgreich.");
        
        // Library-Daten neu laden
        if (authenticatedLibraryId) {
          fetch(`/api/libraries/${authenticatedLibraryId}`)
            .then(response => response.json())
            .then(updatedLibrary => {
              console.log('[StorageForm] Library nach OAuth aktualisiert:', {
                id: updatedLibrary.id,
                label: updatedLibrary.label,
                type: updatedLibrary.type
              });
              
              // Library in der Liste aktualisieren
              setLibraries(libraries.map(lib => lib.id === updatedLibrary.id ? updatedLibrary : lib));
            })
            .catch(error => {
              console.error('[StorageForm] Fehler beim Laden der aktualisierten Library:', error);
            });
        }
      }
      
      // Fehler bei der Authentifizierung
      if (hasAuthError) {
        const errorMessage = searchParams.get('authError');
        console.error('[StorageForm] OAuth-Fehler:', errorMessage);
        toast.error("Fehler bei der Authentifizierung", {
          description: errorMessage || "Unbekannter Fehler bei der Authentifizierung",
        });
      }
      
      // Parameter als verarbeitet markieren
      setProcessedAuthParams(true);
    }
  }, [searchParams, libraries, activeLibraryId, processedAuthParams, setLibraries]);
  
  // Formular absenden
  const onSubmit = async (data: StorageFormValues) => {
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Keine Bibliothek ausgewählt.",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('[StorageForm] Speichere Formular-Daten:', {
        libraryId: activeLibrary.id,
        libraryLabel: activeLibrary.label,
        formData: data
      });
      
      // Konfiguration für die API vorbereiten
      const config: Record<string, string> = {};
      
      // Nur die für den ausgewählten Typ relevanten Felder hinzufügen
      if (data.type === 'onedrive' || data.type === 'gdrive') {
        if (data.tenantId) config.tenantId = data.tenantId;
        if (data.clientId) config.clientId = data.clientId;
        if (data.clientSecret) config.clientSecret = data.clientSecret;
      }
      
      // API-Aufruf
      const response = await fetch(`/api/libraries/${activeLibrary.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: data.type,
          path: data.path,
          config
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`);
      }
      
      const updatedLibrary = await response.json();
      console.log('[StorageForm] Library aktualisiert:', {
        id: updatedLibrary.id,
        label: updatedLibrary.label,
        type: updatedLibrary.type
      });
      
      // Library in der Liste aktualisieren
      setLibraries(libraries.map(lib => lib.id === updatedLibrary.id ? updatedLibrary : lib));
      
      toast.success("Erfolg", {
        description: "Die Einstellungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('[StorageForm] Fehler beim Speichern:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Funktion zum Starten der OneDrive-Authentifizierung
  const handleOneDriveAuth = useCallback(async () => {
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Keine Bibliothek ausgewählt.",
      });
      return;
    }
    
    try {
      // Prüfen, ob es ungespeicherte Änderungen gibt und diese speichern
      if (form.formState.isDirty) {
        // Zuerst die aktuellen Formularwerte speichern
        toast.info("Speichere Änderungen", {
          description: "Die aktuellen Konfigurationseinstellungen werden gespeichert...",
        });
        
        // Die onSubmit-Funktion aufrufen, um die Änderungen zu speichern
        await onSubmit(form.getValues());
        
        // Kurz warten, damit die Änderungen gespeichert werden können
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Die Bibliothek neu laden, um sicherzustellen, dass wir die aktuellsten Daten haben
      const response = await fetch(`/api/libraries/${activeLibrary.id}`);
      if (!response.ok) {
        throw new Error(`Fehler beim Laden der Bibliothek: ${response.statusText}`);
      }
      
      const updatedLibrary = await response.json();
      console.log('[StorageForm] Verwende gespeicherte Bibliothekskonfiguration:', {
        id: updatedLibrary.id,
        clientId: updatedLibrary.config?.clientId ? 'vorhanden' : 'nicht vorhanden',
        clientSecret: updatedLibrary.config?.clientSecret ? 'vorhanden' : 'nicht vorhanden'
      });
      
      // Überprüfen, ob die erforderlichen Konfigurationswerte vorhanden sind
      if (!updatedLibrary.config?.clientId || !updatedLibrary.config?.clientSecret) {
        const missingParams = [
          !updatedLibrary.config?.clientId ? 'Client ID' : '',
          !updatedLibrary.config?.clientSecret ? 'Client Secret' : ''
        ].filter(Boolean).join(', ');
        
        toast.error("Unvollständige Konfiguration", {
          description: `Bitte füllen Sie alle erforderlichen Felder aus und speichern Sie die Änderungen: ${missingParams}`,
        });
        return;
      }
      
      // Debug-Informationen
      console.log('[StorageForm] Starte OneDrive-Authentifizierung für Bibliothek:', {
        id: updatedLibrary.id,
        label: updatedLibrary.label,
        type: updatedLibrary.type
      });
      
      const provider = new OneDriveProvider(updatedLibrary);
      
      // Die getAuthUrl Methode ist jetzt asynchron
      const authUrlString = await provider.getAuthUrl();
      
      // Library-ID als state-Parameter übergeben
      const urlWithState = new URL(authUrlString);
      urlWithState.searchParams.set('state', updatedLibrary.id);
      
      // Finale URL loggen
      console.log('[StorageForm] Weiterleitung zu:', urlWithState.toString());
      
      // Zu Microsoft-Anmeldeseite weiterleiten
      window.location.href = urlWithState.toString();
    } catch (error) {
      console.error('[StorageForm] Fehler beim Starten der OneDrive-Authentifizierung:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Authentifizierung",
      });
    }
  }, [activeLibrary, form, onSubmit]);
  
  // Funktion zum Testen des Storage-Providers
  const handleTest = async () => {
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Keine Bibliothek ausgewählt.",
      });
      return;
    }
    setIsTesting(true);
    setTestResults([]);
    setTestDialogOpen(true);
    try {
      const logs: TestLogEntry[] = [];
      logs.push({
        timestamp: new Date().toISOString(),
        step: "API-Aufruf",
        message: `Teste Storage-Provider für Bibliothek "${activeLibrary.label}"`,
        status: "info"
      });
      const response = await fetch(`/api/teststorage?libraryId=${activeLibrary.id}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Fehler beim Testen: ${response.statusText}`);
      }
      // JSONL-Stream verarbeiten
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              logs.push(entry);
            } catch (err) {
              console.error('[StorageForm] Fehler beim Parsen einer Log-Zeile:', line, err);
              toast.error('Fehler beim Parsen einer Log-Zeile', { description: line });
            }
          }
        }
        // Restpuffer verarbeiten
        if (buffer.trim()) {
          try {
            const entry = JSON.parse(buffer);
            logs.push(entry);
          } catch (err) {
            console.error('[StorageForm] Fehler beim Parsen des Restpuffers:', buffer, err);
            toast.error('Fehler beim Parsen des Restpuffers', { description: buffer });
          }
        }
      }
      setTestResults(logs);
    } catch (error) {
      console.error('[StorageForm] Fehler beim Testen:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Testen",
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  // Rendern der spezifischen Felder je nach Storage-Typ
  const renderStorageTypeFields = () => {
    switch (currentType) {
      case "onedrive":
        return (
          <>
            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Die Tenant ID Ihres Microsoft Azure AD-Verzeichnisses. Lassen Sie dieses Feld leer für persönliche Microsoft-Konten.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    Die Client ID Ihrer Microsoft Azure AD-Anwendung.
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
                    <Input {...field} type="password" value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer Microsoft Azure AD-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleOneDriveAuth}
                className="w-full"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Bei OneDrive anmelden
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Klicken Sie auf den Button, um sich bei OneDrive anzumelden und Zugriff auf Ihre Dateien zu erteilen.
              </p>
            </div>
          </>
        );
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
                    Die Client ID Ihrer Google Drive-Anwendung.
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
                    <Input {...field} type="password" value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer Google Drive-Anwendung.
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
  
  // Testresultate rendern
  const renderTestResults = () => {
    if (testResults.length === 0) {
      return <p className="text-muted-foreground">Testergebnisse werden geladen...</p>;
    }

    // Gruppiere die Tests nach StorageProvider-Funktionen
    const testsByFunction: Record<string, TestLogEntry[]> = {};
    
    testResults.forEach(result => {
      // Ignoriere API-Aufrufe in der Hauptansicht
      if (result.step === "API-Aufruf") return;
      
      // Füge den Test zur entsprechenden Funktion hinzu
      if (!testsByFunction[result.step]) {
        testsByFunction[result.step] = [];
      }
      testsByFunction[result.step].push(result);
    });

    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="bg-muted/50">
            <tr className="text-xs border-b">
              <th className="text-left p-2 font-medium">Datum/Zeit</th>
              <th className="text-left p-2 font-medium">Funktion</th>
              <th className="text-left p-2 font-medium">Beschreibung</th>
              <th className="text-left p-2 font-medium w-[100px]">Status</th>
              <th className="text-left p-2 font-medium w-[80px]">Details</th>
            </tr>
          </thead>
          <tbody>
            {testResults
              .filter(result => result.step !== "API-Aufruf") // Filtere API-Aufrufe aus der Hauptansicht
              .map((result, index) => (
                <tr 
                  key={index} 
                  className={`text-xs border-b hover:bg-muted/20 ${
                    result.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : 
                    result.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' : ''
                  }`}
                >
                  <td className="p-2">{result.timestamp && !isNaN(Date.parse(result.timestamp)) ? new Date(result.timestamp).toLocaleTimeString() : ''}</td>
                  <td className="p-2">{result.step}</td>
                  <td className="p-2">{result.message}</td>
                  <td className="p-2">
                    <Badge 
                      variant={
                        result.status === 'error' ? 'destructive' :
                        result.status === 'success' ? 'default' :
                        'secondary'
                      }
                    >
                      {result.status}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {result.details && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => {
                          toast.info("Details", {
                            description: typeof result.details === 'string' ? result.details : JSON.stringify(result.details),
                          });
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
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
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Speichertyp</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen Sie einen Speichertyp" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="local">Lokales Dateisystem</SelectItem>
                    <SelectItem value="onedrive">Microsoft OneDrive</SelectItem>
                    <SelectItem value="gdrive">Google Drive</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Wählen Sie den Typ des Speichers, den Sie verwenden möchten.
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
                  <Input {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>
                  Der Pfad, unter dem die Dateien gespeichert werden sollen.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {renderStorageTypeFields()}
          
          {authSuccessMessage && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Erfolg</AlertTitle>
              <AlertDescription>
                {authSuccessMessage}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !activeLibrary}
            >
              {isTesting ? "Teste..." : "Storage testen"}
            </Button>
            
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Storage-Provider Test</DialogTitle>
                  <DialogDescription>
                    Test des Storage-Providers für die Bibliothek &quot;{activeLibrary.label}&quot;
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  {renderTestResults()}
                </div>
                <div className="flex justify-end">
                  <Button 
                    onClick={() => setTestDialogOpen(false)} 
                    variant="secondary"
                  >
                    Schließen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
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

// Exportierte Komponente mit Suspense
export function StorageForm() {
  return (
    <Suspense fallback={<div>Lade Storage-Einstellungen...</div>}>
      <StorageFormWithSearchParams />
    </Suspense>
  );
} 