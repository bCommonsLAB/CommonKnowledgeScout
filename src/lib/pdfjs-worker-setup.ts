"use client";

// In manchen Bundlern schlägt der Default-Import mit ?url fehl. Verwende statischen Fallback.
const WORKER_FALLBACK = "/pdf.worker.mjs";

if (typeof window !== "undefined") {
  // Setze WorkerSrc über dynamischen Import, ohne harte Named-Exporte zu erwarten
  (async () => {
    try {
      const mod = await import("pdfjs-dist/build/pdf.mjs");
      const anyMod = mod as unknown as { GlobalWorkerOptions?: { workerSrc: string } };
      if (anyMod.GlobalWorkerOptions) anyMod.GlobalWorkerOptions.workerSrc = WORKER_FALLBACK;
    } catch {
      // Fallback: nichts weiter nötig, pdf.js nutzt ggf. Default-Worker
    }
  })();
}


