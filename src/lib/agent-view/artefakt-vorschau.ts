/**
 * @fileoverview Vorschau-Art des Originals (Welle A3) — pur.
 *
 * @description
 * Der Tab „Original" zeigt je nach Art einen Abspieler (Audio/Video), eine
 * eingebettete Vorschau (PDF, Bild) oder den Rohtext (Markdown/Text). Fuer
 * alles andere — auch Word — gibt es KEINE eingebettete Browser-Vorschau:
 * dieser Zustand ist benannt (`keine`) und verweist ins Archiv, statt eine
 * leere Flaeche oder eine geratene Einbettung zu zeigen
 * (`no-silent-fallbacks.mdc`).
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

export type VorschauArt = 'audio' | 'video' | 'pdf' | 'bild' | 'text' | 'keine'

const ART_NACH_ENDUNG: Record<string, VorschauArt> = {
  m4a: 'audio', mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', opus: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video',
  pdf: 'pdf',
  png: 'bild', jpg: 'bild', jpeg: 'bild', gif: 'bild', webp: 'bild', svg: 'bild',
  md: 'text', txt: 'text',
}

/** Vorschau-Art aus dem Dateinamen; unbekannte Endung = benanntes `keine`. */
export function vorschauArt(dateiName: string): VorschauArt {
  const punkt = dateiName.lastIndexOf('.')
  if (punkt < 0 || punkt === dateiName.length - 1) return 'keine'
  const endung = dateiName.slice(punkt + 1).toLowerCase()
  return ART_NACH_ENDUNG[endung] ?? 'keine'
}

/** Provider-agnostische Binary-URL des Originals (bestehende Streaming-Route). */
export function originalUrl(libraryId: string, sourceId: string): string {
  return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(sourceId)}`
}
