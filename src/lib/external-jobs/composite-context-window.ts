/**
 * @fileoverview Vorpruefung des Composite-Kontextfensters vor dem LLM-Aufruf.
 *
 * @description
 * Eine Sammeldatei wird fuer das Modell zu einem Text geflacht: „# Quellenübersicht"
 * (Tabelle mit einer Zeile je Quelle), „## Verfügbare Medien" und je Quelle ein
 * `<source file="…">…</source>`-Block. Stimmen Uebersicht und Bloecke nicht
 * ueberein, ist die Aufloesung schiefgegangen, und der Job bricht VOR dem
 * LLM-Aufruf ab, statt eine halbe Quelle zu transformieren.
 *
 * Befund 06.11.2026 (SFSCON-Aufbau): Die Quellenzeilen wurden im GESAMTEN Text
 * gezaehlt. Folientexte mit nummerierten Tabellen (`| 1 | … | … |`) liessen so
 * 33 Jobs mit „Quellenübersicht meldet 7 Quelle(n)" scheitern, obwohl die
 * Sammeldatei eine einzige Quelle hatte. Gezaehlt wird jetzt nur der Abschnitt
 * der Uebersicht: von „# Quellenübersicht" bis zur naechsten Ueberschrift oder
 * zum ersten Source-Block.
 *
 * @module external-jobs
 */

const UEBERSCHRIFT = '# Quellenübersicht'

/**
 * Der Abschnitt der Quellenübersicht ohne seine Ueberschrift — bis zur naechsten
 * Markdown-Ueberschrift beliebiger Stufe oder zum ersten `<source`-Block. Null,
 * wenn der Text keine Quellenübersicht hat.
 */
export function quellenuebersichtAbschnitt(text: string): string | null {
  const start = text.indexOf(UEBERSCHRIFT)
  if (start < 0) return null
  const zeilen = text.slice(start + UEBERSCHRIFT.length).split('\n')
  const abschnitt: string[] = []
  for (const zeile of zeilen) {
    if (/^#{1,6}\s/.test(zeile) || zeile.startsWith('<source ')) break
    abschnitt.push(zeile)
  }
  return abschnitt.join('\n')
}

/** Zeilen der Uebersichtstabelle, z. B. `| 1 | datei.pdf | PDF |` — nur im Abschnitt der Uebersicht. */
export function zaehleQuellenzeilen(text: string): number {
  const abschnitt = quellenuebersichtAbschnitt(text)
  if (abschnitt === null) return 0
  return (abschnitt.match(/^\|\s*\d+\s*\|.*\|.*\|$/gm) || []).length
}

/**
 * Prueft, ob zu jeder Quelle der Uebersicht ein Source-Block gehoert. Texte ohne
 * Quellenübersicht oder mit nur einer Quelle gelten als in Ordnung.
 */
export function validateCompositeContextWindow(text: string): { ok: true } | { ok: false; message: string } {
  if (!text || !text.includes(UEBERSCHRIFT)) {
    return { ok: true }
  }

  const expectedSources = zaehleQuellenzeilen(text)
  if (expectedSources < 2) {
    return { ok: true }
  }

  const openSources = (text.match(/<source file="/g) || []).length
  const closeSources = (text.match(/<\/source>/g) || []).length

  const hasSourceMarkerMismatch = openSources !== closeSources
  const hasMissingOpenMarkers = closeSources > 0 && openSources === 0
  const hasTooFewSourceBlocks = openSources < expectedSources

  if (hasSourceMarkerMismatch || hasMissingOpenMarkers || hasTooFewSourceBlocks) {
    return {
      ok: false,
      message: `Composite-Kontext ungültig: Quellenübersicht meldet ${expectedSources} Quelle(n), aber Source-Blöcke sind inkonsistent (open=<source file= ${openSources}, close=</source> ${closeSources}). Bitte Composite-Resolution/Quelle prüfen.`,
    }
  }

  return { ok: true }
}
