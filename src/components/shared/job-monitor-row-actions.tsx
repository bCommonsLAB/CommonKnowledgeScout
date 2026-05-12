"use client";

/**
 * Action-Buttons für eine Zeile im Secretary-Jobs-Drawer.
 *
 * - `JobMonitorRowOpenButtons`: linke Seite (Datei öffnen, Ergebnis öffnen)
 * - `JobMonitorRowActions`: rechte Icon-Leiste (Trace, Löschen mit Inline-Bestätigung,
 *   Markdown kopieren, Neu starten)
 *
 * Die Komponenten besitzen ihren UI-State (Confirm/Retrying/…), die fachliche
 * Logik (Routing, API-Aufrufe) erhalten sie als Callback-Funktionen vom Panel.
 * Erfolg/Fehler werden per Sonner-Toast gemeldet. Navigationen (Datei/Ergebnis öffnen)
 * lösen nur bei Fehlern einen Toast aus, da die Navigation selbst das Feedback ist.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Check,
  Copy,
  FileText,
  FolderOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface JobMonitorRowItem {
  jobId: string;
  status: string;
  fileName?: string;
  sourceItemId?: string;
  shadowTwinFolderId?: string;
  resultItemId?: string;
  libraryId?: string;
}

/**
 * Auto-Reset-Zeitspanne, nach der das erste Trash-Klick-Bestätigungsfenster
 * wieder verschwindet, wenn der zweite Klick nicht folgt.
 */
const CONFIRM_RESET_MS = 5000;

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || "Unbekannter Fehler";
  if (typeof err === "string") return err;
  return "Unbekannter Fehler";
}

// ---------------------------------------------------------------------------
// JobMonitorRowOpenButtons
// ---------------------------------------------------------------------------

export interface JobMonitorRowOpenButtonsProps {
  item: JobMonitorRowItem;
  onOpenFile: (item: JobMonitorRowItem) => Promise<void>;
  onOpenResult: (item: JobMonitorRowItem) => Promise<void>;
}

export function JobMonitorRowOpenButtons({
  item,
  onOpenFile,
  onOpenResult,
}: JobMonitorRowOpenButtonsProps) {
  const [openingFile, setOpeningFile] = useState(false);
  const [openingResult, setOpeningResult] = useState(false);

  const handleOpenFile = useCallback(async () => {
    if (openingFile) return;
    setOpeningFile(true);
    try {
      await onOpenFile(item);
    } catch (err) {
      toast.error(`Datei öffnen fehlgeschlagen: ${describeError(err)}`);
    } finally {
      setOpeningFile(false);
    }
  }, [item, onOpenFile, openingFile]);

  const handleOpenResult = useCallback(async () => {
    if (openingResult) return;
    setOpeningResult(true);
    try {
      await onOpenResult(item);
    } catch (err) {
      toast.error(`Ergebnis öffnen fehlgeschlagen: ${describeError(err)}`);
    } finally {
      setOpeningResult(false);
    }
  }, [item, onOpenResult, openingResult]);

  const hasSource = Boolean(item.sourceItemId);
  // Ergebnis-Button auch dann zeigen, wenn nur resultItemId vorhanden ist
  // (Mongo-only Shadow-Twin); der Panel-Handler löst die FolderId per Detail-API auf.
  const hasResult = Boolean(item.resultItemId);

  if (!hasSource && !hasResult) return null;

  return (
    <TooltipProvider delayDuration={150}>
      {hasSource ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleOpenFile();
              }}
              disabled={openingFile}
              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted text-primary shrink-0 disabled:opacity-50"
              aria-label="Datei öffnen"
            >
              <FolderOpen
                className={cn("h-3.5 w-3.5", openingFile && "animate-pulse")}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Datei öffnen</TooltipContent>
        </Tooltip>
      ) : null}

      {hasResult ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleOpenResult();
              }}
              disabled={openingResult}
              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted text-primary shrink-0 disabled:opacity-50"
              aria-label="Ergebnis öffnen"
            >
              <FileText
                className={cn("h-3.5 w-3.5", openingResult && "animate-pulse")}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Ergebnis öffnen</TooltipContent>
        </Tooltip>
      ) : null}
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// JobMonitorRowActions
// ---------------------------------------------------------------------------

