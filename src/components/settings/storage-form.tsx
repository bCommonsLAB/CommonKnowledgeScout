"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback } from "react"
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
import { StorageProviderType } from "@/types/library"
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
  redirectUri: z.string().optional(),
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

export function StorageForm() {
  const searchParams = useSearchParams();
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestLogEntry[]>([]);
  const [authStatus, setAuthStatus] = useState<{ success?: boolean; error?: string; errorDescription?: string; libraryId?: string } | null>(null);
  const [processedAuthParams, setProcessedAuthParams] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [oauthDefaults, setOauthDefaults] = useState<{
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }>({
    tenantId: "",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
  });
  
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);
  
  const defaultValues: StorageFormValues = {
    type: "local",
    path: "",
    tenantId: "",
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
          redirectUri: data.defaults?.redirectUri ? 'vorhanden' : 'nicht vorhanden',
        });
        
        if (data.hasDefaults) {
          setOauthDefaults({
            tenantId: data.defaults.tenantId,
            clientId: data.defaults.clientId,
            clientSecret: data.defaults.clientSecret,
            redirectUri: data.defaults.redirectUri,
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
        libraryId: activeLibrary.id,
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
        redirectUri: activeLibrary.config?.redirectUri as string || oauthDefaults.redirectUri,
      };
      
      console.log('[StorageForm] Form-Daten zum Befüllen:', formData);
      form.reset(formData);
    } else {
      console.log('[StorageForm] Keine aktive Library zum Befüllen der Form');
    }
  }, [activeLibrary, form, oauthDefaults]);
  
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
        
        if (authenticatedLibraryId) {
          // Storage-Status explizit aktualisieren
          const library = libraries.find(lib => lib.id === authenticatedLibraryId);
          console.log('[StorageForm] Suche Library für Status-Update:', {
            authenticatedLibraryId,
            foundLibrary: library?.label,
            allLibraries: libraries.map(l => ({ id: l.id, label: l.label }))
          });
          
          if (library) {
            // Erfolgsmeldung anzeigen
            console.log('[StorageForm] Toast wird aufgerufen für Library:', library.label);
            try {
              toast.success("Authentifizierung erfolgreich", {
                description: `Die Verbindung zu OneDrive für "${library.label}" wurde erfolgreich hergestellt.`,
              });
              console.log('[StorageForm] Toast aufgerufen');
              
              // Setze auch die Success-Nachricht als Backup
              setAuthSuccessMessage(`Die Verbindung zu OneDrive für "${library.label}" wurde erfolgreich hergestellt.`);
              
              // Library-Daten neu laden, um die aktualisierten Tokens zu erhalten
              console.log('[StorageForm] Lade Library-Daten neu nach erfolgreicher OAuth...');
              
              // Async-Funktion zum Laden der Library - diese Funktion ist async!
              const loadUpdatedLibrary = async () => {
                try {
                  const response = await fetch(`/api/libraries/${authenticatedLibraryId}`);
                  if (response.ok) {
                    const updatedLibrary = await response.json();
                    console.log('[StorageForm] Aktualisierte Library erhalten:', {
                      id: updatedLibrary.id,
                      label: updatedLibrary.label,
                      hasTokens: !!updatedLibrary.config?.tokens
                    });
                    
                    // Libraries im State aktualisieren
                    const updatedLibraries = libraries.map(lib => 
                      lib.id === authenticatedLibraryId ? updatedLibrary : lib
                    );
                    setLibraries(updatedLibraries);
                    console.log('[StorageForm] Libraries-State aktualisiert');
                  } else {
                    console.error('[StorageForm] Fehler beim Laden der aktualisierten Library:', response.statusText);
                  }
                } catch (error) {
                  console.error('[StorageForm] Fehler beim Laden der Library-Daten:', error);
                }
              };
              
              // Async-Funktion aufrufen
              loadUpdatedLibrary();
            } catch (error) {
              console.error('[StorageForm] Fehler beim Anzeigen der Toast-Nachricht:', error);
              // Falls Toast fehlschlägt, setze trotzdem die Success-Nachricht
              setAuthSuccessMessage(`Die Verbindung zu OneDrive für "${library.label}" wurde erfolgreich hergestellt.`);
            }
          } else {
            console.warn('[StorageForm] Library nicht gefunden für Status-Update');
            console.log('[StorageForm] Toast für Warnung wird aufgerufen');
            try {
              toast.warning("Warnung", {
                description: "Die authentifizierte Bibliothek konnte nicht gefunden werden.",
              });
              console.log('[StorageForm] Warnung-Toast aufgerufen');
            } catch (error) {
              console.error('[StorageForm] Fehler beim Anzeigen der Warnung-Toast:', error);
            }
          }
        }
        
        // URL bereinigen - mit Verzögerung, damit Toast-Nachricht sichtbar bleibt
        setTimeout(() => {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('authSuccess');
          newUrl.searchParams.delete('libraryId');
          console.log('[StorageForm] Bereinige URL nach 2 Sekunden Verzögerung, navigiere zu:', newUrl.pathname);
          window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
        }, 2000);
      }
      
      // Authentifizierungsfehler
      if (hasAuthError) {
        const error = searchParams.get('authError');
        const errorDescription = searchParams.get('errorDescription');
        const errorLibraryId = searchParams.get('libraryId');
        
        console.error('[StorageForm] OAuth-Fehler:', {
          error,
          errorDescription,
          libraryId: errorLibraryId
        });
        
        let errorMessage = "Authentifizierung fehlgeschlagen";
        if (error === 'no_email') {
          errorMessage = "Keine E-Mail-Adresse gefunden";
        } else if (error === 'no_code') {
          errorMessage = "Kein Authentifizierungscode erhalten";
        } else if (error === 'no_library_id') {
          errorMessage = "Keine Bibliotheks-ID erhalten";
        } else if (error === 'library_not_found') {
          errorMessage = `Bibliothek nicht gefunden`;
        } else if (error === 'invalid_library_type') {
          errorMessage = `Ungültiger Bibliothekstyp`;
        } else if (error === 'auth_failed') {
          errorMessage = "Authentifizierung fehlgeschlagen";
        } else if (errorDescription) {
          errorMessage = errorDescription;
        }
        
        toast.error("Fehler bei der Authentifizierung", {
          description: errorMessage,
        });
        
        // URL bereinigen - mit Verzögerung, damit Toast-Nachricht sichtbar bleibt
        setTimeout(() => {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('authError');
          newUrl.searchParams.delete('errorDescription');
          newUrl.searchParams.delete('libraryId');
          newUrl.searchParams.delete('libraryType');
          console.log('[StorageForm] Bereinige URL nach Fehler nach 2 Sekunden Verzögerung, navigiere zu:', newUrl.pathname);
          window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
        }, 2000);
      }
      
      // Markiere als verarbeitet
      setProcessedAuthParams(true);
    }
  }, [searchParams, libraries, activeLibraryId, processedAuthParams]);
  
  const onSubmit = useCallback(async (data: StorageFormValues) => {
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
          storageConfig = {
            tenantId: data.tenantId,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            redirectUri: data.redirectUri,
          };
          break;
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
      toast.success("Storage-Einstellungen aktualisiert", {
        description: `Die Storage-Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      });
    } catch (error) {
      console.error('Fehler beim Speichern der Storage-Einstellungen:', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeLibrary, libraries, setLibraries]);

  // Funktion zum Testen des Storage-Providers
  async function handleTestStorage() {
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Keine Bibliothek ausgewählt.",
      });
      return;
    }

    setIsTesting(true);
    setTestResults([]); // Leere die Ergebnisse zu Beginn
    setTestDialogOpen(true);

    // Warte einen Moment, damit die Testdialog geöffnet und Ergebnisse geleert werden können
    await new Promise(resolve => setTimeout(resolve, 100));

    // Testergebnisse für einen Schritt protokollieren
    const logStep = (step: string, status: 'success' | 'error' | 'info', message: string, details?: TestLogEntry['details']) => {
      const logEntry: TestLogEntry = {
        step,
        status,
        message,
        timestamp: new Date().toISOString(),
        details
      };
      // Neuen Eintrag am Anfang hinzufügen, damit neueste Einträge zuerst kommen
      setTestResults(prev => [logEntry, ...prev]);
      return logEntry;
    };

    // Erste Log-Nachricht
    logStep("Initialisierung", "info", "Storage-Provider Test wird initialisiert...");

    try {
      // Storage Factory direkt verwenden
      const storageFactory = StorageFactory.getInstance();
      
      // Wir überschreiben fetch temporär, um die API-Aufrufe zu protokollieren
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' 
          ? input 
          : input instanceof URL 
            ? input.toString() 
            : input.url;
        const method = init?.method || 'GET';
        
        // Anfrage protokollieren
        const stepName = "API-Aufruf";
        logStep(stepName, "info", `Sende ${method}-Anfrage an ${url}`, {
          request: {
            url,
            method,
            params: init?.body ? 
              (typeof init.body === 'string' ? 
                JSON.parse(init.body) : 
                init.body instanceof FormData ? 
                  '[FormData]' : 
                  init.body) 
              : undefined
          }
        });
        
        // Originalen Fetch ausführen
        const startTime = performance.now();
        try {
          const response = await originalFetch(input, init);
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          
          // Klonen und Text-Daten für die Anzeige vorbereiten
          const clonedResponse = response.clone();
          let responseData;
          
          try {
            // Verschiedene Antworttypen verarbeiten
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              responseData = await clonedResponse.json();
            } else if (contentType?.includes('text/')) {
              responseData = await clonedResponse.text();
            } else {
              responseData = `[${contentType} Daten, ${Math.round((await clonedResponse.blob()).size / 1024)} KB]`;
            }
          } catch { // error wird nicht verwendet
            responseData = '[Konnte Antwortdaten nicht verarbeiten]';
          }
          
          // Erfolgreiche Antwort protokollieren
          logStep(stepName, "success", `${method}-Anfrage erfolgreich (${duration}ms): ${response.status} ${response.statusText}`, {
            request: { url, method },
            response: responseData
          });
          
          return response;
        } catch (error) {
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);
          
          // Fehler protokollieren
          logStep(stepName, "error", `${method}-Anfrage fehlgeschlagen (${duration}ms)`, {
            request: { url, method },
            error: error instanceof Error ? error.message : String(error)
          });
          
          throw error;
        }
      };

      try {
        // Provider holen
        logStep("Provider", "info", "Hole Storage-Provider für die Bibliothek...");
        const provider = await storageFactory.getProvider(activeLibrary.id);
        logStep("Provider", "success", `Provider "${provider.name}" erfolgreich initialisiert.`, {
          data: {
            providerId: provider.id,
            providerName: provider.name,
            libraryId: activeLibrary.id,
            libraryPath: activeLibrary.path
          }
        });

        // 1. Konfiguration validieren
        logStep("Validierung", "info", "Validiere Storage-Provider Konfiguration...");
        const validationResult = await provider.validateConfiguration();
        
        if (!validationResult.isValid) {
          logStep("Validierung", "error", `Storage-Provider Konfiguration ungültig: ${validationResult.error}`, {
            response: validationResult
          });
          throw new Error(`Konfiguration ungültig: ${validationResult.error}`);
        }
        
        logStep("Validierung", "success", "Storage-Provider Konfiguration ist gültig.", {
          response: validationResult
        });

        // 2. Root-Verzeichnis auflisten
        logStep("Root-Verzeichnis", "info", "Liste Root-Verzeichnis auf...");
        const rootItems = await provider.listItemsById('root');
        logStep("Root-Verzeichnis", "success", `Root-Verzeichnis erfolgreich aufgelistet. ${rootItems.length} Elemente gefunden.`, {
          data: {
            count: rootItems.length,
            items: rootItems.map(item => ({
              id: item.id,
              name: item.metadata.name,
              type: item.type,
              size: item.metadata.size
            }))
          }
        });

        // 3. Testverzeichnis erstellen
        const testFolderName = `test-folder-${Date.now()}`;
        logStep("Testverzeichnis", "info", `Erstelle Testverzeichnis "${testFolderName}"...`);
        const testFolder = await provider.createFolder('root', testFolderName);
        logStep("Testverzeichnis", "success", `Testverzeichnis "${testFolderName}" erfolgreich erstellt.`, {
          data: {
            id: testFolder.id,
            name: testFolder.metadata.name,
            parentId: testFolder.parentId
          }
        });

        // 4. Testdatei erstellen
        logStep("Testdatei", "info", "Erstelle Testdatei...");
        const testFileContent = "Dies ist eine Testdatei, erstellt von Knowledge Scout Storage Tester.";
        const testFileName = `test-file-${Date.now()}.txt`;
        
        // Blob aus String erstellen
        const blob = new Blob([testFileContent], { type: 'text/plain' });
        // File-Objekt erstellen
        const testFile = new File([blob], testFileName, { type: 'text/plain' });
        
        logStep("Testdatei", "info", `Datei vorbereitet: ${testFileName} (${blob.size} Bytes)`, {
          data: {
            name: testFileName,
            size: blob.size,
            content: testFileContent
          }
        });
        
        const createdFile = await provider.uploadFile(testFolder.id, testFile);
        logStep("Testdatei", "success", `Testdatei "${testFileName}" erfolgreich erstellt.`, {
          data: {
            id: createdFile.id,
            name: createdFile.metadata.name,
            size: createdFile.metadata.size,
            parentId: createdFile.parentId
          }
        });

        // 5. Verzeichnis auflisten
        logStep("Verzeichnisinhalt", "info", `Liste Inhalt des Testverzeichnisses auf...`);
        const folderItems = await provider.listItemsById(testFolder.id);
        logStep("Verzeichnisinhalt", "success", `Verzeichnisinhalt erfolgreich aufgelistet. ${folderItems.length} Element(e) gefunden.`, {
          data: {
            count: folderItems.length,
            items: folderItems.map(item => ({
              id: item.id,
              name: item.metadata.name,
              type: item.type,
              size: item.metadata.size
            }))
          }
        });

        // 6. Datei abrufen
        logStep("Datei abrufen", "info", "Rufe Testdatei ab...");
        const retrievedFile = await provider.getItemById(createdFile.id);
        logStep("Datei abrufen", "success", `Testdatei erfolgreich abgerufen: "${retrievedFile.metadata.name}" (${retrievedFile.metadata.size} Bytes)`, {
          data: {
            id: retrievedFile.id,
            name: retrievedFile.metadata.name,
            size: retrievedFile.metadata.size,
            mimeType: retrievedFile.metadata.mimeType,
            modifiedAt: retrievedFile.metadata.modifiedAt
          }
        });

        // 7. Binärdaten abrufen
        logStep("Binärdaten", "info", "Rufe Binärdaten der Testdatei ab...");
        try {
          const binaryData = await provider.getBinary(createdFile.id);
          const blobText = await binaryData.blob.text();
          const verificationResult = blobText === testFileContent;
          
          if (verificationResult) {
            logStep("Binärdaten", "success", `Binärdaten erfolgreich abgerufen. MIME-Typ: ${binaryData.mimeType}. Der Inhalt stimmt mit dem Original überein.`, {
              data: {
                mimeType: binaryData.mimeType,
                size: binaryData.blob.size,
                contentMatch: true,
                content: blobText.length > 100 ? blobText.substring(0, 100) + '...' : blobText
              }
            });
          } else {
            logStep("Binärdaten", "error", `Binärdaten abgerufen, aber der Inhalt stimmt nicht überein!`, {
              data: {
                mimeType: binaryData.mimeType,
                size: binaryData.blob.size,
                contentMatch: false,
                expected: testFileContent,
                actual: blobText.length > 100 ? blobText.substring(0, 100) + '...' : blobText
              }
            });
          }
        } catch (error) {
          logStep("Binärdaten", "error", `Fehler beim Abrufen der Binärdaten: ${String(error)}`, {
            error: String(error)
          });
        }

        // 8. Pfad abrufen
        logStep("Dateipfad", "info", "Rufe Pfad der Testdatei ab...");
        try {
          const filePath = await provider.getPathById(createdFile.id);
          logStep("Dateipfad", "success", `Pfad erfolgreich abgerufen: ${filePath}`, {
            data: {
              path: filePath,
              fileId: createdFile.id
            }
          });
        } catch (error) {
          logStep("Dateipfad", "error", `Fehler beim Abrufen des Pfads: ${String(error)}`, {
            error: String(error)
          });
        }

        // 9. Datei löschen
        logStep("Datei löschen", "info", "Lösche Testdatei...");
        try {
          await provider.deleteItem(createdFile.id);
          logStep("Datei löschen", "success", "Testdatei erfolgreich gelöscht.", {
            data: {
              fileId: createdFile.id,
              fileName: createdFile.metadata.name
            }
          });
        } catch (error) {
          logStep("Datei löschen", "error", `Fehler beim Löschen der Datei: ${String(error)}`, {
            error: String(error)
          });
        }

        // 10. Verzeichnis nach Löschung auflisten
        logStep("Verzeichnis prüfen", "info", "Prüfe Verzeichnisinhalt nach Löschung...");
        try {
          const folderItemsAfterDelete = await provider.listItemsById(testFolder.id);
          logStep("Verzeichnis prüfen", "success", `Verzeichnisinhalt erfolgreich geprüft. ${folderItemsAfterDelete.length} Element(e) gefunden.`, {
            data: {
              count: folderItemsAfterDelete.length,
              isEmpty: folderItemsAfterDelete.length === 0,
              items: folderItemsAfterDelete.map(item => ({
                id: item.id,
                name: item.metadata.name
              }))
            }
          });
        } catch (error) {
          logStep("Verzeichnis prüfen", "error", `Fehler beim Auflisten des Verzeichnisinhalts: ${String(error)}`, {
            error: String(error)
          });
        }

        // 11. Testverzeichnis löschen
        logStep("Aufräumen", "info", "Lösche Testverzeichnis...");
        try {
          await provider.deleteItem(testFolder.id);
          logStep("Aufräumen", "success", "Testverzeichnis erfolgreich gelöscht.", {
            data: {
              folderId: testFolder.id,
              folderName: testFolder.metadata.name
            }
          });
        } catch (error) {
          logStep("Aufräumen", "error", `Fehler beim Löschen des Testverzeichnisses: ${String(error)}`, {
            error: String(error)
          });
        }

        // Abschluss
        logStep("Zusammenfassung", "success", "Alle Tests wurden durchgeführt. Prüfen Sie die Ergebnisse auf mögliche Fehler.");
        
      } catch (error) {
        console.error('Fehler beim Testen des Storage-Providers:', error);
        logStep("Fehler", "error", `Unbehandelte Ausnahme: ${String(error)}`, {
          error: String(error)
        });
      } finally {
        // Ursprüngliches fetch wiederherstellen
        window.fetch = originalFetch;
      }
    } catch (error) {
      console.error('Fehler beim Initialisieren der Tests:', error);
      
      // Fehler zu den Testergebnissen hinzufügen
      setTestResults(prev => [...prev, {
        step: "Kritischer Fehler",
        status: "error",
        message: error instanceof Error ? error.message : "Unbekannter Fehler beim Testen",
        timestamp: new Date().toISOString(),
        details: {
          error: String(error)
        }
      }]);
      
      toast.error("Test fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Testen",
      });
    } finally {
      setIsTesting(false);
    }
  }
  
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
        clientSecret: updatedLibrary.config?.clientSecret ? 'vorhanden' : 'nicht vorhanden',
        redirectUri: updatedLibrary.config?.redirectUri
      });
      
      // Überprüfen, ob die erforderlichen Konfigurationswerte vorhanden sind
      if (!updatedLibrary.config?.clientId || !updatedLibrary.config?.clientSecret || !updatedLibrary.config?.redirectUri) {
        const missingParams = [
          !updatedLibrary.config?.clientId ? 'Client ID' : '',
          !updatedLibrary.config?.clientSecret ? 'Client Secret' : '',
          !updatedLibrary.config?.redirectUri ? 'Redirect URI' : ''
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
        return (
          <>
            {/* Auth-Status-Meldung zeigen, wenn Statusänderung erkannt wurde */}
            {authStatus && authStatus.libraryId === activeLibrary?.id && (
              <Alert variant={authStatus.success ? "default" : "destructive"} className="mb-4">
                {authStatus.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <AlertTitle>Erfolg</AlertTitle>
                    <AlertDescription>Die Authentifizierung bei OneDrive war erfolgreich.</AlertDescription>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    <AlertTitle>Fehler</AlertTitle>
                    <AlertDescription>
                      {authStatus.error === 'access_denied' ? 
                        'Der Zugriff wurde verweigert. Bitte erteilen Sie die erforderlichen Berechtigungen.' : 
                        `Fehler bei der Authentifizierung: ${authStatus.error || 'Unbekannter Fehler'}`}
                      {authStatus.errorDescription && ` (${authStatus.errorDescription})`}
                    </AlertDescription>
                  </>
                )}
              </Alert>
            )}
          
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
                    Die Tenant ID Ihrer Microsoft Azure AD-Anwendung.
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
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer Microsoft Azure AD-Anwendung.
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
                    <Input {...field} value={field.value || ""} placeholder="https://ihre-domain.de/api/auth/onedrive/callback" />
                  </FormControl>
                  <FormDescription>
                    Die Redirect URI für die OAuth2-Authentifizierung bei Microsoft.
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
                    <Input type="password" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer Google Drive-Anwendung.
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
                    Die Redirect URI für die OAuth2-Authentifizierung bei Google.
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
                  <td className="p-2 align-top text-xs font-mono">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2 align-top font-medium">
                    {result.step}
                  </td>
                  <td className="p-2 align-top">
                    {result.message}
                  </td>
                  <td className="p-2 align-top">
                    {result.status === 'success' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>Erfolg</span>
                      </div>
                    )}
                    {result.status === 'error' && (
                      <div className="flex items-center text-red-600">
                        <XCircle className="h-4 w-4 mr-1" />
                        <span>Fehler</span>
                      </div>
                    )}
                    {result.status === 'info' && (
                      <div className="flex items-center text-blue-600">
                        <Info className="h-4 w-4 mr-1" />
                        <span>Info</span>
                      </div>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    {(result.details || hasApiCalls(result.step, index)) && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 rounded-full">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" side="left">
                          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                            <h4 className="text-sm font-medium mb-2">Details: {result.step}</h4>
                            
                            {/* Zeige Details an, wenn vorhanden */}
                            {renderDetails(result)}
                            
                            {/* Zeige zugehörige API-Aufrufe */}
                            {renderApiCalls(result.step, index)}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
    
    // Hilfsfunktion: Prüft, ob es API-Aufrufe für einen bestimmten Schritt gibt
    const hasApiCalls = (step: string, resultIndex: number): boolean => {
      // Hole den aktuellen Result direkt (ohne Umkehrung, da wir bereits sortiert haben)
      const nonApiResults = testResults.filter(r => r.step !== "API-Aufruf");
      const currentResult = nonApiResults[resultIndex];
      
      // Suche nach API-Aufrufen für diesen Schritt
      const currentIndex = testResults.findIndex(r => r === currentResult);
      if (currentIndex === -1) return false;
      
      // Finde den nächsten Nicht-API-Schritt nach dem aktuellen
      let nextStepIndex = -1;
      for (let i = currentIndex + 1; i < testResults.length; i++) {
        if (testResults[i].step !== "API-Aufruf" && testResults[i].step !== step) {
          nextStepIndex = i;
          break;
        }
      }
      
      // Prüfe, ob es API-Aufrufe zwischen dem aktuellen Schritt und dem nächsten Schritt gibt
      const startIndex = currentIndex + 1;
      const endIndex = nextStepIndex > -1 ? nextStepIndex : testResults.length;
      
      return testResults
        .slice(startIndex, endIndex)
        .some(r => r.step === "API-Aufruf");
    }
    
    // Hilfsfunktion: Rendert die Details eines Testergebnisses
    const renderDetails = (result: TestLogEntry) => {
      if (!result.details) return null;
      
      return (
        <div className="space-y-3 text-xs">
          {result.details.data !== undefined && result.details.data !== null && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Daten:</div>
              <div className="bg-muted p-2 rounded overflow-x-auto max-h-[150px]">
                <pre>{JSON.stringify(result.details.data)}</pre>
              </div>
            </div>
          )}
          
          {result.details.response !== undefined && result.details.response !== null && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Antwort:</div>
              <div className="bg-muted p-2 rounded overflow-x-auto max-h-[150px]">
                <pre>{JSON.stringify(result.details.response)}</pre>
              </div>
            </div>
          )}
          
          {result.details.error !== undefined && result.details.error !== null && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Fehler:</div>
              <div className="bg-muted p-2 rounded overflow-x-auto text-red-500 max-h-[150px]">
                <pre>{JSON.stringify(result.details.error)}</pre>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Hilfsfunktion: Rendert die zugehörigen API-Aufrufe für einen Schritt
    const renderApiCalls = (step: string, resultIndex: number) => {
      // Hole den aktuellen Result direkt (ohne Umkehrung, da wir bereits sortiert haben)
      const nonApiResults = testResults.filter(r => r.step !== "API-Aufruf");
      const currentResult = nonApiResults[resultIndex];
      
      // Suche nach API-Aufrufen für diesen Schritt
      const currentIndex = testResults.findIndex(r => r === currentResult);
      if (currentIndex === -1) return null;
      
      // Finde den nächsten Nicht-API-Schritt nach dem aktuellen
      let nextStepIndex = -1;
      for (let i = currentIndex + 1; i < testResults.length; i++) {
        if (testResults[i].step !== "API-Aufruf" && testResults[i].step !== step) {
          nextStepIndex = i;
          break;
        }
      }
      
      // Sammle API-Aufrufe zwischen dem aktuellen Schritt und dem nächsten Schritt
      const startIndex = currentIndex + 1;
      const endIndex = nextStepIndex > -1 ? nextStepIndex : testResults.length;
      
      const apiCalls = testResults
        .slice(startIndex, endIndex)
        .filter(r => r.step === "API-Aufruf");
      
      if (apiCalls.length === 0) return null;
      
      return (
        <div className="mt-4">
          <div className="font-medium text-muted-foreground mb-2">API-Aufrufe:</div>
          <div className="space-y-2">
            {apiCalls.map((call, idx) => (
              <Collapsible key={idx} className="border rounded-md">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left hover:bg-muted/50">
                  <div className="flex items-center">
                    {call.status === 'success' && <CheckCircle className="h-3 w-3 mr-2 text-green-500" />}
                    {call.status === 'error' && <XCircle className="h-3 w-3 mr-2 text-red-500" />}
                    <span className="text-xs">{call.message}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-2 pt-0 text-xs border-t">
                  {call.details?.request && (
                    <div className="mt-2">
                      <div className="font-medium text-muted-foreground mb-1">Anfrage:</div>
                      <div className="bg-muted p-2 rounded overflow-x-auto">
                        <div>{call.details.request.method} {call.details.request.url}</div>
                      </div>
                    </div>
                  )}
                  
                  {call.details?.response !== undefined && call.details?.response !== null && (
                    <div className="mt-2">
                      <div className="font-medium text-muted-foreground mb-1">Antwort:</div>
                      <div className="bg-muted p-2 rounded overflow-x-auto max-h-[120px]">
                        <pre>{JSON.stringify(call.details.response)}</pre>
                      </div>
                    </div>
                  )}
                  
                  {call.details?.error !== undefined && call.details?.error !== null && (
                    <div className="mt-2">
                      <div className="font-medium text-muted-foreground mb-1">Fehler:</div>
                      <div className="bg-muted p-2 rounded overflow-x-auto text-red-500">
                        <pre>{JSON.stringify(call.details.error)}</pre>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      );
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
        {/* Success-Nachricht anzeigen, falls vorhanden */}
        {authSuccessMessage && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Erfolg</AlertTitle>
            <AlertDescription>
              {authSuccessMessage}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => setAuthSuccessMessage(null)}
              >
                Schließen
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeLibrary) {
                  form.reset({
                    type: activeLibrary.type as StorageProviderType,
                    path: activeLibrary.path || "",
                    tenantId: activeLibrary.config?.tenantId as string || oauthDefaults.tenantId,
                    clientId: activeLibrary.config?.clientId as string || oauthDefaults.clientId,
                    clientSecret: activeLibrary.config?.clientSecret as string || oauthDefaults.clientSecret,
                    redirectUri: activeLibrary.config?.redirectUri as string || oauthDefaults.redirectUri,
                  });
                }
              }}
              disabled={isLoading}
            >
              Zurücksetzen
            </Button>
            
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleTestStorage}
                  disabled={isLoading || isTesting}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {isTesting ? "Test läuft..." : "Storage testen"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[80vw] max-h-[80vh]">
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