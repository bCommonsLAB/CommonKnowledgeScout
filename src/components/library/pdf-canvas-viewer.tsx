"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { currentPdfPageAtom } from "@/atoms/pdf-viewer";
import "@/lib/pdfjs-worker-setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Lade pdf.js ausschließlich lokal (ESM) und setze Worker-Pfad bundler-freundlich
interface PdfJsModule {
  getDocument: (opts: { url: string }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (opts: { scale: number }) => { width: number; height: number }; render: (args: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> }> };
}
async function loadPdfJs(): Promise<PdfJsModule | null> {
  if (typeof window === 'undefined') return null;
  const mod = (await import('pdfjs-dist/build/pdf.mjs')) as unknown as PdfJsModule;
  return mod;
}

interface PdfCanvasViewerProps {
  src: string; // Streaming/Download-URL
}

export function PdfCanvasViewer({ src }: PdfCanvasViewerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useAtom(currentPdfPageAtom);
  const pdfDocRef = React.useRef<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (opts: { scale: number }) => { width: number; height: number }; render: (args: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> } | null>(null);
  const [numPages, setNumPages] = React.useState<number>(0);
  const [scale, setScale] = React.useState<number>(1.25);
  const [pageInput, setPageInput] = React.useState<number>(1);
  const programmaticScrollRef = React.useRef<boolean>(false);
  const rafPendingRef = React.useRef<number | null>(null);

  // Setze Seite aus Scroll-Position (Mitte des Viewports bestimmt die aktive Seite)
  const updatePageFromScroll = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const midY = container.scrollTop + container.clientHeight / 2;
    const canvases = Array.from(container.querySelectorAll('canvas[data-page]')) as HTMLCanvasElement[];
    if (canvases.length === 0) return;

    let bestPage = 1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of canvases) {
      const rectTop = c.offsetTop;
      const rectMid = rectTop + c.offsetHeight / 2;
      const dist = Math.abs(rectMid - midY);
      if (dist < bestDist) {
        bestDist = dist;
        const attr = c.getAttribute('data-page');
        bestPage = attr ? Number(attr) : bestPage;
      }
    }
    if (bestPage && bestPage !== currentPage) {
      setCurrentPage(bestPage);
      setPageInput(bestPage);
    }
  }, [currentPage, setCurrentPage]);

  // Throttled Scroll Listener
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (programmaticScrollRef.current) return; // Programmatic scroll: nicht zurückschreiben
      if (rafPendingRef.current !== null) return;
      rafPendingRef.current = window.requestAnimationFrame(() => {
        rafPendingRef.current = null;
        updatePageFromScroll();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll as EventListener);
      if (rafPendingRef.current !== null) {
        window.cancelAnimationFrame(rafPendingRef.current);
        rafPendingRef.current = null;
      }
    };
  }, [updatePageFromScroll]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      const pdfjsLib = await loadPdfJs();
      if (!pdfjsLib) return;
      const task = pdfjsLib.getDocument({ url: src });
      const pdfDoc = await task.promise;
      if (cancelled) return;
      pdfDocRef.current = pdfDoc;
      setNumPages(pdfDoc.numPages as number);
      setPageInput(1);

      // Render alle Seiten
      if (!containerRef.current) return;
      const container = containerRef.current;
      container.innerHTML = '';
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        // eslint-disable-next-line no-await-in-loop
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto 8px auto';
        canvas.setAttribute('data-page', String(pageNum));
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // eslint-disable-next-line no-await-in-loop
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }

      // Nach dem Initialrender zur Seite 1 scrollen
      programmaticScrollRef.current = true;
      container.scrollTo({ top: 0, behavior: 'auto' });
      window.setTimeout(() => { programmaticScrollRef.current = false; }, 150);
    }

    void run();
    return () => { cancelled = true; };
  }, [src]);

  // Bei Scale-Änderung Seiten neu rendern und aktuelle Seite beibehalten
  React.useEffect(() => {
    async function rerender() {
      const pdfDoc = pdfDocRef.current;
      const container = containerRef.current;
      if (!pdfDoc || !container) return;

      const targetPage = currentPage || 1;
      container.innerHTML = '';
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        // eslint-disable-next-line no-await-in-loop
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto 8px auto';
        canvas.setAttribute('data-page', String(pageNum));
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // eslint-disable-next-line no-await-in-loop
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }

      // Scroll zur vorher aktiven Seite
      programmaticScrollRef.current = true;
      const el = container.querySelector(`[data-page="${targetPage}"]`) as HTMLElement | null;
      if (el) container.scrollTo({ top: el.offsetTop - 16, behavior: 'auto' });
      window.setTimeout(() => { programmaticScrollRef.current = false; }, 150);
    }
    void rerender();
  }, [scale]);

  function scrollToPage(page: number) {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-page="${page}"]`) as HTMLElement | null;
    if (el) {
      programmaticScrollRef.current = true;
      container.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
      window.setTimeout(() => { programmaticScrollRef.current = false; }, 250);
    }
  }

  // Reagiere auf globale Seitenänderungen (z. B. Eingabe im Header)
  React.useEffect(() => {
    scrollToPage(currentPage || 1);
  }, [currentPage]);

  function handlePrev() {
    const target = Math.max(1, currentPage - 1);
    setPageInput(target);
    scrollToPage(target);
  }

  function handleNext() {
    const target = Math.min(Math.max(1, numPages), currentPage + 1);
    setPageInput(target);
    scrollToPage(target);
  }

  function handleZoom(delta: number) {
    const next = Math.max(0.5, Math.min(3, Number((scale + delta).toFixed(2))));
    setScale(next);
  }

  function handlePageInput(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = Number(pageInput);
    if (!Number.isFinite(val)) return;
    const clamped = Math.max(1, Math.min(numPages || val, val));
    setPageInput(clamped);
    scrollToPage(clamped);
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 p-2 border-b">
        <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Vorherige Seite">‹</Button>
        <Button variant="outline" size="icon" onClick={handleNext} aria-label="Nächste Seite">›</Button>
        <form onSubmit={handlePageInput} className="flex items-center gap-1">
          <Input name="page" value={pageInput} onChange={(e) => setPageInput(Number(e.target.value) || 1)} className="h-8 w-16 text-center" />
          <div className="text-xs text-muted-foreground">von {numPages || '…'}</div>
        </form>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button variant="outline" size="icon" onClick={() => handleZoom(-0.1)} aria-label="Zoom out">−</Button>
        <Button variant="outline" size="icon" onClick={() => handleZoom(+0.1)} aria-label="Zoom in">＋</Button>
        <div className="text-xs text-muted-foreground ml-2">Zoom: {(scale * 100).toFixed(0)}%</div>
        <div className="ml-auto text-xs text-muted-foreground">Automatischer Zoom (später)</div>
      </div>
      <div ref={containerRef} className="w-full h-full overflow-auto" />
    </div>
  );
}


