"use client"

/**
 * @fileoverview Migration-Wizard-Section für die Library-Einstellungen.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält:
 * - Dialog zum Laden von Artefakten aus dem Dateisystem
 * - Tabelle mit Migration-Run-Details (Artefakte + BinaryFragments)
 * - Run-Auswahl per Select
 *
 * H2-Fix: Im useShadowTwinAnalysis-Hook wird der loadRuns-Fehler jetzt geloggt.
 * H3-Fix: tryDecodePath-Catch hat jetzt console.debug-Logging.
 */

import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FormControl, FormDescription, FormLabel } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Upload } from "lucide-react"
import { StorageDirectoryPicker } from "@/components/settings/storage/storage-directory-picker"
import { MigrationProgress } from "./migration-progress"
import type { MigrationRun, MigrationProgress as MigrationProgressData } from "./hooks/use-shadow-twin-migration"
import type { BinaryFragment } from "./hooks/use-shadow-twin-analysis"

interface MigrationWizardSectionProps {
  activeLibraryId: string | null | undefined;
  isDryRunOpen: boolean;
  setIsDryRunOpen: (v: boolean) => void;
  dryRunRecursive: boolean;
  setDryRunRecursive: (v: boolean) => void;
  dryRunCleanupFilesystem: boolean;
  setDryRunCleanupFilesystem: (v: boolean) => void;
  dryRunRunning: boolean;
  dryRunError: string | null;
  migrationRunsArray: MigrationRun[];
  selectedRunId: string | null;
  setSelectedRunId: (id: string) => void;
  selectedRun: MigrationRun | null;
  binaryFragments: BinaryFragment[];
  loadingFragments: boolean;
  runShadowTwinMigration: () => Promise<void>;
  /** Verzeichnis-Auswahl (Einzel-Verzeichnis rekonstruieren) */
  selectedFolderPath: string;
  setSelectedFolder: (folderId: string, path: string) => void;
  /** Live-Fortschritt + Abbruch */
  migrationProgress: MigrationProgressData | null;
  isCancelling: boolean;
  cancelMigration: () => void;
}

/**
 * Hilfsfunktion: Versucht sourceId als Base64 zu dekodieren, um den Pfad zu erhalten.
 * H3-Fix: Catch loggt jetzt mit console.debug (defensives Fallback, kein User-Impact).
 */
function tryDecodePath(sourceId: string): string {
  if (
    !sourceId ||
    sourceId === "root" ||
    sourceId === "undefined" ||
    sourceId === "null"
  ) {
    return "";
  }
  // Prüfe, ob es wie Base64 aussieht
  if (!/^[A-Za-z0-9+/=]+$/.test(sourceId) || sourceId.length % 4 !== 0) {
    return "";
  }
  try {
    // Browser-seitige Base64-Dekodierung
    const decoded = atob(sourceId);
    if (decoded && decoded.includes("/") && !decoded.includes("..")) {
      return decoded.replace(/\\/g, "/");
    }
  } catch (err) {
    // atob kann bei ungültigem Base64 werfen — defensives Fallback, kein User-Impact
    console.debug(
      "[LibraryForm] Base64-Dekodierung fehlgeschlagen für sourceId:",
      sourceId,
      err
    );
  }
  return "";
}

/** Typ für einen gruppierten Datei-Eintrag (intern) */
interface FileEntry {
  sourceId: string;
  sourceName: string;
  parentName?: string;
  fileName: string;
  kind: string;
  mimeType?: string;
  size?: number;
  url?: string;
  hash?: string;
  mongoUpserted: boolean;
  filesystemDeleted: boolean;
  artifactKind?: "transcript" | "transformation";
  targetLanguage?: string;
  templateName?: string;
}

/**
 * Kombiniert Artefakte und BinaryFragments zu einer gruppierten Ansicht.
 */
