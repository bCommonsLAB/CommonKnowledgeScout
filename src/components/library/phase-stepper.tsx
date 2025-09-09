"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { loadPdfDefaults, savePdfDefaults } from "@/lib/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();

  async function runPhase() {
    try {
      if (!provider || !activeLibraryId || !item || item.type !== 'file') {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider.getBinary(item.id);
      const file = new File([bin.blob], item.metadata.name, { type: item.metadata.mimeType });
      const defaults = loadPdfDefaults(activeLibraryId);
      const base: PdfTransformOptions = {
        targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
        fileName: TransformService.generateShadowTwinName(item.metadata.name, typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de'),
        createShadowTwin: true,
        fileExtension: 'md',
        extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
        useCache: defaults.useCache ?? true,
        includeImages: defaults.includeImages ?? false,
        template: typeof defaults.template === 'string' ? defaults.template : undefined,
      };
      // Phasenlogik: 1 nur Extraktion; 2 Template/Meta; 3 nur Ingestion
      const options: PdfTransformOptions = {
        ...base,
        // Neue Flags für vereinfachte Phasensteuerung
        doExtractPDF: phase >= 1,
        doExtractMetadata: phase >= 2,
        doIngestRAG: phase >= 3,
      };
      // Save defaults opportunistisch
      savePdfDefaults(activeLibraryId, options);
      await TransformService.transformPdf(file, item, options, provider, refreshItems, activeLibraryId);
      toast.success('Gestartet', { description: `Phase ${phase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badge(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === "completed") return "●";
    if (status === "in_progress") return "◐";
    if (status === "failed") return "✕";
    return "○";
  }

  function buttonStyle(isActive: boolean) {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <button
        key={id}
        type="button"
        className={buttonStyle(isActive)}
        onClick={() => setPhase(id)}
        aria-pressed={isActive}
        aria-label={`Phase ${id}: ${label}`}
      >
        <span className="mr-2">{label}</span>
        <span className="opacity-80">{badge(status)}</span>
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => void runPhase()}>
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}


