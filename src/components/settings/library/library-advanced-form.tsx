"use client"

/**
 * LibraryAdvancedForm — Experten-Teil der Bibliotheks-Einstellungen
 * (Bereich "Erweitert", Welle 3-IV-UX-3a, F8).
 *
 * Cache-/Speicherstrategie (Shadow Twin), Migration, Sprach-Bereinigung,
 * DIVA-Auswertung, Auto-Klassifikation und Konfigurations-Import/Export.
 * Nutzt den vollen useLibraryForm-Hook: react-hook-form haelt ALLE
 * Werte (auch Name/Status der Grundlagen-Seite) im State — Submit
 * sendet dieselbe vollstaendige Struktur wie bisher.
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
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

import { useLibraryForm } from "./hooks/use-library-form"
import { useShadowTwinMigration } from "./hooks/use-shadow-twin-migration"
import { useMigrationRunsLoader, useBinaryFragmentsLoader } from "./hooks/use-shadow-twin-analysis"
import { ShadowTwinConfigSection } from "./shadow-twin-config-section"
import { MigrationWizardSection } from "./migration-wizard-section"
import { LanguageCleanupSection } from "./language-cleanup-section"
import { ImportExportSection } from "./import-export-section"
import { CaptureWizardsEditor } from "./capture-wizards-editor"

export function LibraryAdvancedForm() {
  const {
    form,
    onSubmit,
    isLoading,
    isNew,
    isImportDialogOpen,
    setIsImportDialogOpen,
    activeLibraryId,
    activeLibrary,
    shadowTwinPersistToFilesystem,
    setShadowTwinPersistToFilesystem,
    shadowTwinAllowFilesystemFallback,
    setShadowTwinAllowFilesystemFallback,
    azureConfigured,
    isShadowTwinConfigDirty,
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
    handleExportLibrary,
    handleImportLibrary,
  } = useLibraryForm(false)

  // Migration-Callbacks
  const {
    runShadowTwinMigration,
    runDirectionalSync,
    runAnalysis,
    runLanguageCleanup,
    selectedFolderPath,
    setSelectedFolder,
    migrationProgress,
    isCancelling,
    cancelMigration,
  } = useShadowTwinMigration({
      activeLibraryId,
      isDryRunOpen,
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
    })

  const migrationRunsArray = Array.isArray(migrationRuns) ? migrationRuns : []
  const selectedRun = migrationRunsArray.find((run) => run.runId === selectedRunId) ?? null

  useMigrationRunsLoader({
    isDryRunOpen,
    activeLibraryId,
    setMigrationRuns,
    setSelectedRunId,
  })

  useBinaryFragmentsLoader({
    selectedRun,
    activeLibraryId,
    setBinaryFragments,
    setLoadingFragments,
  })

  if (!activeLibrary || isNew) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Cache & Speicherstrategie */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            <ShadowTwinConfigSection
              activeLibraryId={activeLibraryId}
              activeLibrary={activeLibrary}
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

            <MigrationWizardSection
              activeLibraryId={activeLibraryId}
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
              selectedFolderPath={selectedFolderPath}
              setSelectedFolder={setSelectedFolder}
              migrationProgress={migrationProgress}
              isCancelling={isCancelling}
              cancelMigration={cancelMigration}
            />

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
          </CardContent>
        </Card>

        {/* Inhalte erfassen (Wizard-Kuratierung, Plan 2 · W-C) */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Inhalte erfassen
            </h3>
            <FormField
              control={form.control}
              name="captureWizards"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Welche Wizards anbieten</FormLabel>
                  <FormDescription>
                    Waehle, welche Erfassungs-Wizards unter &quot;Inhalte erfassen&quot; erscheinen,
                    in welcher Reihenfolge und welcher der Default ist. Ohne Auswahl gilt das
                    Bestandsverhalten.
                  </FormDescription>
                  <FormControl>
                    <CaptureWizardsEditor
                      libraryId={activeLibraryId ?? undefined}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* DIVA & Auto-Klassifikation */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              DIVA & Auto-Klassifikation
            </h3>
            <FormField
              control={form.control}
              name="analyzeDivaTextureInfo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      DIVA-Liefersystem-Daten auswerten
                    </FormLabel>
                    <FormDescription>
                      Zeigt im Archiv-Detail einen Tab &quot;DIVA-Info&quot;, sobald eine
                      Sidecar-Datei (optionvalues.json) im Grosseltern-Ordner des
                      Texturverzeichnisses liegt und ein Treffer fuer die Textur existiert.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoApplyConfidenceThreshold"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">
                    Auto-Uebernahme ab Konfidenz (Stoffgruppe)
                  </FormLabel>
                  <FormDescription>
                    Schwellwert fuer die Auto-Uebernahme der Stoffgruppen-Klassifikation
                    (Stufe 4). Wenn der vom LLM bestimmte Wert{" "}
                    <code>confidence_class</code> diesen Schwellwert erreicht, kann die
                    Klassifikation ohne weitere Bestaetigung auf alle Mitglieder der Gruppe
                    uebernommen werden. Bereich [0, 1].
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={field.value}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) field.onChange(Math.min(1, Math.max(0, v)));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* DIVA-Archive-Defaults: Toolbar-Voreinstellungen fuer die Archiv-Dateiliste. */}
            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <h4 className="text-base font-medium">DIVA-Einstellungen (Archiv-Dateiliste)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Default-Werte fuer das DIVA-Toolbar-Popover: Filter,
                  Gruppierung, Zusatzspalten. Diese werden beim Oeffnen der
                  Bibliothek in die Toolbar uebernommen.
                </p>
              </div>

              <FormField
                control={form.control}
                name="divaArchiveFilterMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filter-Default</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Alle *_basecolor</SelectItem>
                        <SelectItem value="with">Nur *_basecolor mit DIVA-Info</SelectItem>
                        <SelectItem value="without">Nur *_basecolor ohne DIVA-Info</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="divaArchiveGroupByAttribute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gruppieren nach (Default)</FormLabel>
                    <FormDescription>
                      Annotations-Attribut, z.B. <code>stoffgruppe</code>,{" "}
                      <code>material</code>, <code>textur_name</code>, <code>farbe_hex</code>.
                      Leer = keine Gruppierung.
                    </FormDescription>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="z.B. stoffgruppe"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="divaArchiveExtraColumns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zusatzspalten (Default)</FormLabel>
                    <FormDescription>
                      Komma-separierte Liste von Sidecar-Feldern, die in der
                      Dateiliste angezeigt werden. <code>_thumbnail</code>
                      {" "}rendert das Preview-Bitmap. Beispiel:{" "}
                      <code>_thumbnail, Material, TextureName, RGB</code>.
                    </FormDescription>
                    <FormControl>
                      <Input
                        value={field.value.join(", ")}
                        placeholder="_thumbnail, Material, TextureName"
                        onChange={(e) => {
                          const parts = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                          field.onChange(parts);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Konfiguration uebertragen (Import/Export) */}
        <ImportExportSection
          isNew={isNew}
          isLoading={isLoading}
          isImportDialogOpen={isImportDialogOpen}
          setIsImportDialogOpen={setIsImportDialogOpen}
          activeLibraryLabel={activeLibrary?.label}
          handleExportLibrary={handleExportLibrary}
          handleImportLibrary={handleImportLibrary}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || (!form.formState.isDirty && !isShadowTwinConfigDirty)}
          >
            {isLoading ? "Wird gespeichert..." : "Änderungen speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
