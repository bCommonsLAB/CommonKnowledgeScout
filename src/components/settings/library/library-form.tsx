"use client"

/**
 * @fileoverview Library-Settings-Formular — Haupt-Render-Komponente.
 *
 * @description
 * Refactored in Welle 3-IV-a: Von 2.222 Zeilen auf ~400 Zeilen reduziert.
 * Alle Sections und Hooks sind in separate Module extrahiert:
 * - use-library-form.ts: Form-State + alle CRUD-Handler
 * - use-shadow-twin-migration.ts: Migration/Sync-Callbacks
 * - use-shadow-twin-analysis.ts: Lade-Hooks (Runs + Fragments)
 * - shadow-twin-config-section.tsx: Shadow-Twin-Flags + Strategie-Vorschau
 * - migration-wizard-section.tsx: Dialog "Aus Dateisystem laden"
 * - language-cleanup-section.tsx: Dialog "Artefakte nach Sprache bereinigen"
 * - import-export-section.tsx: Export/Import für Library-Konfiguration
 */

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
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { CreateLibraryDialog } from "@/components/library/create-library-dialog"

import { useLibraryForm } from "./hooks/use-library-form"
import { useShadowTwinMigration } from "./hooks/use-shadow-twin-migration"
import { useMigrationRunsLoader, useBinaryFragmentsLoader } from "./hooks/use-shadow-twin-analysis"
import { ShadowTwinConfigSection } from "./shadow-twin-config-section"
import { MigrationWizardSection } from "./migration-wizard-section"
import { LanguageCleanupSection } from "./language-cleanup-section"
import { ImportExportSection } from "./import-export-section"

interface LibraryFormProps {
  createNew?: boolean;
}

/**
 * Library-Settings-Formular.
 * Composites alle Section-Komponenten.
 */