export interface JobMonitorRowActionsProps {
  item: JobMonitorRowItem;
  isTraceOpen: boolean;
  onToggleTrace: (jobId: string) => void;
  onRetry: (jobId: string) => Promise<void>;
  onDelete: (jobId: string) => Promise<void>;
  onCopyMarkdown: (jobId: string) => Promise<void>;
  /**
   * Test-Hook: wenn `true`, läuft der Auto-Reset-Timer der Inline-Bestätigung
   * nicht ab. Erlaubt deterministische Snapshot-Tests.
   */
  disableAutoReset?: boolean;
}

export function JobMonitorRowActions({
  item,
  isTraceOpen,
  onToggleTrace,
  onRetry,
  onDelete,
  onCopyMarkdown,
  disableAutoReset = false,
}: JobMonitorRowActionsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copying, setCopying] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  const handleDeleteClick = useCallback(async () => {
    if (deleting) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      clearConfirmTimer();
      if (!disableAutoReset) {
        confirmTimerRef.current = setTimeout(() => {
          setConfirmingDelete(false);
          confirmTimerRef.current = null;
        }, CONFIRM_RESET_MS);
      }
      return;
    }
    clearConfirmTimer();
    setDeleting(true);
    try {
      await onDelete(item.jobId);
      toast.success("Job gelöscht");
    } catch (err) {
      toast.error(`Löschen fehlgeschlagen: ${describeError(err)}`);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [
    confirmingDelete,
    deleting,
    disableAutoReset,
    item.jobId,
    onDelete,
    clearConfirmTimer,
  ]);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry(item.jobId);
      toast.success("Job neu gestartet");
    } catch (err) {
      toast.error(`Neu starten fehlgeschlagen: ${describeError(err)}`);
    } finally {
      setRetrying(false);
    }
  }, [item.jobId, onRetry, retrying]);

  const handleCopy = useCallback(async () => {
    if (copying) return;
    setCopying(true);
    try {
      await onCopyMarkdown(item.jobId);
      toast.success("Markdown kopiert");
    } catch (err) {
      toast.error(`Kopieren fehlgeschlagen: ${describeError(err)}`);
    } finally {
      setCopying(false);
    }
  }, [copying, item.jobId, onCopyMarkdown]);

  // Neu-Starten nur für terminale Zustände sinnvoll: queued läuft ohnehin
  // gleich vom Worker, running darf nicht neu gestartet werden.
  const showRetry = item.status === "failed" || item.status === "completed";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onToggleTrace(item.jobId)}
              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted"
              aria-label={isTraceOpen ? "Trace ausblenden" : "Trace anzeigen"}
            >
              <Activity
                className={cn(
                  "h-3.5 w-3.5",
                  isTraceOpen ? "text-primary" : "text-muted-foreground",
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isTraceOpen ? "Trace ausblenden" : "Trace anzeigen"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleDeleteClick()}
              onBlur={() => {
                if (!deleting) {
                  setConfirmingDelete(false);
                  clearConfirmTimer();
                }
              }}
              disabled={deleting}
              className={cn(
                "pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted disabled:opacity-50",
                confirmingDelete && "bg-destructive/10",
              )}
              aria-label={
                confirmingDelete ? "Löschen bestätigen" : "Job löschen"
              }
              data-confirming={confirmingDelete ? "true" : "false"}
            >
              {confirmingDelete ? (
                <Check className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Trash2
                  className={cn(
                    "h-3.5 w-3.5 text-destructive",
                    deleting && "animate-pulse",
                  )}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {confirmingDelete
              ? "Erneut klicken zum Bestätigen"
              : "Job löschen"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={copying}
              className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted disabled:opacity-50"
              aria-label="Als Markdown kopieren"
            >
              <Copy
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground",
                  copying && "animate-pulse",
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Als Markdown kopieren</TooltipContent>
        </Tooltip>

        {showRetry ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="pointer-events-auto inline-flex items-center justify-center rounded p-0.5 hover:bg-muted disabled:opacity-50"
                aria-label="Neu starten"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", retrying && "animate-spin")}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Neu starten</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
