"use client";

import * as React from "react";
import { useAtom, useAtomValue } from "jotai";
import { activePdfPhaseAtom } from "@/atoms/pdf-phases";
import type { StorageItem, StorageProvider } from "@/lib/storage/types";
import { DocumentPreview } from "./document-preview";
import { MarkdownPreview } from "./markdown-preview";
import { JobReportTab } from "./job-report-tab";
import { PhaseStepper } from "./phase-stepper";
import { activeLibraryIdAtom, selectedShadowTwinAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { PdfCanvasViewer } from "./pdf-canvas-viewer";
import { useStorage } from "@/contexts/storage-context";
import { currentPdfPageAtom } from "@/atoms/pdf-viewer";
// Button und direkte Template-Analyse wurden entfernt – Steuerung erfolgt ausschließlich über PhaseStepper

interface PdfPhasesViewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  markdownContent?: string;
}

export function PdfPhasesView({ item, provider, markdownContent }: PdfPhasesViewProps) {
  const [phase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const shadowTwin = useAtomValue(selectedShadowTwinAtom);
  const [twinContent, setTwinContent] = React.useState<string>(markdownContent || "");
  const [twinLoading, setTwinLoading] = React.useState<boolean>(false);
  const [twinError, setTwinError] = React.useState<string | null>(null);
  const { provider: storageProvider } = useStorage();
  const [currentPage, setCurrentPage] = useAtom(currentPdfPageAtom);
  const leftRef = React.useRef<HTMLDivElement | null>(null);
  const rightRef = React.useRef<HTMLDivElement | null>(null);
  const syncingFromPdfRef = React.useRef(false);
  const syncingFromMarkdownRef = React.useRef(false);

  // Globaler Page→Scroll Sync (setzt die Markdown-Pane an die aktuelle Seite)
  React.useEffect(() => {
    if (phase !== 1 && phase !== 2) return;
    const container = phase === 1 ? rightRef.current : leftRef.current;
    if (!container) return;
    const marker = container.querySelector(`[data-page-marker="${currentPage}"]`) as HTMLElement | null
      || container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement | null
      || container.querySelector(`comment[data-page="${currentPage}"]`) as HTMLElement | null;
    if (!marker) return;
    syncingFromPdfRef.current = true;
    container.scrollTo({ top: marker.offsetTop - 16, behavior: 'smooth' });
    window.setTimeout(() => { syncingFromPdfRef.current = false; }, 250);
  }, [currentPage, phase]);

  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const markdownApiRef = React.useRef<{ scrollToText: (q: string) => void; scrollToPage: (n: number | string) => void; setQueryAndSearch: (q: string) => void } | null>(null);

  // Shadow‑Twin laden
  React.useEffect(() => {
    let cancelled = false;
    async function loadTwin() {
      try {
        setTwinLoading(true);
        setTwinError(null);
        if (!provider || !shadowTwin?.id) {
          setTwinContent("");
          return;
        }
        FileLogger.info('PdfPhasesView', 'Lade Shadow‑Twin Inhalt', { twinId: shadowTwin.id, name: shadowTwin.metadata?.name });
        const { blob } = await provider.getBinary(shadowTwin.id);
        const text = await blob.text();
        if (!cancelled) setTwinContent(text);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        FileLogger.error('PdfPhasesView', 'Fehler beim Laden des Shadow‑Twin', { error: message });
        if (!cancelled) setTwinError(message);
      } finally {
        if (!cancelled) setTwinLoading(false);
      }
    }
    void loadTwin();
    return () => { cancelled = true; };
  }, [provider, shadowTwin?.id]);

  // PDF-Streaming URL laden
  React.useEffect(() => {
    let cancelled = false;
    async function loadUrl() {
      try {
        if (!storageProvider || !item?.id) return;
        const url = await storageProvider.getStreamingUrl(item.id);
        if (!cancelled) setPdfUrl(url);
      } catch (err) {
        FileLogger.error('PdfPhasesView', 'PDF URL Fehler', err);
      }
    }
    void loadUrl();
    return () => { cancelled = true; };
  }, [storageProvider, item?.id]);

  // Markdown → PDF Scroll Sync via IntersectionObserver (bestimmte Seite aus Markdown ableiten)
  React.useEffect(() => {
    if (phase !== 1 && phase !== 2) return;
    const container = phase === 1 ? rightRef.current : leftRef.current;
    const leftContainer = leftRef.current;
    if (!container || !leftContainer) return;

    const markers = Array.from(container.querySelectorAll('[data-page-marker]')) as HTMLElement[];
    if (markers.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      if (syncingFromPdfRef.current) return;
      let best: { page: number; ratio: number } | null = null;
      for (const e of entries) {
        const attr = (e.target as HTMLElement).getAttribute('data-page-marker');
        const page = attr ? Number(attr) : NaN;
        if (Number.isNaN(page)) continue;
        const ratio = e.intersectionRatio;
        if (!best || ratio > best.ratio) best = { page, ratio };
      }
      if (!best || best.ratio < 0.25) return;
      if (!syncingFromMarkdownRef.current) {
        syncingFromMarkdownRef.current = true;
        const targetPane = phase === 1 ? leftContainer : rightRef.current;
        const selector = phase === 1 ? `[data-page="${best.page}"]` : `[data-page-marker="${best.page}"]`;
        const el = targetPane ? targetPane.querySelector(selector) as HTMLElement | null : null;
        if (el && targetPane) targetPane.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
        // Globale Seite aktualisieren, sodass auch andere Views reagieren
        if (best.page !== currentPage) setCurrentPage(best.page);
        window.setTimeout(() => { syncingFromMarkdownRef.current = false; }, 250);
      }
    }, { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] });

    markers.forEach(m => observer.observe(m));
    return () => observer.disconnect();
  }, [phase, twinContent]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <PhaseStepper />
        <div className="ml-auto flex items-center gap-2 pr-1">
          <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem('gpage') as HTMLInputElement | null); if (!input) return; const val = Number(input.value); if (Number.isFinite(val) && val >= 1) setCurrentPage(val); }}>
            <span className="text-xs text-muted-foreground">Seite</span>
            <input name="gpage" value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value) || 1)} className="h-7 w-16 text-center border rounded text-xs" />
            <button type="submit" className="h-7 px-2 border rounded text-xs">Gehe</button>
          </form>
        </div>
      </div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-2 h-full min-h-0">
        {/* Left Pane */}
        <div className="min-h-0 overflow-auto rounded border" ref={leftRef}>
          {phase === 1 && (
            pdfUrl ? <PdfCanvasViewer src={pdfUrl} /> : <DocumentPreview provider={provider} activeLibraryId={activeLibraryId} />
          )}
          {phase === 2 && (
            twinLoading ? (
              <div className="p-2 text-sm text-muted-foreground">Lade Shadow‑Twin…</div>
            ) : twinError ? (
              <div className="p-2 text-sm text-destructive">{twinError}</div>
            ) : (
              <MarkdownPreview
                content={twinContent}
                onRegisterApi={(api) => { markdownApiRef.current = api; }}
              />
            )
          )}
          {phase === 3 && (
            <div className="p-2 text-sm text-muted-foreground">Metadaten-Vorschau</div>
          )}
        </div>

        {/* Right Pane */}
        <div className="min-h-0 overflow-auto rounded border" ref={rightRef}>
          {phase === 1 && (
            twinLoading ? (
              <div className="p-2 text-sm text-muted-foreground">Lade Shadow‑Twin…</div>
            ) : twinError ? (
              <div className="p-2 text-sm text-destructive">{twinError}</div>
            ) : (
              <MarkdownPreview content={twinContent} />
            )
          )}
          {phase === 2 && (
            <div className="h-full">
              <JobReportTab
                libraryId={activeLibraryId}
                fileId={item.id}
                fileName={item.metadata?.name}
                provider={provider || undefined}
                sourceMode="frontmatter"
                viewMode="metaOnly"
                mdFileId={shadowTwin?.id || null}
                onJumpTo={({ page, evidence }) => {
                  if (typeof page === 'number' || typeof page === 'string') {
                    // Setze globalen Seitenzustand – alle Paneele folgen automatisch
                    const p = typeof page === 'string' ? Number(page) : page;
                    if (Number.isFinite(p)) setCurrentPage(p as number);
                  } else if (typeof evidence === 'string' && evidence.trim()) {
                    // Evidence-Suche im Markdown, Seite aus Marker ableiten und global setzen
                    if (markdownApiRef.current) {
                      markdownApiRef.current.setQueryAndSearch(evidence.slice(0, 80));
                      const vis = markdownApiRef.current.getVisiblePage?.();
                      if (vis && Number.isFinite(vis)) setCurrentPage(vis as number);
                    }
                  }
                }}
              />
            </div>
          )}
          {phase === 3 && (
            <div className="h-full">
              <JobReportTab libraryId={activeLibraryId} fileId={item.id} fileName={item.metadata?.name} provider={provider || undefined} sourceMode="merged" viewMode="full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


