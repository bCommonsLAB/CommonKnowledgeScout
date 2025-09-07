"use client";

import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf.mjs";
// Liefert die gebundelte URL des Workers (Webpack 5 Asset Modules)
// Beispiel: /_next/static/media/pdf.worker.mjs-<hash>.mjs
// Falls dein Setup '?url' nicht unterstützt, kopiere die Datei nach /public und setze den Pfad manuell.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Typ wird als string inferiert
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// Stelle sicher, dass der Worker-Pfad nur im Browser gesetzt wird
if (typeof window !== "undefined") {
  // Primär: gebundelte URL nutzen
  GlobalWorkerOptions.workerSrc = (workerUrl as unknown as string) || "/pdf.worker.mjs";
}


