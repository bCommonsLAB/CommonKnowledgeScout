// Minimale Typerklärung für pdfjs-dist ESM Build, um TS-Fehler zu vermeiden
// Hält die API so, wie sie im Viewer verwendet wird

declare module 'pdfjs-dist/build/pdf.mjs' {
  export interface PDFViewport {
    width: number
    height: number
  }

  export interface PDFPageRenderTask {
    promise: Promise<void>
  }

  export interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFViewport
    render(args: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }): PDFPageRenderTask
  }

  export interface PDFDocumentProxy {
    numPages: number
    getPage(pageNumber: number): Promise<PDFPageProxy>
  }

  export function getDocument(params: { url: string }): { promise: Promise<PDFDocumentProxy> }

  export const GlobalWorkerOptions: { workerSrc: string } | undefined
}