function buildFileGroups(
  selectedRun: MigrationRun,
  binaryFragments: BinaryFragment[]
): Array<{
  sourceId: string;
  sourceName: string;
  path: string;
  files: FileEntry[];
}> {
  const artifacts = selectedRun.report?.upsertedArtifacts ?? [];
  const allFiles: FileEntry[] = [];

  // Artefakte (Markdown-Dateien) hinzufügen
  for (const artifact of artifacts) {
    allFiles.push({
      sourceId: artifact.sourceId,
      sourceName: artifact.sourceName ?? "Unbekannt",
      fileName: artifact.artifactFileName,
      kind: "markdown",
      mimeType: "text/markdown",
      mongoUpserted: artifact.mongoUpserted,
      filesystemDeleted: artifact.filesystemDeleted,
      artifactKind: artifact.kind,
      targetLanguage: artifact.targetLanguage,
      templateName: artifact.templateName,
    });
  }

  // BinaryFragments hinzufügen (keine Duplikate von Artefakt-Dateinamen)
  const artifactFileNames = new Set(
    artifacts.map((a) => a.artifactFileName.toLowerCase())
  );

  for (const fragment of binaryFragments) {
    if (
      fragment.kind === "markdown" &&
      artifactFileNames.has(fragment.name.toLowerCase())
    ) {
      continue;
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
      mongoUpserted: !!fragment.url,
      filesystemDeleted: selectedRun.params?.cleanupFilesystem ?? false,
    });
  }

  // Gruppierung nach sourceId
  const grouped = allFiles.reduce(
    (acc, file) => {
      const sid = file.sourceId ?? "unknown";
      if (!acc[sid]) {
        const path = file.parentName ?? tryDecodePath(sid);
        acc[sid] = {
          sourceId: sid,
          sourceName: file.sourceName ?? "Unbekannt",
          path,
          files: [],
        };
      }
      acc[sid].files.push(file);
      return acc;
    },
    {} as Record<
      string,
      { sourceId: string; sourceName: string; path: string; files: FileEntry[] }
    >
  );

  return Object.values(grouped).sort((a, b) => {
    if (a.path && b.path) return a.path.localeCompare(b.path);
    if (a.path) return -1;
    if (b.path) return 1;
    return a.sourceName.localeCompare(b.sourceName);
  });
}

/**
 * Section-Komponente: Migration-Wizard-Dialog.
 * Wird nur angezeigt wenn !isNew && activeLibrary vorhanden.
 */
