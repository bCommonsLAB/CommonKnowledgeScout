"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
import { AlertCircle, Trash2, Plus, Download, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { StorageProviderType } from "@/types/library"
import { CreateLibraryDialog } from "@/components/library/create-library-dialog"

// Hauptschema für das Formular mit erweiterter Konfiguration
const libraryFormSchema = z.object({
  label: z.string({
    required_error: "Bitte geben Sie einen Namen ein.",
  }).min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  path: z.string({
    required_error: "Bitte geben Sie einen Speicherpfad ein.",
  }),
  type: z.enum(["local", "onedrive", "gdrive", "nextcloud"], {
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const [shadowTwinMode, setShadowTwinMode] = useState<'legacy' | 'v2'>('legacy');
  const [isUpgradingShadowTwinMode, setIsUpgradingShadowTwinMode] = useState(false);
  // Shadow-Twin-Config (neue Flags) - bewusst lokal gehalten, da sie nicht Teil des Form-Schemas sind.
  const [shadowTwinPrimaryStore, setShadowTwinPrimaryStore] = useState<'filesystem' | 'mongo'>('filesystem');
  const [shadowTwinPersistToFilesystem, setShadowTwinPersistToFilesystem] = useState(true);
  const [shadowTwinAllowFilesystemFallback, setShadowTwinAllowFilesystemFallback] = useState(true);
  const shadowTwinConfigRef = useRef({
    primaryStore: 'filesystem' as 'filesystem' | 'mongo',
    persistToFilesystem: true,
    allowFilesystemFallback: true,
  });
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [dryRunRecursive, setDryRunRecursive] = useState(true);
  const [dryRunCleanupFilesystem, setDryRunCleanupFilesystem] = useState(false);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [migrationRuns, setMigrationRuns] = useState<Array<{
    runId: string
    status: 'running' | 'completed' | 'failed'
    params: {
      folderId?: string
      recursive?: boolean
      dryRun?: boolean
      cleanupFilesystem?: boolean
      limit?: number
    }
    startedAt: string
    finishedAt?: string
    steps?: Array<{ name: string; at: string; meta?: Record<string, unknown> }>
    report?: {
      upsertedArtifacts?: Array<{
        sourceId: string
        sourceName: string
        artifactFileName: string
        kind: 'transcript' | 'transformation'
        targetLanguage: string
        templateName?: string
        mongoUpserted: boolean
        blobImages?: number
        blobErrors?: number
        binaryFragmentsCount?: number
        markdownFiles?: number
        imageFiles?: number
        audioFiles?: number
        videoFiles?: number
        otherFiles?: number
        filesystemDeleted: boolean
      }>
      upsertedArtifactsTruncated?: boolean
    }
  }>>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [binaryFragments, setBinaryFragments] = useState<Array<{
    sourceId: string
    sourceName: string
    name: string
    kind: string
    url?: string
    hash?: string
    mimeType?: string
    size?: number
    createdAt: string
  }>>([]);
  const [loadingFragments, setLoadingFragments] = useState(false);
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId);

  // Shadow-Twin-Modus aus der Library-Config ableiten (Default: legacy)
  useEffect(() => {
    const modeFromLibrary = activeLibrary?.config?.shadowTwin
      ? (activeLibrary.config.shadowTwin as { mode?: unknown }).mode
      : undefined;

    setShadowTwinMode(modeFromLibrary === 'v2' ? 'v2' : 'legacy');

    // Shadow-Twin-Flags aus der Library-Config ableiten.
    const configShadowTwin = activeLibrary?.config?.shadowTwin as {
      primaryStore?: 'filesystem' | 'mongo';
      persistToFilesystem?: boolean;
      allowFilesystemFallback?: boolean;
    } | undefined;

    const primaryStore = configShadowTwin?.primaryStore || 'filesystem';
    const nextSnapshot = {
      primaryStore,
      persistToFilesystem:
        typeof configShadowTwin?.persistToFilesystem === 'boolean'
          ? configShadowTwin.persistToFilesystem
          : primaryStore === 'filesystem',
      allowFilesystemFallback: configShadowTwin?.allowFilesystemFallback ?? true,
    };
    shadowTwinConfigRef.current = nextSnapshot;
    setShadowTwinPrimaryStore(primaryStore);
    setShadowTwinPersistToFilesystem(nextSnapshot.persistToFilesystem);
    setShadowTwinAllowFilesystemFallback(nextSnapshot.allowFilesystemFallback);
  }, [activeLibrary?.id, activeLibrary?.config]);
  
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
    // Defaults fuer neue Library (konservativ).
    setShadowTwinPrimaryStore('filesystem');
    setShadowTwinPersistToFilesystem(true);
    // Hinweis: cleanupFilesystemOnMigrate ist kein separater State mehr
    setShadowTwinAllowFilesystemFallback(true);
  }, [form, defaultValues, setActiveLibraryId]);

  const isShadowTwinConfigDirty = useMemo(() => {
    const current = shadowTwinConfigRef.current;
    return (
      shadowTwinPrimaryStore !== current.primaryStore ||
      shadowTwinPersistToFilesystem !== current.persistToFilesystem ||
      shadowTwinAllowFilesystemFallback !== current.allowFilesystemFallback
    );
  }, [
    shadowTwinPrimaryStore,
    shadowTwinPersistToFilesystem,
    shadowTwinAllowFilesystemFallback,
  ]);

  // Funktion zum Zurückkehren zur Bearbeitung der aktiven Bibliothek
  const handleCancelNew = useCallback(() => {
    setIsNew(false);
    // Zurück zur aktiven Bibliothek, falls vorhanden
    if (activeLibrary) {
      // clientSecret: Wenn maskiert ('********'), leer lassen damit das Backend den Wert behält
      const rawClientSecret = activeLibrary.config?.clientSecret as string || "";
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: activeLibrary.config?.clientId as string || "",
        clientSecret: rawClientSecret === '********' ? '' : rawClientSecret,
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

  // Dry-Run: Shadow-Twin Migration (UI-Test)
  const runShadowTwinMigration = useCallback(async () => {
    if (!activeLibraryId) {
      toast({
        title: "Fehler",
        description: "Keine aktive Library gewählt.",
        variant: "destructive",
      });
      return;
    }

    setDryRunRunning(true);
    setDryRunError(null);
    try {
      const res = await fetch(`/api/library/${activeLibraryId}/shadow-twins/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: 'root',
          recursive: dryRunRecursive,
          dryRun: false,
          cleanupFilesystem: dryRunCleanupFilesystem,
        }),
      });

      const json = await res.json().catch(() => ({})) as { report?: Record<string, unknown>; runId?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      // Nach erfolgreichem Upsert: Migration-Runs neu laden und den neuen Run auswählen
      if (json.runId) {
        // Lade die Migration-Runs neu, um den neuen Run zu sehen
        const runsRes = await fetch(`/api/library/${activeLibraryId}/shadow-twins/migrations?limit=10`);
        if (runsRes.ok) {
          const runsJson = await runsRes.json() as { runs?: Array<{
            runId: string
            status: 'running' | 'completed' | 'failed'
            params?: {
              folderId?: string
              recursive?: boolean
              dryRun?: boolean
              cleanupFilesystem?: boolean
              limit?: number
            }
            startedAt: string
          }> };
          const runsArray = Array.isArray(runsJson.runs) ? runsJson.runs : [];
          // Filtere Runs ohne params und Dry-Runs heraus
          const runs = runsArray.filter((run): run is typeof run & { params: NonNullable<typeof run.params> } => 
            !!run?.params && !run.params.dryRun
          );
          setMigrationRuns(runs);
          // Wähle den neuen Run automatisch aus
          setSelectedRunId(json.runId as string);
        }
      }
      toast({
        title: "Upsert abgeschlossen",
        description: "Migration erfolgreich durchgeführt. Der Report wird in der Tabelle angezeigt.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDryRunError(message);
      toast({
        title: "Upsert fehlgeschlagen",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDryRunRunning(false);
    }
  }, [activeLibraryId, dryRunRecursive, dryRunCleanupFilesystem]);

  useEffect(() => {
    if (!isDryRunOpen || !activeLibraryId) return;

    let cancelled = false;
    async function loadRuns() {
      try {
        const res = await fetch(`/api/library/${activeLibraryId}/shadow-twins/migrations?limit=10`);
        const json = await res.json().catch(() => ({})) as { 
          error?: string
          runs?: Array<{ 
            runId: string
            status: 'running' | 'completed' | 'failed'
            params?: {
              folderId?: string
              recursive?: boolean
              dryRun?: boolean
              cleanupFilesystem?: boolean
              limit?: number
            }
            startedAt: string
          }> 
        };
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        // Stelle sicher, dass runs ein Array ist
        const runsArray = Array.isArray(json.runs) ? json.runs : [];
        // Filtere Runs ohne params und Dry-Runs heraus
        const runs = runsArray.filter((run): run is typeof run & { params: NonNullable<typeof run.params> } => 
          !!run?.params && !run.params.dryRun
        );
        setMigrationRuns(runs);
        if (runs.length > 0 && runs[0]?.runId) {
          setSelectedRunId(runs[0].runId);
        } else {
          setSelectedRunId(null);
        }
      } catch {
        if (cancelled) return;
        setMigrationRuns([]);
        setSelectedRunId(null);
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [isDryRunOpen, activeLibraryId]);

  // Stelle sicher, dass migrationRuns immer ein Array ist
  const migrationRunsArray = Array.isArray(migrationRuns) ? migrationRuns : [];
  const selectedRun = migrationRunsArray.find((run) => run.runId === selectedRunId) || null;

  // Lade binaryFragments aus MongoDB, wenn ein Run ausgewählt ist
  useEffect(() => {
    if (!selectedRun || !activeLibraryId || !selectedRun.report?.upsertedArtifacts) {
      setBinaryFragments([]);
      return;
    }

    let cancelled = false;
    // selectedRun ist hier garantiert nicht null (wird oben geprüft)
    const currentRun = selectedRun!;
    async function loadFragments() {
      setLoadingFragments(true);
      try {
        // Sammle alle eindeutigen sourceIds aus dem Report
        const sourceIds = Array.from(
          new Set(
            (currentRun.report?.upsertedArtifacts || []).map((a) => a.sourceId).filter(Boolean)
          )
        );

        if (sourceIds.length === 0) {
          setBinaryFragments([]);
          return;
        }

        // Lade binaryFragments aus MongoDB
        const res = await fetch(`/api/library/${activeLibraryId}/shadow-twins/binary-fragments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json() as { fragments?: Array<{
          sourceId: string
          sourceName: string
          name: string
          kind: string
          url?: string
          hash?: string
          mimeType?: string
          size?: number
          createdAt: string
        }> };

        if (cancelled) return;
        setBinaryFragments(json.fragments || []);
      } catch (error) {
        if (cancelled) return;
        console.error('Fehler beim Laden der binaryFragments:', error);
        setBinaryFragments([]);
      } finally {
        if (!cancelled) {
          setLoadingFragments(false);
        }
      }
    }

    void loadFragments();
    return () => {
      cancelled = true;
    };
  }, [selectedRun?.runId, activeLibraryId]);

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
      
      // Existierende Config der aktiven Library bewahren (z.B. nextcloud-Credentials),
      // die in diesem Formular nicht bearbeitet werden.
      const existingConfig = activeLibrary?.config ?? {};

      switch(data.type) {
        case "local":
          storageConfig = {
            basePath: data.storageConfig.basePath,
          };
          break;
        case "onedrive":
        case "gdrive": {
          // WICHTIG: clientSecret nur senden, wenn es NICHT der maskierte Wert ist
          // Wenn es '********' ist, wurde kein neues Secret eingegeben und das Backend 
          // soll den bestehenden Wert behalten
          const clientSecret = data.storageConfig.clientSecret;
          const shouldSendSecret = clientSecret && 
            clientSecret !== '********' && 
            clientSecret.trim() !== '';
          
          storageConfig = {
            clientId: data.storageConfig.clientId,
            // Nur senden wenn es ein echter neuer Wert ist
            ...(shouldSendSecret ? { clientSecret: clientSecret.trim() } : {}),
            redirectUri: data.storageConfig.redirectUri,
          };
          break;
        }
        case "nextcloud":
          // Nextcloud-Credentials werden im Storage-Formular verwaltet, nicht hier.
          // Existierende Config durchreichen, damit sie nicht gelöscht wird.
          if (existingConfig.nextcloud) {
            storageConfig = { nextcloud: existingConfig.nextcloud };
          }
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
          // Shadow-Twin-Konfiguration explizit persistieren.
          shadowTwin: {
            mode: shadowTwinMode,
            primaryStore: shadowTwinPrimaryStore,
            persistToFilesystem: shadowTwinPersistToFilesystem,
            allowFilesystemFallback: shadowTwinAllowFilesystemFallback,
          },
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
  
  // Bibliothek exportieren
  const handleExportLibrary = async () => {
    if (!activeLibraryId || !user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek zum Exportieren ausgewählt oder Benutzer nicht angemeldet.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/libraries/${activeLibraryId}/export`);
      
      if (!response.ok) {
        throw new Error(`Fehler beim Exportieren: ${response.statusText}`);
      }
      
      // Datei herunterladen
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `library-${activeLibrary?.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Bibliothek exportiert",
        description: `Die Bibliothek "${activeLibrary?.label}" wurde erfolgreich exportiert.`,
      });
    } catch (error) {
      console.error('Fehler beim Exportieren der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Exportieren",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Bibliothek importieren
  const handleImportLibrary = async (file: File) => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um eine Bibliothek zu importieren.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Datei als Text lesen
      const text = await file.text();
      const libraryData = JSON.parse(text);
      
      // API-Anfrage zum Importieren der Bibliothek
      const response = await fetch('/api/libraries/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ libraryData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Fehler beim Importieren: ${response.statusText}`);
      }
      
      const result = await response.json();
      const importedLibrary = result.library;
      
      // Lokalen Zustand aktualisieren
      const newLibrary = {
        ...importedLibrary,
        icon: <AlertCircle className="h-4 w-4" />,
      };
      setLibraries([...libraries, newLibrary]);
      setActiveLibraryId(importedLibrary.id);
      setIsNew(false);
      setIsImportDialogOpen(false);
      
      // Form mit importierten Daten befüllen
      const storageConfig = {
        basePath: importedLibrary.path,
        clientId: importedLibrary.config?.clientId as string || "",
        clientSecret: importedLibrary.config?.clientSecret as string || "",
        redirectUri: importedLibrary.config?.redirectUri as string || "",
      };
      
      form.reset({
        label: importedLibrary.label,
        path: importedLibrary.path,
        type: importedLibrary.type,
        description: importedLibrary.config?.description as string || "",
        isEnabled: importedLibrary.isEnabled,
        transcription: importedLibrary.transcription,
        templateDirectory: importedLibrary.config?.templateDirectory as string || "/templates",
        storageConfig,
      });
      
      toast({
        title: "Bibliothek importiert",
        description: `Die Bibliothek "${importedLibrary.label}" wurde erfolgreich importiert.`,
      });
    } catch (error) {
      console.error('Fehler beim Importieren der Bibliothek:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Importieren",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
              onClick={() => setIsCreateDialogOpen(true)} 
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
              
              {/* Shadow-Twin-Modus Konvertierung */}
              {!isNew && activeLibrary && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Shadow-Twin-Modus</h4>
                        <p className="text-sm text-muted-foreground">
                          Aktueller Modus: <span className="font-mono">{shadowTwinMode}</span>
                        </p>
                      </div>
                    </div>
                    {shadowTwinMode === 'legacy' && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">
                          Dieser Modus ist in der Anwendung nicht mehr unterstützt (v2-only Runtime).
                          Bitte stelle die Library auf <span className="font-mono">v2</span> um, damit normale Verarbeitung/Erstellung wieder möglich ist.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (!activeLibrary?.id) return;
                            
                            setIsUpgradingShadowTwinMode(true);
                            try {
                              const response = await fetch(`/api/library/${activeLibrary.id}/shadow-twin-mode`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                // WICHTIG: Keine Migration/Conversion hier. Wir setzen nur das Config-Flag.
                                body: JSON.stringify({ mode: 'v2' }),
                              });
                              
                              if (!response.ok) {
                                throw new Error('Fehler beim Konvertieren');
                              }
                              
                              await response.json();
                              setShadowTwinMode('v2');
                              
                              toast({
                                title: 'Shadow-Twin-Modus aktualisiert',
                                description: 'Die Bibliothek ist jetzt auf v2 gestellt (ohne Migration bestehender Artefakte).',
                              });
                            } catch (error) {
                              toast({
                                title: 'Fehler',
                                description: error instanceof Error ? error.message : 'Fehler beim Konvertieren',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsUpgradingShadowTwinMode(false);
                            }
                          }}
                          disabled={isUpgradingShadowTwinMode}
                        >
                          {isUpgradingShadowTwinMode ? 'Stelle um...' : 'Auf v2 umstellen'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Setzt nur das Konfigurations-Flag. Eine Migration/Repair bestehender Artefakte erfolgt bewusst später.
                        </p>
                      </div>
                    )}
                    {shadowTwinMode === 'v2' && (
                      <p className="text-xs text-muted-foreground">
                        Diese Bibliothek verwendet bereits den v2-Modus.
                      </p>
                    )}
                  </div>
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium">Shadow‑Twin Speicher (Mongo/Filesystem)</h4>
                      <p className="text-xs text-muted-foreground">
                        Diese Flags steuern den primären Store und optionale Filesystem‑Writes.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <FormLabel>Primary Store</FormLabel>
                      <Select
                        value={shadowTwinPrimaryStore}
                        onValueChange={(value) => setShadowTwinPrimaryStore(value as 'filesystem' | 'mongo')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Store auswählen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="filesystem">Filesystem (Legacy)</SelectItem>
                          <SelectItem value="mongo">MongoDB (primär)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Legt fest, ob Shadow‑Twins primär aus dem Filesystem oder aus MongoDB gelesen werden.
                      </FormDescription>
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                      <div>
                        <FormLabel className="text-sm">Persist to Filesystem</FormLabel>
                        <FormDescription>Shadow‑Twins zusätzlich ins Filesystem schreiben.</FormDescription>
                      </div>
                      <Switch
                        checked={shadowTwinPersistToFilesystem}
                        onCheckedChange={setShadowTwinPersistToFilesystem}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                      <div>
                        <FormLabel className="text-sm">Filesystem Fallback</FormLabel>
                        <FormDescription>
                          Ausnahme: Aus Filesystem lesen, wenn Mongo‑Eintrag fehlt. Standardmäßig deaktiviert – nur bei Bedarf aktivieren.
                        </FormDescription>
                      </div>
                      <Switch
                        checked={shadowTwinAllowFilesystemFallback}
                        onCheckedChange={setShadowTwinAllowFilesystemFallback}
                      />
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-medium">Migration (Upsert)</h4>
                        <p className="text-xs text-muted-foreground">
                          Upsert nach MongoDB und Report anzeigen. Cleanup kann unten aktiviert werden.
                        </p>
                      </div>
                      <Dialog open={isDryRunOpen} onOpenChange={setIsDryRunOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" disabled={!activeLibraryId}>
                            Migration starten
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-auto !grid-cols-1">
                          <DialogHeader>
                            <DialogTitle>Shadow‑Twin Migration (Upsert)</DialogTitle>
                            <DialogDescription className="space-y-2">
                              <div>
                                <strong>Absicht:</strong> Dieser Dialog ermöglicht die Migration von Shadow-Twins (abgeleitete Markdown-Dateien und zugehörige Assets) vom Dateisystem nach MongoDB als primärem Speicher. 
                                Sie können Migrationsläufe starten und detaillierte Berichte über jeden verarbeiteten Datei einsehen.
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                <div>
                                  <strong>Aktuelles Ziel:</strong> Shadow-Twins werden primär in <span className="font-mono">{shadowTwinPrimaryStore === 'mongo' ? 'MongoDB' : 'Filesystem'}</span> gespeichert.
                                </div>
                                {shadowTwinPrimaryStore === 'mongo' ? (
                                  <div className="text-green-600 dark:text-green-400">
                                    ✓ Ziel erreicht: MongoDB ist als primärer Store aktiviert.
                                  </div>
                                ) : (
                                  <div className="text-amber-600 dark:text-amber-400">
                                    ⚠ Bitte setze &quot;Primary Store&quot; auf &quot;MongoDB&quot; in den Library-Einstellungen, bevor du die Migration startest.
                                  </div>
                                )}
                                <div>
                                  Dieser Lauf verwendet die Library‑Root.
                                </div>
                              </div>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 min-w-0">
                            <div className="flex items-center justify-between rounded border p-3">
                              <div>
                                <FormLabel className="text-sm">Recursive</FormLabel>
                                <FormDescription>Unterordner einschließen.</FormDescription>
                              </div>
                              <Switch checked={dryRunRecursive} onCheckedChange={setDryRunRecursive} />
                            </div>
                            <div className="flex items-center justify-between rounded border p-3">
                              <div>
                                <FormLabel className="text-sm">Filesystem Cleanup</FormLabel>
                                <FormDescription>Filesystem‑Shadow‑Twins nach erfolgreichem Upsert löschen.</FormDescription>
                              </div>
                              <Switch checked={dryRunCleanupFilesystem} onCheckedChange={setDryRunCleanupFilesystem} />
                            </div>
                            {dryRunError ? (
                              <p className="text-xs text-destructive">{dryRunError}</p>
                            ) : null}
                            <div className="border-t pt-3">
                              <div className="text-sm font-medium">Upsert‑Lauf auswählen</div>
                              {migrationRunsArray.length === 0 ? (
                                <div className="mt-2 text-xs text-muted-foreground">Keine Upserts vorhanden.</div>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  <Select
                                    value={selectedRunId || undefined}
                                    onValueChange={(value) => setSelectedRunId(value)}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Upsert‑Lauf auswählen" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {migrationRunsArray.map((run) => {
                                        const params = run.params || {}
                                        const paramParts: string[] = []
                                        // Zeige recursive nur wenn explizit gesetzt (nicht default)
                                        if (typeof params.recursive === 'boolean') {
                                          paramParts.push(`recursive: ${params.recursive}`)
                                        }
                                        // Zeige cleanup nur wenn explizit gesetzt (nicht default)
                                        if (typeof params.cleanupFilesystem === 'boolean') {
                                          paramParts.push(`cleanup: ${params.cleanupFilesystem}`)
                                        }
                                        // Zeige folderId wenn nicht 'root'
                                        if (params.folderId && params.folderId !== 'root') {
                                          paramParts.push(`folder: ${params.folderId.slice(0, 20)}...`)
                                        }
                                        const paramsStr = paramParts.length > 0 ? ` (${paramParts.join(', ')})` : ''
                                        return (
                                          <SelectItem key={run.runId} value={run.runId}>
                                            {new Date(run.startedAt).toLocaleString()} · {run.runId.slice(0, 8)} · {run.status}{paramsStr}
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {selectedRun ? (
                                <div className="mt-3">
                                  <div className="mb-2">
                                    <div className="text-xs font-medium">Bearbeitete Dateien</div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                      Diese Tabelle zeigt alle Dateien, die im ausgewählten Migrationslauf verarbeitet wurden. 
                                      Gruppiert nach Quellen. Jede Zeile entspricht einer einzelnen Datei (Markdown-Artefakte oder Binary-Fragmente wie Bilder, Audio, Video).
                                    </div>
                                  </div>
                                  {(() => {
                                    // Clientseitige Gruppierung nach sourceId
                                    const artifacts = selectedRun.report?.upsertedArtifacts || []
                                    
                                    if (artifacts.length === 0 && binaryFragments.length === 0) {
                                      if (loadingFragments) {
                                        return <div className="mt-2 text-xs text-muted-foreground">Lade Dateien...</div>
                                      }
                                      return <div className="mt-2 text-xs text-muted-foreground">Keine Dateien gelistet.</div>
                                    }

                                    // Hilfsfunktion: Versucht sourceId als Base64 zu dekodieren, um den Pfad zu erhalten
                                    const tryDecodePath = (sourceId: string): string => {
                                      if (!sourceId || sourceId === 'root' || sourceId === 'undefined' || sourceId === 'null') {
                                        return ''
                                      }
                                      // Prüfe, ob es wie Base64 aussieht
                                      if (!/^[A-Za-z0-9+/=]+$/.test(sourceId) || sourceId.length % 4 !== 0) {
                                        return ''
                                      }
                                      try {
                                        // Browser-seitige Base64-Dekodierung
                                        const decoded = atob(sourceId)
                                        if (decoded && decoded.includes('/') && !decoded.includes('..')) {
                                          return decoded.replace(/\\/g, '/')
                                        }
                                      } catch {
                                        // Ignoriere Dekodierungsfehler
                                      }
                                      return ''
                                    }

                                    // Kombiniere Artefakte und binaryFragments zu einer flachen Liste von Dateien
                                    type FileEntry = {
                                      sourceId: string
                                      sourceName: string
                                      fileName: string
                                      kind: string
                                      mimeType?: string
                                      size?: number
                                      url?: string
                                      hash?: string
                                      mongoUpserted: boolean
                                      filesystemDeleted: boolean
                                      // Artefakt-spezifische Felder (nur für Markdown-Artefakte)
                                      artifactKind?: 'transcript' | 'transformation'
                                      targetLanguage?: string
                                      templateName?: string
                                    }

                                    const allFiles: FileEntry[] = []

                                    // Füge Artefakte hinzu (Markdown-Dateien)
                                    for (const artifact of artifacts) {
                                      allFiles.push({
                                        sourceId: artifact.sourceId,
                                        sourceName: artifact.sourceName || 'Unbekannt',
                                        fileName: artifact.artifactFileName,
                                        kind: 'markdown',
                                        mimeType: 'text/markdown',
                                        mongoUpserted: artifact.mongoUpserted,
                                        filesystemDeleted: artifact.filesystemDeleted,
                                        artifactKind: artifact.kind,
                                        targetLanguage: artifact.targetLanguage,
                                        templateName: artifact.templateName,
                                      })
                                    }

                                    // Füge binaryFragments hinzu (nur wenn nicht bereits als Artefakt vorhanden)
                                    // Erstelle Set von Artefakt-Dateinamen für schnellen Lookup
                                    const artifactFileNames = new Set(
                                      artifacts.map((a) => a.artifactFileName.toLowerCase())
                                    )

                                    for (const fragment of binaryFragments) {
                                      // Überspringe Markdown-Dateien, die bereits als Artefakte vorhanden sind
                                      if (
                                        fragment.kind === 'markdown' &&
                                        artifactFileNames.has(fragment.name.toLowerCase())
                                      ) {
                                        continue
                                      }

                                      allFiles.push({
                                        sourceId: fragment.sourceId,
                                        sourceName: fragment.sourceName,
                                        fileName: fragment.name,
                                        kind: fragment.kind,
                                        mimeType: fragment.mimeType,
                                        size: fragment.size,
                                        url: fragment.url,
                                        hash: fragment.hash,
                                        mongoUpserted: !!fragment.url, // Wenn URL vorhanden, wurde es erfolgreich hochgeladen
                                        filesystemDeleted: selectedRun.params?.cleanupFilesystem || false,
                                      })
                                    }

                                    // Gruppiere Dateien nach sourceId
                                    const grouped = allFiles.reduce((acc, file) => {
                                      const sourceId = file.sourceId || 'unknown'
                                      if (!acc[sourceId]) {
                                        const decodedPath = tryDecodePath(sourceId)
                                        acc[sourceId] = {
                                          sourceId,
                                          sourceName: file.sourceName || 'Unbekannt',
                                          path: decodedPath,
                                          files: []
                                        }
                                      }
                                      acc[sourceId].files.push(file)
                                      return acc
                                    }, {} as Record<string, { sourceId: string; sourceName: string; path: string; files: FileEntry[] }>)

                                    const groups = Object.values(grouped).sort((a, b) => {
                                      // Sortiere nach Pfad, dann nach sourceName
                                      if (a.path && b.path) {
                                        return a.path.localeCompare(b.path)
                                      }
                                      if (a.path) return -1
                                      if (b.path) return 1
                                      return a.sourceName.localeCompare(b.sourceName)
                                    })

                                    return (
                                      <div className="mt-2 max-h-[45vh] overflow-y-auto rounded border w-full">
                                        <Accordion type="multiple" className="w-full">
                                          {groups.map((group) => {
                                            const displayPath = group.path || 'Unbekanntes Verzeichnis'
                                            const displayName = group.sourceName
                                            const fileCount = group.files.length
                                            
                                            return (
                                              <AccordionItem key={group.sourceId} value={group.sourceId} className="border-b">
                                                <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                                                  <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                                                      <span className="font-medium text-left truncate max-w-full" title={displayPath}>
                                                        {displayPath}
                                                      </span>
                                                      <span className="text-muted-foreground text-[11px] truncate max-w-full" title={displayName}>
                                                        {displayName}
                                                      </span>
                                                    </div>
                                                    <span className="text-muted-foreground text-[11px] ml-2 shrink-0">
                                                      {fileCount} {fileCount === 1 ? 'Datei' : 'Dateien'}
                                                    </span>
                                                  </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-0 pb-0">
                                                  <div className="overflow-x-auto">
                                                    <div style={{ minWidth: '1000px' }}>
                                                      <table className="w-full text-xs" style={{ minWidth: '1000px' }}>
                                                        <thead className="sticky top-0 bg-muted/60">
                                                          <tr className="text-left">
                                                            <TooltipProvider>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Dateiname
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Name der verarbeiteten Datei (Markdown-Artefakt oder Binary-Fragment).</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Typ
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Art der Datei: &quot;markdown&quot; (Artefakt), &quot;image&quot;, &quot;audio&quot;, &quot;video&quot; oder &quot;binary&quot;.</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Größe
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Dateigröße in Bytes.</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Azure URL
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Azure Blob Storage URL (für Binary-Fragmente).</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Hash
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">SHA-256 Hash (erste 16 Zeichen) für Deduplizierung.</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    Mongo
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Status der MongoDB-Speicherung: &quot;upserted&quot; = erfolgreich gespeichert/aktualisiert, &quot;nein&quot; = nicht gespeichert.</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                              <th className="px-2 py-1 font-medium">
                                                                <Tooltip>
                                                                  <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                                    FS gelöscht
                                                                  </TooltipTrigger>
                                                                  <TooltipContent>
                                                                    <p className="max-w-xs">Ob die Dateisystemkopie nach erfolgreicher MongoDB-Migration gelöscht wurde: &quot;ja&quot; = gelöscht, &quot;nein&quot; = noch vorhanden oder Cleanup deaktiviert.</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              </th>
                                                            </TooltipProvider>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {group.files.map((file, idx) => (
                                                            <tr key={`${file.sourceId}-${file.fileName}-${idx}`} className="border-t align-top">
                                                              <td className="px-2 py-1 font-medium max-w-[300px] break-words">{file.fileName}</td>
                                                              <td className="px-2 py-1">
                                                                {file.artifactKind ? `${file.kind} (${file.artifactKind})` : file.kind}
                                                              </td>
                                                              <td className="px-2 py-1">
                                                                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '-'}
                                                              </td>
                                                              <td className="px-2 py-1 max-w-[400px] break-all text-[10px]">
                                                                {file.url ? (
                                                                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                                    {file.url.length > 50 ? `${file.url.substring(0, 50)}...` : file.url}
                                                                  </a>
                                                                ) : '-'}
                                                              </td>
                                                              <td className="px-2 py-1 font-mono text-[10px]">{file.hash || '-'}</td>
                                                              <td className="px-2 py-1">{file.mongoUpserted ? 'upserted' : 'nein'}</td>
                                                              <td className="px-2 py-1">{file.filesystemDeleted ? 'ja' : 'nein'}</td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  </div>
                                                </AccordionContent>
                                              </AccordionItem>
                                            )
                                          })}
                                        </Accordion>
                                      </div>
                                    )
                                  })()}
                                  {selectedRun.report?.upsertedArtifactsTruncated ? (
                                    <div className="mt-2 text-[11px] text-muted-foreground">
                                      Liste gekürzt (max. 500 Einträge).
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDryRunOpen(false)}>
                              Schließen
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                const cleanupText = dryRunCleanupFilesystem 
                                  ? '(mit Cleanup - Filesystem-Dateien werden gelöscht)' 
                                  : '(ohne Cleanup)'
                                const confirmed = window.confirm(
                                  `Upsert startet die Migration nach MongoDB ${cleanupText}. Fortfahren?`
                                )
                                if (confirmed) void runShadowTwinMigration()
                              }}
                              disabled={dryRunRunning}
                            >
                              {dryRunRunning ? 'Läuft…' : 'Upsert ausführen'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              )}
              
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
          
          {/* Export/Import Bereich */}
          {!isNew && activeLibrary && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Bibliothek exportieren / importieren</h3>
                  <p className="text-sm text-muted-foreground">
                    Exportieren Sie die Bibliothekskonfiguration als JSON-Datei oder importieren Sie eine zuvor exportierte Bibliothek.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportLibrary}
                    disabled={isLoading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Bibliothek exportieren
                  </Button>
                  
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Bibliothek importieren
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Bibliothek importieren</DialogTitle>
                        <DialogDescription>
                          Wählen Sie eine JSON-Datei aus, die zuvor exportiert wurde. Die Bibliothek wird mit einer neuen ID erstellt.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleImportLibrary(file);
                            }
                          }}
                          className="w-full"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                          Abbrechen
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Import-Option beim Erstellen neuer Bibliothek */}
          {isNew && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Bibliothek importieren</h3>
                  <p className="text-sm text-muted-foreground">
                    Importieren Sie eine zuvor exportierte Bibliothekskonfiguration als Ausgangspunkt für eine neue Bibliothek.
                  </p>
                </div>
                
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Bibliothek aus JSON importieren
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bibliothek importieren</DialogTitle>
                      <DialogDescription>
                        Wählen Sie eine JSON-Datei aus, die zuvor exportiert wurde. Die Bibliothek wird mit einer neuen ID erstellt.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleImportLibrary(file);
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                        Abbrechen
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
          
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
                    const configShadowTwin = activeLibrary?.config?.shadowTwin as {
                      primaryStore?: 'filesystem' | 'mongo';
                      persistToFilesystem?: boolean;
                      allowFilesystemFallback?: boolean;
                    } | undefined;
                    const primaryStore = configShadowTwin?.primaryStore || 'filesystem';
                    const nextSnapshot = {
                      primaryStore,
                      persistToFilesystem:
                        typeof configShadowTwin?.persistToFilesystem === 'boolean'
                          ? configShadowTwin.persistToFilesystem
                          : primaryStore === 'filesystem',
                      allowFilesystemFallback: configShadowTwin?.allowFilesystemFallback ?? true,
                    };
                    shadowTwinConfigRef.current = nextSnapshot;
                    setShadowTwinPrimaryStore(nextSnapshot.primaryStore);
                    setShadowTwinPersistToFilesystem(nextSnapshot.persistToFilesystem);
                    setShadowTwinAllowFilesystemFallback(nextSnapshot.allowFilesystemFallback);
                  }
                }}
                disabled={isLoading}
              >
                Zurücksetzen
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || (!isNew && !form.formState.isDirty && !isShadowTwinConfigDirty)}
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

      {/* Dialog zum Erstellen einer neuen Bibliothek */}
      <CreateLibraryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={() => {
          // Nach Erstellung bleibt man auf der Settings-Seite
          // Die neue Library ist bereits aktiv (durch den Dialog)
          setIsNew(false);
        }}
      />
    </div>
  )
}
