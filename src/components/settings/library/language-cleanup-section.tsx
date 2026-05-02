"use client"

/**
 * @fileoverview Sprach-Bereinigungsbereich für die Library-Einstellungen.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält den Dialog zum Bereinigen von Artefakten nach Sprache.
 * Zwei Schritte: Analyse (Dry-Run) → dann Löschen.
 */

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
import { FormLabel } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Languages } from "lucide-react"
import type { LangCleanupResult } from "./hooks/use-shadow-twin-migration"

interface LanguageCleanupSectionProps {
  activeLibraryId: string | null | undefined;
  isLangCleanupOpen: boolean;
  setIsLangCleanupOpen: (v: boolean) => void;
  langCleanupLang: string;
  setLangCleanupLang: (v: string) => void;
  isLangAnalyzing: boolean;
  isLangDeleting: boolean;
  langCleanupResult: LangCleanupResult | null;
  setLangCleanupResult: (v: LangCleanupResult | null) => void;
  runLanguageCleanup: (dryRun: boolean) => Promise<void>;
}

/**
 * Section-Komponente: Artefakte nach Sprache bereinigen.
 * Wird nur angezeigt wenn !isNew && activeLibrary vorhanden.
 */
export function LanguageCleanupSection({
  activeLibraryId,
  isLangCleanupOpen,
  setIsLangCleanupOpen,
  langCleanupLang,
  setLangCleanupLang,
  isLangAnalyzing,
  isLangDeleting,
  langCleanupResult,
  setLangCleanupResult,
  runLanguageCleanup,
}: LanguageCleanupSectionProps) {
  return (
    <div className="border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium">Artefakte nach Sprache bereinigen</h4>
          <p className="text-xs text-muted-foreground">
            Löscht alle Artefakte einer bestimmten Sprache aus Cache und Storage. Nützlich, wenn
            versehentlich in der falschen Sprache verarbeitet wurde.
          </p>
        </div>
        <Dialog
          open={isLangCleanupOpen}
          onOpenChange={(open) => {
            setIsLangCleanupOpen(open);
            if (!open) {
              setLangCleanupResult(null);
              setLangCleanupLang("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" disabled={!activeLibraryId}>
              <Languages className="h-4 w-4 mr-2" />
              Bereinigen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Artefakte nach Sprache bereinigen</DialogTitle>
              <DialogDescription>
                Wähle eine Sprache und starte zuerst eine Analyse, um zu sehen, welche Artefakte
                betroffen sind. Erst danach kann gelöscht werden.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Sprachauswahl */}
              <div className="flex items-center gap-3">
                <FormLabel className="text-sm shrink-0">Sprache</FormLabel>
                <Select
                  value={langCleanupLang}
                  onValueChange={(v) => {
                    setLangCleanupLang(v);
                    setLangCleanupResult(null);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sprache wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch (de)</SelectItem>
                    <SelectItem value="en">Englisch (en)</SelectItem>
                    <SelectItem value="fr">Französisch (fr)</SelectItem>
                    <SelectItem value="it">Italienisch (it)</SelectItem>
                    <SelectItem value="es">Spanisch (es)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!langCleanupLang || isLangAnalyzing}
                  onClick={() => void runLanguageCleanup(true)}
                >
                  <Search
                    className={`h-3.5 w-3.5 mr-1.5 ${isLangAnalyzing ? "animate-pulse" : ""}`}
                  />
                  {isLangAnalyzing ? "Analysiert…" : "Analysieren"}
                </Button>
              </div>

              {/* Analyse-Ergebnis */}
              {langCleanupResult && (
                <div className="rounded border p-3 text-xs space-y-3">
                  <div className="font-medium">
                    {langCleanupResult.dryRun ? "Analyse-Ergebnis" : "Lösch-Ergebnis"}
                    {" "}
                    ({langCleanupResult.targetLanguage.toUpperCase()})
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>Betroffene Dateien:</span>
                    <span className="font-mono">{langCleanupResult.totalFiles}</span>
                    <span>Artefakte gesamt:</span>
                    <span className="font-mono">{langCleanupResult.totalArtifacts}</span>
                    {langCleanupResult.storageDeleted !== null && (
                      <>
                        <span>Aus Storage gelöscht:</span>
                        <span className="font-mono">{langCleanupResult.storageDeleted}</span>
                      </>
                    )}
                  </div>

                  {/* Detailliste der betroffenen Dateien */}
                  {langCleanupResult.affectedFiles.length > 0 && (
                    <div className="max-h-60 overflow-auto border-t pt-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pr-2 py-0.5">Datei</th>
                            <th className="pr-2 py-0.5">Artefakte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {langCleanupResult.affectedFiles.map((f, i) => (
                            <tr key={i} className="border-t">
                              <td className="pr-2 py-1 max-w-[250px] truncate">{f.sourceName}</td>
                              <td className="pr-2 py-1">
                                {f.artifacts.map((a, j) => (
                                  <span
                                    key={j}
                                    className="inline-block mr-1.5 rounded bg-muted px-1 py-0.5 text-[10px]"
                                  >
                                    {a.kind}
                                    {a.templateName ? ` (${a.templateName})` : ""}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLangCleanupOpen(false)}
              >
                Schließen
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  !langCleanupResult ||
                  !langCleanupResult.dryRun ||
                  langCleanupResult.totalArtifacts === 0 ||
                  isLangDeleting
                }
                onClick={() => {
                  const count = langCleanupResult?.totalArtifacts ?? 0;
                  const lang = langCleanupResult?.targetLanguage?.toUpperCase() ?? "";
                  const confirmed = window.confirm(
                    `${count} Artefakte (${lang}) in ${langCleanupResult?.totalFiles ?? 0} Dateien unwiderruflich löschen?\n\nDieser Vorgang entfernt die Artefakte aus Cache und Storage.`
                  );
                  if (confirmed) void runLanguageCleanup(false);
                }}
              >
                {isLangDeleting
                  ? "Löscht…"
                  : `${langCleanupResult?.totalArtifacts ?? 0} Artefakte löschen`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