export function MigrationWizardSection({
  activeLibraryId,
  isDryRunOpen,
  setIsDryRunOpen,
  dryRunRecursive,
  setDryRunRecursive,
  dryRunCleanupFilesystem,
  setDryRunCleanupFilesystem,
  dryRunRunning,
  dryRunError,
  migrationRunsArray,
  selectedRunId,
  setSelectedRunId,
  selectedRun,
  binaryFragments,
  loadingFragments,
  runShadowTwinMigration,
  selectedFolderPath,
  setSelectedFolder,
  migrationProgress,
  isCancelling,
  cancelMigration,
}: MigrationWizardSectionProps) {
  return (
    <div className="border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium">Aus Dateisystem laden</h4>
          <p className="text-xs text-muted-foreground">
            Liest Artefakte und Bilder aus dem Dateisystem und lädt sie in den Cache. Geeignet zum
            Rekonstruieren eines leeren Caches. Kann je nach Größe der Bibliothek einige Minuten
            dauern.
          </p>
        </div>
        <Dialog open={isDryRunOpen} onOpenChange={setIsDryRunOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" disabled={!activeLibraryId}>
              <Upload className="h-4 w-4 mr-2" />
              Laden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-auto !grid-cols-1">
            <DialogHeader>
              <DialogTitle>Aus Dateisystem laden</DialogTitle>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground space-y-2">
                  <span className="block">
                    <strong>Absicht:</strong> Liest alle Artefakte (Markdown, Bilder, Medien) aus dem
                    Dateisystem und erstellt die zugehörigen Cache-Einträge. Bestehende Einträge
                    werden aktualisiert, fehlende werden neu erstellt.
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1 space-y-1">
                    {/* v2-only: Cache ist immer der primaere Speicher */}
                    <span className="block">
                      <strong>Ziel:</strong> Artefakte werden primär im{" "}
                      <span className="font-mono">Cache</span> gespeichert.
                    </span>
                    <span className="block">
                      Gewähltes Verzeichnis:{" "}
                      <span className="font-mono">{selectedFolderPath || "/"}</span>
                    </span>
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 min-w-0">
              {/* Einzel-Verzeichnis wählen (Default: Library-Root). */}
              {activeLibraryId ? (
                <div className="rounded border p-3 space-y-2">
                  <FormLabel className="text-sm">Verzeichnis wählen</FormLabel>
                  <FormDescription>
                    Nur das gewählte Verzeichnis wird rekonstruiert. Ohne Auswahl wird die
                    Library‑Root verwendet.
                  </FormDescription>
                  <StorageDirectoryPicker
                    libraryId={activeLibraryId}
                    onPathChange={() => { /* Pfad-Anzeige läuft über onSelectFolder */ }}
                    onSelectFolder={setSelectedFolder}
                  />
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <FormLabel className="text-sm">Unterordner einbeziehen</FormLabel>
                  <FormDescription>Alle Unterordner rekursiv durchsuchen.</FormDescription>
                </div>
                <Switch checked={dryRunRecursive} onCheckedChange={setDryRunRecursive} />
              </div>
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <FormLabel className="text-sm">Dateien aufräumen</FormLabel>
                  <FormDescription>
                    Dateisystem-Artefakte nach erfolgreicher Cache-Befüllung löschen.
                  </FormDescription>
                </div>
                <Switch
                  checked={dryRunCleanupFilesystem}
                  onCheckedChange={setDryRunCleanupFilesystem}
                />
              </div>
              {dryRunError ? (
                <p className="text-xs text-destructive">{dryRunError}</p>
              ) : null}
              {/* Live-Fortschritt (x von y) + Abbrechen während des Laufs */}
              <MigrationProgress
                running={dryRunRunning}
                progress={migrationProgress}
                isCancelling={isCancelling}
                onCancel={cancelMigration}
              />
              <div className="border-t pt-3">
                <div className="text-sm font-medium">Bisherige Läufe</div>
                {migrationRunsArray.length === 0 ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Noch keine Läufe vorhanden.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <Select
                      value={selectedRunId ?? undefined}
                      onValueChange={(value) => setSelectedRunId(value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Lauf auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {migrationRunsArray.map((run) => {
                          const params = run.params ?? {};
                          const paramParts: string[] = [];
                          if (typeof params.recursive === "boolean") {
                            paramParts.push(`recursive: ${params.recursive}`);
                          }
                          if (typeof params.cleanupFilesystem === "boolean") {
                            paramParts.push(`cleanup: ${params.cleanupFilesystem}`);
                          }
                          if (params.folderId && params.folderId !== "root") {
                            paramParts.push(`folder: ${params.folderId.slice(0, 20)}...`);
                          }
                          const paramsStr =
                            paramParts.length > 0 ? ` (${paramParts.join(", ")})` : "";
                          return (
                            <SelectItem key={run.runId} value={run.runId}>
                              {new Date(run.startedAt).toLocaleString()} · {run.runId.slice(0, 8)} ·{" "}
                              {run.status}
                              {paramsStr}
                            </SelectItem>
                          );
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
                        Diese Tabelle zeigt alle Dateien, die im ausgewählten Migrationslauf
                        verarbeitet wurden. Gruppiert nach Quellen. Jede Zeile entspricht einer
                        einzelnen Datei (Markdown-Artefakte oder Binary-Fragmente wie Bilder, Audio,
                        Video).
                      </div>
                    </div>

                    {(() => {
                      const artifacts = selectedRun.report?.upsertedArtifacts ?? [];
                      if (artifacts.length === 0 && binaryFragments.length === 0) {
                        if (loadingFragments) {
                          return (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Lade Dateien...
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Keine Dateien gelistet.
                          </div>
                        );
                      }

                      const groups = buildFileGroups(selectedRun, binaryFragments);

                      return (
                        <div className="mt-2 max-h-[45vh] overflow-y-auto rounded border w-full">
                          <Accordion type="multiple" className="w-full">
                            {groups.map((group) => {
                              const displayPath = group.path ?? "Unbekanntes Verzeichnis";
                              const displayName = group.sourceName;
                              const fileCount = group.files.length;

                              return (
                                <AccordionItem
                                  key={group.sourceId}
                                  value={group.sourceId}
                                  className="border-b"
                                >
                                  <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                      <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                                        <span
                                          className="font-medium text-left truncate max-w-full"
                                          title={displayPath}
                                        >
                                          {displayPath}
                                        </span>
                                        <span
                                          className="text-muted-foreground text-[11px] truncate max-w-full"
                                          title={displayName}
                                        >
                                          {displayName}
                                        </span>
                                      </div>
                                      <span className="text-muted-foreground text-[11px] ml-2 shrink-0">
                                        {fileCount} {fileCount === 1 ? "Datei" : "Dateien"}
                                      </span>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-0 pb-0">
                                    <div className="overflow-x-auto">
                                      <div style={{ minWidth: "1000px" }}>
                                        <table
                                          className="w-full text-xs"
                                          style={{ minWidth: "1000px" }}
                                        >
                                          <thead className="sticky top-0 bg-muted/60">
                                            <tr className="text-left">
                                              <TooltipProvider>
                                                <th className="px-2 py-1 font-medium">
                                                  <Tooltip>
                                                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                      Dateiname
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="max-w-xs">
                                                        Name der verarbeiteten Datei
                                                        (Markdown-Artefakt oder Binary-Fragment).
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </th>
                                                <th className="px-2 py-1 font-medium">
                                                  <Tooltip>
                                                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                      Typ
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="max-w-xs">
                                                        Art der Datei: &quot;markdown&quot; (Artefakt),
                                                        &quot;image&quot;, &quot;audio&quot;,
                                                        &quot;video&quot; oder &quot;binary&quot;.
                                                      </p>
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
                                                      <p className="max-w-xs">
                                                        Azure Blob Storage URL (für Binary-Fragmente).
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </th>
                                                <th className="px-2 py-1 font-medium">
                                                  <Tooltip>
                                                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                      Hash
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="max-w-xs">
                                                        SHA-256 Hash (erste 16 Zeichen) für
                                                        Deduplizierung.
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </th>
                                                <th className="px-2 py-1 font-medium">
                                                  <Tooltip>
                                                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                      Cache
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="max-w-xs">
                                                        Status der Cache-Speicherung: &quot;gespeichert&quot;
                                                        = erfolgreich gespeichert/aktualisiert,
                                                        &quot;nein&quot; = nicht gespeichert.
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </th>
                                                <th className="px-2 py-1 font-medium">
                                                  <Tooltip>
                                                    <TooltipTrigger className="cursor-help underline decoration-dotted">
                                                      FS gelöscht
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p className="max-w-xs">
                                                        Ob die Dateisystemkopie nach erfolgreicher
                                                        Cache-Migration gelöscht wurde: &quot;ja&quot; =
                                                        gelöscht, &quot;nein&quot; = noch vorhanden oder
                                                        Cleanup deaktiviert.
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </th>
                                              </TooltipProvider>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {group.files.map((file, idx) => (
                                              <tr
                                                key={`${file.sourceId}-${file.fileName}-${idx}`}
                                                className="border-t align-top"
                                              >
                                                <td className="px-2 py-1 font-medium max-w-[300px] break-words">
                                                  {file.fileName}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {file.artifactKind
                                                    ? `${file.kind} (${file.artifactKind})`
                                                    : file.kind}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {file.size
                                                    ? `${(file.size / 1024).toFixed(1)} KB`
                                                    : "-"}
                                                </td>
                                                <td className="px-2 py-1 max-w-[400px] break-all text-[10px]">
                                                  {file.url ? (
                                                    <a
                                                      href={file.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-blue-600 hover:underline"
                                                    >
                                                      {file.url.length > 50
                                                        ? `${file.url.substring(0, 50)}...`
                                                        : file.url}
                                                    </a>
                                                  ) : (
                                                    "-"
                                                  )}
                                                </td>
                                                <td className="px-2 py-1 font-mono text-[10px]">
                                                  {file.hash ?? "-"}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {file.mongoUpserted ? "gespeichert" : "nein"}
                                                </td>
                                                <td className="px-2 py-1">
                                                  {file.filesystemDeleted ? "ja" : "nein"}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      );
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDryRunOpen(false)}
              >
                Schließen
              </Button>
              <ConfirmActionDialog
                title="Artefakte aus dem Dateisystem laden?"
                description={dryRunCleanupFilesystem
                  ? "Nach dem erfolgreichen Import werden die Artefakt-Dateien im Storage GELÖSCHT. Dieser Schritt kann nicht rückgängig gemacht werden."
                  : "Die Artefakte werden in den Cache importiert; die Dateien im Storage bleiben erhalten."}
                confirmLabel="Laden"
                destructive={dryRunCleanupFilesystem}
                onConfirm={() => void runShadowTwinMigration()}
                trigger={
                  <Button type="button" disabled={dryRunRunning}>
                    {dryRunRunning ? "Läuft…" : "Laden"}
                  </Button>
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
