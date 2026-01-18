"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(
      activeLibraryId,
      loadPdfDefaults(activeLibraryId),
      pdfOverrides,
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate
    );
    const targetLanguage = typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT;
    
    // Nutze zentrale buildArtifactName() Logik für Dateinamen-Generierung
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage,
    };
    const fileName = buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
    
    const base: PdfTransformOptions = {
      targetLanguage,
      fileName,
      createShadowTwin: true,
      fileExtension: 'md',
      // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
      useCache: defaults.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
      includeOcrImages: defaults.includeOcrImages,
      includePageImages: defaults.includePageImages,
      includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    const policies = {
      extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
      metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
      ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
    } as import('@/lib/processing/phase-policy').PhasePolicies;
    return {
      ...base,
      policies,
    } as PdfTransformOptions;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
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
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
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


