/**
 * @fileoverview Haupt-Hook für das Library-Settings-Formular.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält:
 * - Form-Schema und defaultValues
 * - Bibliothek-CRUD-Callbacks (create, update, delete, export, import)
 * - Azure-Strategie-Abruf
 * - Shadow-Twin-Config-State-Initialisierung aus activeLibrary
 */

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom";
import { StorageProviderType } from "@/types/library";
import { useSafeUser } from "@/hooks/use-safe-user";

// Formular-Schema (identisch mit dem in library-form.tsx)
export const libraryFormSchema = z.object({
  label: z
    .string({ required_error: "Bitte geben Sie einen Namen ein." })
    .min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  path: z.string({ required_error: "Bitte geben Sie einen Speicherpfad ein." }),
  type: z.enum(["local", "onedrive", "gdrive", "nextcloud"], {
    required_error: "Bitte wählen Sie einen Speichertyp.",
  }),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  transcription: z.enum(["shadowTwin", "db"], {
    required_error: "Bitte wählen Sie eine Transkriptionsstrategie.",
  }),
  templateDirectory: z.string().default("/templates"),
  // Transformation: DIVA-Liefersystem-Daten auswerten (DIVA-Info-Tab). Default false.
  analyzeDivaTextureInfo: z.boolean().default(false),
  storageConfig: z.object({
    basePath: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().optional(),
  }),
});

export type LibraryFormValues = z.infer<typeof libraryFormSchema>;

/** Konfigurationstyp für Shadow-Twin-Einstellungen */
interface ShadowTwinConfig {
  primaryStore: "filesystem" | "mongo";
  persistToFilesystem: boolean;
  allowFilesystemFallback: boolean;
}

/**
 * Haupt-Hook für das Library-Settings-Formular.
 * Gibt Form-Objekt, Zustand und alle Handler zurück.
 */