export function LibraryForm({ createNew = false }: LibraryFormProps) {
  const hook = useLibraryForm(createNew);

  const {
    form,
    onSubmit,
    isLoading,
    isNew,
    setIsNew,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isImportDialogOpen,
    setIsImportDialogOpen,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    activeLibraryId,
    activeLibrary,
    shadowTwinMode,
    setShadowTwinMode,
    shadowTwinPrimaryStore,
    setShadowTwinPrimaryStore,
    shadowTwinPersistToFilesystem,
    setShadowTwinPersistToFilesystem,
    shadowTwinAllowFilesystemFallback,
    setShadowTwinAllowFilesystemFallback,
    azureConfigured,
    isShadowTwinConfigDirty,
    shadowTwinConfigRef,
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
    isSyncRunning,
    setIsSyncRunning,
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
    isAnalyzing,
    setIsAnalyzing,
    analysisReport,
    setAnalysisReport,
    migrationRuns,
    setMigrationRuns,
    selectedRunId,
    setSelectedRunId,
    binaryFragments,
    setBinaryFragments,
    loadingFragments,
    setLoadingFragments,
    handleCancelNew,
    handleExportLibrary,
    handleImportLibrary,
    handleDeleteLibrary,
  } = hook;

  // Migration-Callbacks
  const { runShadowTwinMigration, runDirectionalSync, runAnalysis, runLanguageCleanup } =
    useShadowTwinMigration({
      activeLibraryId,
      dryRunRecursive,
      dryRunCleanupFilesystem,
      langCleanupLang,
      setDryRunRunning,
      setDryRunError,
      setMigrationRuns,
      setSelectedRunId,
      setIsSyncRunning,
      setIsAnalyzing,
      setAnalysisReport,
      setIsLangAnalyzing,
      setIsLangDeleting,
      setLangCleanupResult,
    });

  // Migration-Runs + Fragments laden
  const migrationRunsArray = Array.isArray(migrationRuns) ? migrationRuns : [];
  const selectedRun = migrationRunsArray.find((run) => run.runId === selectedRunId) ?? null;

  useMigrationRunsLoader({
    isDryRunOpen,
    activeLibraryId,
    setMigrationRuns,
    setSelectedRunId,
  });

  useBinaryFragmentsLoader({
    selectedRun,
    activeLibraryId,
    setBinaryFragments,
    setLoadingFragments,
  });

  /** Formular-Reset auf aktuelle Library zurücksetzen */
  const handleReset = () => {
    if (activeLibrary) {
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
        storageConfig,
      });
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
      setShadowTwinPrimaryStore(nextSnapshot.primaryStore);
      setShadowTwinPersistToFilesystem(nextSnapshot.persistToFilesystem);
      setShadowTwinAllowFilesystemFallback(nextSnapshot.allowFilesystemFallback);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: Bibliothek-Auswahl + Neue Bibliothek */}
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
                {activeLibrary
                  ? `Bibliothek bearbeiten: ${activeLibrary.label}`
                  : "Bibliothek auswählen"}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isNew ? (
            <Button onClick={handleCancelNew} variant="outline" size="sm">
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
              {/* Name */}
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

              {/* Beschreibung */}
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
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Eine kurze Beschreibung der Bibliothek und ihres Inhalts.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transkriptionsstrategie */}
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
                        <SelectItem value="shadowTwin">
                          Neben Originaldatei speichern (Shadow Twin)
                        </SelectItem>
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

              {/* Shadow-Twin-Konfiguration */}
              {!isNew && activeLibrary && (
                <ShadowTwinConfigSection
                  activeLibraryId={activeLibraryId}
                  activeLibrary={activeLibrary}
                  shadowTwinMode={shadowTwinMode}
                  setShadowTwinMode={setShadowTwinMode}
                  shadowTwinPrimaryStore={shadowTwinPrimaryStore}
                  setShadowTwinPrimaryStore={setShadowTwinPrimaryStore}
                  shadowTwinPersistToFilesystem={shadowTwinPersistToFilesystem}
                  setShadowTwinPersistToFilesystem={setShadowTwinPersistToFilesystem}
                  shadowTwinAllowFilesystemFallback={shadowTwinAllowFilesystemFallback}
                  setShadowTwinAllowFilesystemFallback={setShadowTwinAllowFilesystemFallback}
                  azureConfigured={azureConfigured}
                  isSyncRunning={isSyncRunning}
                  runDirectionalSync={runDirectionalSync}
                  isAnalyzing={isAnalyzing}
                  analysisReport={analysisReport}
                  runAnalysis={runAnalysis}
                />
              )}

              {/* Migration-Wizard */}
              {!isNew && activeLibrary && (
                <MigrationWizardSection
                  activeLibraryId={activeLibraryId}
                  shadowTwinPrimaryStore={shadowTwinPrimaryStore}
                  isDryRunOpen={isDryRunOpen}
                  setIsDryRunOpen={setIsDryRunOpen}
                  dryRunRecursive={dryRunRecursive}
                  setDryRunRecursive={setDryRunRecursive}
                  dryRunCleanupFilesystem={dryRunCleanupFilesystem}
                  setDryRunCleanupFilesystem={setDryRunCleanupFilesystem}
                  dryRunRunning={dryRunRunning}
                  dryRunError={dryRunError}
                  migrationRunsArray={migrationRunsArray}
                  selectedRunId={selectedRunId}
                  setSelectedRunId={setSelectedRunId}
                  selectedRun={selectedRun}
                  binaryFragments={binaryFragments}
                  loadingFragments={loadingFragments}
                  runShadowTwinMigration={runShadowTwinMigration}
                />
              )}

              {/* Sprach-Bereinigung */}
              {!isNew && activeLibrary && (
                <LanguageCleanupSection
                  activeLibraryId={activeLibraryId}
                  isLangCleanupOpen={isLangCleanupOpen}
                  setIsLangCleanupOpen={setIsLangCleanupOpen}
                  langCleanupLang={langCleanupLang}
                  setLangCleanupLang={setLangCleanupLang}
                  isLangAnalyzing={isLangAnalyzing}
                  isLangDeleting={isLangDeleting}
                  langCleanupResult={langCleanupResult}
                  setLangCleanupResult={setLangCleanupResult}
                  runLanguageCleanup={runLanguageCleanup}
                />
              )}

              {/* Template-Verzeichnis */}
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
                      Verzeichnis in der Bibliothek, in dem die Secretary Service Templates
                      gespeichert werden.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bibliothek aktivieren */}
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Bibliothek aktivieren</FormLabel>
                      <FormDescription>
                        Wenn deaktiviert, wird die Bibliothek in der Anwendung nicht angezeigt.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Import/Export */}
          <ImportExportSection
            isNew={isNew}
            isLoading={isLoading}
            isImportDialogOpen={isImportDialogOpen}
            setIsImportDialogOpen={setIsImportDialogOpen}
            activeLibraryLabel={activeLibrary?.label}
            handleExportLibrary={handleExportLibrary}
            handleImportLibrary={handleImportLibrary}
          />

          {/* Formular-Aktionen */}
          <div className="flex justify-between">
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
              >
                Zurücksetzen
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                isLoading || (!isNew && !form.formState.isDirty && !isShadowTwinConfigDirty)
              }
            >
              {isLoading
                ? "Wird gespeichert..."
                : isNew
                ? "Bibliothek erstellen"
                : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Gefahrenzone: Bibliothek löschen */}
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
                  <h4 className="font-medium">
                    Bibliothek &quot;{activeLibrary.label}&quot; löschen
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen einer Bibliothek ist permanent und kann nicht rückgängig gemacht
                    werden. Alle Einstellungen und Verweise auf diese Bibliothek gehen verloren.
                  </p>
                </div>
                <Dialog
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                >
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
                        Sind Sie sicher, dass Sie die Bibliothek &quot;{activeLibrary.label}&quot;
                        löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDeleteLibrary()}
                        disabled={isLoading}
                      >
                        {isLoading
                          ? "Wird gelöscht..."
                          : "Bibliothek unwiderruflich löschen"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: Neue Bibliothek erstellen */}
      <CreateLibraryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={() => {
          setIsNew(false);
        }}
      />
    </div>
  );
}
