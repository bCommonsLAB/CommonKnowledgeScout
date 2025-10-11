"use client";

import * as React from "react";
import { useAtom, useAtomValue } from "jotai";
import { activePdfPhaseAtom } from "@/atoms/pdf-phases";
import type { StorageItem, StorageProvider } from "@/lib/storage/types";
import { DocumentPreview } from "./document-preview";
// MarkdownPreview ungenutzt entfernt
import { JobReportTab } from "./job-report-tab";
import { PhaseStepper } from "./phase-stepper";
import { activeLibraryIdAtom, selectedShadowTwinAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { PdfCanvasViewer } from "./pdf-canvas-viewer";
import { useStorage } from "@/contexts/storage-context";
import { currentPdfPageAtom } from "@/atoms/pdf-viewer";
import { extractFrontmatterBlock, parseFrontmatter } from "@/lib/markdown/frontmatter";
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
  const { provider: storageProvider } = useStorage();
  const [currentPage, setCurrentPage] = useAtom(currentPdfPageAtom);
  const [isPdfCollapsed, setIsPdfCollapsed] = React.useState(false);
  const leftRef = React.useRef<HTMLDivElement | null>(null);
  const rightRef = React.useRef<HTMLDivElement | null>(null);
  const syncingFromPdfRef = React.useRef(false);
  const syncingFromMarkdownRef = React.useRef(false);
  const [stepStatuses, setStepStatuses] = React.useState<{ p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" }>({});

  // Globaler Page→Scroll Sync: scrolle beide Paneele zur aktuellen Seite (falls Marker vorhanden)
  React.useEffect(() => {
    const scrollToMarker = (root: HTMLElement | null, selector: string) => {
      if (!root) return;
      const el = root.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      root.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    };
    // Links: PDF nutzt [data-page]
    scrollToMarker(leftRef.current, `[data-page="${currentPage}"]`);
    // Rechts: Markdown nutzt [data-page-marker]
    scrollToMarker(rightRef.current, `[data-page-marker="${currentPage}"]`);
  }, [currentPage]);

  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const markdownApiRef = React.useRef<{ scrollToText: (q: string) => void; scrollToPage: (n: number | string) => void; setQueryAndSearch: (q: string) => void; getVisiblePage?: () => number | null } | null>(null);

  // Shadow‑Twin laden
  React.useEffect(() => {
    let cancelled = false;
    async function loadTwin() {
      try {
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
      }
    }
    void loadTwin();
    return () => { cancelled = true; };
  }, [provider, shadowTwin?.id]);

  // Status aus Frontmatter ableiten
  React.useEffect(() => {
    try {
      const fm = extractFrontmatterBlock(twinContent || "");
      if (!fm) { setStepStatuses({}); return; }
      const meta = parseFrontmatter(fm);
      const m = meta as Record<string, unknown>;
      const to = (v: unknown): "completed"|"in_progress"|"failed"|"pending" => {
        const s = typeof v === 'string' ? v.toLowerCase() : '';
        if (s.includes('complete')) return 'completed';
        if (s.includes('running') || s.includes('progress')) return 'in_progress';
        if (s.includes('fail') || s.includes('error')) return 'failed';
        return 'pending';
      }
      setStepStatuses({ p1: to(m['extract_status']), p2: to(m['template_status']), p3: to(m['ingest_status']) });
    } catch { setStepStatuses({}); }
  }, [twinContent]);

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

  // Scroll Sync von rechts (Markdown) → links (PDF)
  React.useEffect(() => {
    const container = rightRef.current;
    const targetPane = leftRef.current;
    if (!container || !targetPane) return;
    const markers = Array.from(container.querySelectorAll('[data-page-marker]')) as HTMLElement[];
    if (markers.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (syncingFromPdfRef.current) return;
      let best: { page: number; ratio: number } | null = null;
      for (const e of entries) {
        const attr = (e.target as HTMLElement).getAttribute('data-page-marker');
        const page = attr ? Number(attr) : NaN;
        if (!Number.isFinite(page)) continue;
        const ratio = e.intersectionRatio;
        if (!best || ratio > best.ratio) best = { page, ratio };
      }
      if (!best || best.ratio < 0.25) return;
      syncingFromMarkdownRef.current = true;
      const el = targetPane.querySelector(`[data-page="${best.page}"]`) as HTMLElement | null;
      if (el) targetPane.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
      if (best.page !== currentPage) setCurrentPage(best.page);
      window.setTimeout(() => { syncingFromMarkdownRef.current = false; }, 250);
    }, { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] });
    markers.forEach(m => observer.observe(m));
    return () => observer.disconnect();
  }, [twinContent]);

  // Scroll Sync von links (PDF) → rechts (Markdown)
  React.useEffect(() => {
    const container = leftRef.current;
    const targetPane = rightRef.current;
    if (!container || !targetPane) return;
    const markers = Array.from(container.querySelectorAll('[data-page]')) as HTMLElement[];
    if (markers.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (syncingFromMarkdownRef.current) return;
      let best: { page: number; ratio: number } | null = null;
      for (const e of entries) {
        const attr = (e.target as HTMLElement).getAttribute('data-page');
        const page = attr ? Number(attr) : NaN;
        if (!Number.isFinite(page)) continue;
        const ratio = e.intersectionRatio;
        if (!best || ratio > best.ratio) best = { page, ratio };
      }
      if (!best || best.ratio < 0.25) return;
      syncingFromPdfRef.current = true;
      const el = targetPane.querySelector(`[data-page-marker="${best.page}"]`) as HTMLElement | null;
      if (el) targetPane.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
      if (best.page !== currentPage) setCurrentPage(best.page);
      window.setTimeout(() => { syncingFromPdfRef.current = false; }, 250);
    }, { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] });
    markers.forEach(m => observer.observe(m));
    return () => observer.disconnect();
  }, [pdfUrl]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <PhaseStepper statuses={stepStatuses} />
        <div className="ml-auto flex items-center gap-2 pr-1">
          <button type="button" className="h-7 px-2 border rounded text-xs" onClick={() => setIsPdfCollapsed(v => !v)}>{isPdfCollapsed ? 'PDF zeigen' : 'PDF ausblenden'}</button>
          <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem('gpage') as HTMLInputElement | null); if (!input) return; const val = Number(input.value); if (Number.isFinite(val) && val >= 1) setCurrentPage(val); }}>
            <span className="text-xs text-muted-foreground">Seite</span>
            <input name="gpage" value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value) || 1)} className="h-7 w-16 text-center border rounded text-xs" />
            <button type="submit" className="h-7 px-2 border rounded text-xs">Gehe</button>
          </form>
        </div>
      </div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-2 h-full min-h-0">
        {/* Left Pane: immer PDF (ein-/ausblendbar) */}
        <div className={`min-h-0 overflow-auto rounded border ${isPdfCollapsed ? 'hidden' : ''}`} ref={leftRef}>
          {pdfUrl ? <PdfCanvasViewer src={pdfUrl} /> : <DocumentPreview provider={provider} activeLibraryId={activeLibraryId} />}
        </div>

        {/* Right Pane: immer Analyse-Viewer (Markdown/Metadaten/Kapitel/Prozessinfo) */}
        <div className={`min-h-0 overflow-auto rounded border ${isPdfCollapsed ? 'col-span-2' : ''}`} ref={rightRef}>
          <div className="h-full">
            <JobReportTab
              libraryId={activeLibraryId}
              fileId={item.id}
              fileName={item.metadata?.name}
              provider={provider || undefined}
              sourceMode="frontmatter"
              viewMode="metaOnly"
              mdFileId={shadowTwin?.id || null}
              forcedTab={phase === 1 ? 'markdown' : phase === 2 ? 'meta' : 'process'}
              onJumpTo={({ page, evidence }) => {
                if (typeof page === 'number' || typeof page === 'string') {
                  const p = typeof page === 'string' ? Number(page) : page;
                  if (Number.isFinite(p)) setCurrentPage(p as number);
                } else if (typeof evidence === 'string' && evidence.trim()) {
                  if (markdownApiRef.current) {
                    markdownApiRef.current.setQueryAndSearch(evidence.slice(0, 80));
                    const vis = markdownApiRef.current.getVisiblePage?.();
                    if (vis && Number.isFinite(vis)) setCurrentPage(vis as number);
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