export function useLibraryForm(createNew: boolean) {
  const { user } = useSafeUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom);

  // Shadow-Twin-Konfiguration States
  const [shadowTwinMode, setShadowTwinMode] = useState<"legacy" | "v2">("legacy");
  const [isUpgradingShadowTwinMode, setIsUpgradingShadowTwinMode] = useState(false);
  const [shadowTwinPrimaryStore, setShadowTwinPrimaryStore] = useState<"filesystem" | "mongo">(
    "filesystem"
  );
  const [shadowTwinPersistToFilesystem, setShadowTwinPersistToFilesystem] = useState(true);
  const [shadowTwinAllowFilesystemFallback, setShadowTwinAllowFilesystemFallback] =
    useState(true);
  const [azureConfigured, setAzureConfigured] = useState<boolean | null>(null);
  const shadowTwinConfigRef = useRef<ShadowTwinConfig>({
    primaryStore: "filesystem",
    persistToFilesystem: true,
    allowFilesystemFallback: true,
  });

  // Migration-Dialog State
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [dryRunRecursive, setDryRunRecursive] = useState(true);
  const [dryRunCleanupFilesystem, setDryRunCleanupFilesystem] = useState(false);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  // Sync State
  const [isSyncRunning, setIsSyncRunning] = useState(false);

  // Sprach-Bereinigung State
  const [isLangCleanupOpen, setIsLangCleanupOpen] = useState(false);
  const [langCleanupLang, setLangCleanupLang] = useState("");
  const [isLangAnalyzing, setIsLangAnalyzing] = useState(false);
  const [isLangDeleting, setIsLangDeleting] = useState(false);
  const [langCleanupResult, setLangCleanupResult] = useState<{
    dryRun: boolean;
    targetLanguage: string;
    totalArtifacts: number;
    totalFiles: number;
    storageDeleted: number | null;
    affectedFiles: Array<{
      sourceName: string;
      artifacts: Array<{ kind: string; templateName: string | null }>;
    }>;
  } | null>(null);

  // Analyse State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<{
    scanned: number;
    withShadowTwin: number;
    markdownToCache: number;
    markdownToStorage: number;
    imagesWritten: number;
    imagesSkipped: number;
    alreadySynced: number;
    sourceNewer: number;
    errors: number;
  } | null>(null);

  // Migration-Runs State
  const [migrationRuns, setMigrationRuns] = useState<
    Array<{
      runId: string;
      status: "running" | "completed" | "failed";
      params: {
        folderId?: string;
        recursive?: boolean;
        dryRun?: boolean;
        cleanupFilesystem?: boolean;
        limit?: number;
      };
      startedAt: string;
      finishedAt?: string;
      steps?: Array<{ name: string; at: string; meta?: Record<string, unknown> }>;
      report?: {
        upsertedArtifacts?: Array<{
          sourceId: string;
          sourceName: string;
          artifactFileName: string;
          kind: "transcript" | "transformation";
          targetLanguage: string;
          templateName?: string;
          mongoUpserted: boolean;
          blobImages?: number;
          blobErrors?: number;
          binaryFragmentsCount?: number;
          markdownFiles?: number;
          imageFiles?: number;
          audioFiles?: number;
          videoFiles?: number;
          otherFiles?: number;
          filesystemDeleted: boolean;
        }>;
        upsertedArtifactsTruncated?: boolean;
      };
    }>
  >([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [binaryFragments, setBinaryFragments] = useState<
    Array<{
      sourceId: string;
      sourceName: string;
      name: string;
      kind: string;
      url?: string;
      hash?: string;
      mimeType?: string;
      size?: number;
      createdAt: string;
    }>
  >([]);
  const [loadingFragments, setLoadingFragments] = useState(false);

  // Aktuelle Library
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId);

  const defaultValues = useMemo<LibraryFormValues>(
    () => ({
      label: "",
      path: "",
      type: "local",
      description: "",
      isEnabled: true,
      transcription: "shadowTwin",
      templateDirectory: "/templates",
      analyzeDivaTextureInfo: false,
      storageConfig: {
        basePath: "",
        clientId: "",
        clientSecret: "",
        redirectUri: "",
      },
    }),
    []
  );

  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  });

  // Shadow-Twin-Config aus Library ableiten
  useEffect(() => {
    const modeFromLibrary = activeLibrary?.config?.shadowTwin
      ? (activeLibrary.config.shadowTwin as { mode?: unknown }).mode
      : undefined;
    setShadowTwinMode(modeFromLibrary === "v2" ? "v2" : "legacy");

    const configShadowTwin = activeLibrary?.config?.shadowTwin as
      | {
          primaryStore?: "filesystem" | "mongo";
          persistToFilesystem?: boolean;
          allowFilesystemFallback?: boolean;
        }
      | undefined;

    const primaryStore = configShadowTwin?.primaryStore ?? "filesystem";
    const nextSnapshot = {
      primaryStore,
      persistToFilesystem:
        typeof configShadowTwin?.persistToFilesystem === "boolean"
          ? configShadowTwin.persistToFilesystem
          : primaryStore === "filesystem",
      allowFilesystemFallback: configShadowTwin?.allowFilesystemFallback ?? true,
    };
    shadowTwinConfigRef.current = nextSnapshot;
    setShadowTwinPrimaryStore(primaryStore);
    setShadowTwinPersistToFilesystem(nextSnapshot.persistToFilesystem);
    setShadowTwinAllowFilesystemFallback(nextSnapshot.allowFilesystemFallback);
  }, [activeLibrary?.id, activeLibrary?.config]);

  // Azure-Verfügbarkeit abrufen
  useEffect(() => {
    const id = activeLibrary?.id;
    if (!id) {
      setAzureConfigured(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/library/${id}/media-storage-strategy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (
          !cancelled &&
          data &&
          typeof data === "object" &&
          "azureConfigured" in data &&
          typeof (data as Record<string, unknown>).azureConfigured === "boolean"
        ) {
          setAzureConfigured(
            (data as Record<string, unknown>).azureConfigured as boolean
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAzureConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLibrary?.id]);

  /** Erstellt eine neue Bibliothek (leeres Formular) */
  const handleCreateNew = useCallback(() => {
    setIsNew(true);
    setActiveLibraryId("");
    form.reset(defaultValues);
    setShadowTwinPrimaryStore("filesystem");
    setShadowTwinPersistToFilesystem(true);
    setShadowTwinAllowFilesystemFallback(true);
  }, [form, defaultValues, setActiveLibraryId]);

  /** Bricht das Erstellen ab und kehrt zur aktiven Library zurück */
  const handleCancelNew = useCallback(() => {
    setIsNew(false);
    if (activeLibrary) {
      const rawClientSecret = (activeLibrary.config?.clientSecret as string) ?? "";
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: (activeLibrary.config?.clientId as string) ?? "",
        clientSecret: rawClientSecret === "********" ? "" : rawClientSecret,
        redirectUri: (activeLibrary.config?.redirectUri as string) ?? "",
      };
      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: (activeLibrary.config?.description as string) ?? "",
        isEnabled: activeLibrary.isEnabled,
        transcription:
          (activeLibrary.config?.transcription as "shadowTwin" | "db") ?? "shadowTwin",
        templateDirectory:
          (activeLibrary.config?.templateDirectory as string) ?? "/templates",
        analyzeDivaTextureInfo: activeLibrary.config?.analyzeDivaTextureInfo === true,
        storageConfig,
      });
    } else if (libraries.length > 0) {
      setActiveLibraryId(libraries[0].id);
    }
  }, [activeLibrary, libraries, form, setActiveLibraryId]);

  // Form mit aktiver Library befüllen
  useEffect(() => {
    if (activeLibrary && !isNew) {
      const storageConfig = {
        basePath: activeLibrary.path,
        clientId: (activeLibrary.config?.clientId as string) ?? "",
        clientSecret: (activeLibrary.config?.clientSecret as string) ?? "",
        redirectUri: (activeLibrary.config?.redirectUri as string) ?? "",
      };
      form.reset({
        label: activeLibrary.label,
        path: activeLibrary.path,
        type: activeLibrary.type,
        description: (activeLibrary.config?.description as string) ?? "",
        isEnabled: activeLibrary.isEnabled,
        transcription:
          (activeLibrary.config?.transcription as "shadowTwin" | "db") ?? "shadowTwin",
        templateDirectory:
          (activeLibrary.config?.templateDirectory as string) ?? "/templates",
        analyzeDivaTextureInfo: activeLibrary.config?.analyzeDivaTextureInfo === true,
        storageConfig,
      });
    }
  }, [activeLibrary, isNew, form]);

  // createNew-Prop: neue Library-Erstellung starten
  useEffect(() => {
    if (createNew) {
      handleCreateNew();
    }
  }, [createNew, handleCreateNew]);

  /** Shadow-Twin-Config-Dirty-Check */
  const isShadowTwinConfigDirty = useMemo(() => {
    const current = shadowTwinConfigRef.current;
    return (
      shadowTwinPrimaryStore !== current.primaryStore ||
      shadowTwinPersistToFilesystem !== current.persistToFilesystem ||
      shadowTwinAllowFilesystemFallback !== current.allowFilesystemFallback
    );
  }, [shadowTwinPrimaryStore, shadowTwinPersistToFilesystem, shadowTwinAllowFilesystemFallback]);

  /** Submit: Bibliothek speichern (neu erstellen oder aktualisieren) */
  const onSubmit = useCallback(
    async (data: LibraryFormValues) => {
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
        let storageConfig = {};
        const existingConfig = activeLibrary?.config ?? {};

        switch (data.type) {
          case "local":
            storageConfig = { basePath: data.storageConfig.basePath };
            break;
          case "onedrive":
          case "gdrive": {
            const clientSecret = data.storageConfig.clientSecret;
            const shouldSendSecret =
              clientSecret && clientSecret !== "********" && clientSecret.trim() !== "";
            storageConfig = {
              clientId: data.storageConfig.clientId,
              ...(shouldSendSecret ? { clientSecret: clientSecret.trim() } : {}),
              redirectUri: data.storageConfig.redirectUri,
            };
            break;
          }
          case "nextcloud":
            if (existingConfig.nextcloud) {
              storageConfig = { nextcloud: existingConfig.nextcloud };
            }
            break;
        }

        const newLibraryId = isNew ? uuidv4() : activeLibraryId;

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
            analyzeDivaTextureInfo: data.analyzeDivaTextureInfo,
            shadowTwin: {
              mode: shadowTwinMode,
              primaryStore: shadowTwinPrimaryStore,
              persistToFilesystem: shadowTwinPersistToFilesystem,
              allowFilesystemFallback: shadowTwinAllowFilesystemFallback,
            },
            ...storageConfig,
          },
        };

        const response = await fetch("/api/libraries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(libraryData),
        });

        if (!response.ok) {
          throw new Error(`Fehler beim Speichern: ${response.statusText}`);
        }

        if (isNew) {
          const newLibrary = {
            ...libraryData,
            // icon wird vom Client-Side als React-Element erwartet — wird von der Atom-Initalisierung gesetzt
            config: { ...libraryData.config },
          };
          setLibraries([...libraries, newLibrary as Parameters<typeof setLibraries>[0][0]]);
          setActiveLibraryId(newLibraryId);
          setIsNew(false);
          toast({
            title: "Bibliothek erstellt",
            description: `Die Bibliothek "${data.label}" wurde erfolgreich erstellt.`,
          });
          router.push("/settings/storage");
        } else {
          const updatedLibraries = libraries.map((lib) =>
            lib.id === libraryData.id
              ? { ...lib, ...libraryData, icon: lib.icon, config: { ...lib.config, ...libraryData.config } }
              : lib
          );
          setLibraries(updatedLibraries);
          toast({
            title: "Bibliothek aktualisiert",
            description: `Die Bibliothek "${data.label}" wurde erfolgreich aktualisiert.`,
          });
        }
      } catch (error) {
        console.error("[LibraryForm] Fehler beim Speichern der Bibliothek:", error);
        toast({
          title: "Fehler",
          description:
            error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      activeLibrary,
      activeLibraryId,
      isNew,
      libraries,
      setLibraries,
      setActiveLibraryId,
      router,
      shadowTwinMode,
      shadowTwinPrimaryStore,
      shadowTwinPersistToFilesystem,
      shadowTwinAllowFilesystemFallback,
    ]
  );

  /** Bibliothek exportieren */
  const handleExportLibrary = useCallback(async () => {
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
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `library-${activeLibrary?.label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Bibliothek exportiert",
        description: `Die Bibliothek "${activeLibrary?.label}" wurde erfolgreich exportiert.`,
      });
    } catch (error) {
      console.error("[LibraryForm] Fehler beim Exportieren der Bibliothek:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler beim Exportieren",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeLibraryId, user, activeLibrary]);

  /** Bibliothek importieren */
  const handleImportLibrary = useCallback(
    async (file: File) => {
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
        const text = await file.text();
        const libraryData = JSON.parse(text) as Record<string, unknown>;

        const response = await fetch("/api/libraries/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ libraryData }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(
            errorData.error ?? `Fehler beim Importieren: ${response.statusText}`
          );
        }

        const result = (await response.json()) as { library: Record<string, unknown> };
        const importedLibrary = result.library;

        const newLibrary = {
          ...(importedLibrary as object),
          // icon-Platzhalter: wird von der Client-Atom-Logik gesetzt
        };
        setLibraries([...libraries, newLibrary as Parameters<typeof setLibraries>[0][0]]);
        setActiveLibraryId(importedLibrary.id as string);
        setIsNew(false);
        setIsImportDialogOpen(false);

        const storageConfig = {
          basePath: (importedLibrary.path as string) ?? "",
          clientId: ((importedLibrary as { config?: Record<string, unknown> }).config?.clientId as string) ?? "",
          clientSecret: ((importedLibrary as { config?: Record<string, unknown> }).config?.clientSecret as string) ?? "",
          redirectUri: ((importedLibrary as { config?: Record<string, unknown> }).config?.redirectUri as string) ?? "",
        };

        form.reset({
          label: importedLibrary.label as string,
          path: importedLibrary.path as string,
          type: importedLibrary.type as "local" | "onedrive" | "gdrive" | "nextcloud",
          description: ((importedLibrary as { config?: Record<string, unknown> }).config?.description as string) ?? "",
          isEnabled: importedLibrary.isEnabled as boolean,
          transcription: (importedLibrary.transcription as "shadowTwin" | "db") ?? "shadowTwin",
          templateDirectory: ((importedLibrary as { config?: Record<string, unknown> }).config?.templateDirectory as string) ?? "/templates",
          analyzeDivaTextureInfo: ((importedLibrary as { config?: Record<string, unknown> }).config?.analyzeDivaTextureInfo as boolean) === true,
          storageConfig,
        });

        toast({
          title: "Bibliothek importiert",
          description: `Die Bibliothek "${importedLibrary.label as string}" wurde erfolgreich importiert.`,
        });
      } catch (error) {
        console.error("[LibraryForm] Fehler beim Importieren der Bibliothek:", error);
        toast({
          title: "Fehler",
          description:
            error instanceof Error ? error.message : "Unbekannter Fehler beim Importieren",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [user, libraries, setLibraries, setActiveLibraryId, form]
  );

  /** Bibliothek löschen */
  const handleDeleteLibrary = useCallback(async () => {
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
      const response = await fetch(`/api/libraries?libraryId=${activeLibraryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Fehler beim Löschen: ${response.statusText}`);
      }

      const updatedLibraries = libraries.filter((lib) => lib.id !== activeLibraryId);
      setLibraries(updatedLibraries);

      if (updatedLibraries.length > 0) {
        setActiveLibraryId(updatedLibraries[0].id);
      } else {
        setActiveLibraryId("");
        setIsNew(true);
        form.reset(defaultValues);
      }

      toast({
        title: "Bibliothek gelöscht",
        description: "Die Bibliothek wurde erfolgreich gelöscht.",
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("[LibraryForm] Fehler beim Löschen der Bibliothek:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeLibraryId, user, libraries, setLibraries, setActiveLibraryId, form, defaultValues]);

  // Aggregierter Return-Wert
  return {
    // Form
    form,
    defaultValues,
    onSubmit,
    // State
    user,
    isLoading,
    isNew,
    setIsNew,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isImportDialogOpen,
    setIsImportDialogOpen,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    libraries,
    activeLibraryId,
    setActiveLibraryId,
    activeLibrary,
    // Shadow-Twin Config
    shadowTwinMode,
    setShadowTwinMode,
    isUpgradingShadowTwinMode,
    setIsUpgradingShadowTwinMode,
    shadowTwinPrimaryStore,
    setShadowTwinPrimaryStore,
    shadowTwinPersistToFilesystem,
    setShadowTwinPersistToFilesystem,
    shadowTwinAllowFilesystemFallback,
    setShadowTwinAllowFilesystemFallback,
    azureConfigured,
    isShadowTwinConfigDirty,
    shadowTwinConfigRef,
    // Migration Dialog
    isDryRunOpen,
    setIsDryRunOpen,
    dryRunRecursive,
    setDryRunRecursive,
    dryRunCleanupFilesystem,
    setDryRunCleanupFilesystem,
    dryRunRunning,
    setDryRunRunning,
    dryRunError,
    setDryRunError,
    // Sync
    isSyncRunning,
    setIsSyncRunning,
    // Sprach-Bereinigung
    isLangCleanupOpen,
    setIsLangCleanupOpen,
    langCleanupLang,
    setLangCleanupLang,
    isLangAnalyzing,
    setIsLangAnalyzing,
    isLangDeleting,
    setIsLangDeleting,
    langCleanupResult,
    setLangCleanupResult,
    // Analyse
    isAnalyzing,
    setIsAnalyzing,
    analysisReport,
    setAnalysisReport,
    // Migration Runs
    migrationRuns,
    setMigrationRuns,
    selectedRunId,
    setSelectedRunId,
    binaryFragments,
    setBinaryFragments,
    loadingFragments,
    setLoadingFragments,
    // Handlers
    handleCreateNew,
    handleCancelNew,
    handleExportLibrary,
    handleImportLibrary,
    handleDeleteLibrary,
  };
}
