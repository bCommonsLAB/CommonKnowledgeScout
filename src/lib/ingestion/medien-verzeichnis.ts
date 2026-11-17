/**
 * @fileoverview Medienverzeichnis der Lesersicht: Dateiname → oeffentliche Adresse.
 *
 * @description
 * Der Ingest hebt eine feste Liste von Medienfeldern (`coverImageUrl`,
 * `attachments_url`, …) vom Dateinamen auf die Blob-Adresse. Vorlagen tragen
 * daneben eigene Bildfelder — etwa Vorder- und Rueckseite einer Karte —, deren
 * Namen der Ingest nicht kennt. Sie bleiben nach dem Medien-Vertrag
 * (`docs/contracts/media-lifecycle.md`) Dateinamen; eine fremde Anwendung, die
 * die Lesersicht ueber `doc-meta` liest, kommt damit nicht an das Bild.
 *
 * Statt weitere Felder umzuschreiben, legt der Ingest ein Verzeichnis daneben:
 * `media_names` und `media_urls`, gleich lang, wie `attachments_names` und
 * `attachments_url`. Aufgenommen wird ein Bild-Fragment des EIGENEN Twins genau
 * dann, wenn sein Dateiname als Wert eines Feldes im Dokument steht. Was kein
 * Feld nennt, steht nicht im Verzeichnis — die Extraktionsbilder eines PDFs
 * blaehen die Lesersicht also nicht auf. Kein Feld wird veraendert.
 *
 * Reine Auswahlfunktion, ohne Speicherzugriff. Reihenfolge nach Dateiname,
 * damit gleiche Eingabe dasselbe Verzeichnis ergibt.
 *
 * @module ingestion
 */

import type { MongoBinaryFragment } from '@/lib/repositories/shadow-twin-repo'

export interface MedienVerzeichnis {
  names: string[]
  urls: string[]
}

const BILD_ENDUNG = /\.(jpe?g|png|webp|gif)$/i

function istBildFragment(f: MongoBinaryFragment): boolean {
  return f.kind === 'image' || !!f.mimeType?.startsWith('image/') || BILD_ENDUNG.test(f.name)
}

/** Alle Dateinamen, die das Dokument als Feldwert nennt (Text oder Liste von Texten). Adressen zaehlen nicht. */
export function genannteDateinamen(meta: Record<string, unknown>): Set<string> {
  const namen = new Set<string>()
  const nimm = (wert: unknown): void => {
    if (typeof wert !== 'string') return
    const text = wert.trim()
    if (text.length === 0 || /^https?:\/\//i.test(text)) return
    namen.add(text)
  }
  for (const wert of Object.values(meta)) {
    if (Array.isArray(wert)) wert.forEach(nimm)
    else nimm(wert)
  }
  return namen
}

/**
 * Verzeichnis der Bild-Fragmente, deren Dateiname im Dokument genannt ist.
 * Vorschau-Varianten (`thumbnail`) und Fragmente ohne Adresse bleiben draussen.
 * Bei gleichem Namen gilt das erste Fragment mit Adresse.
 */
export function medienVerzeichnisAusFragmenten(
  meta: Record<string, unknown>,
  fragmente: ReadonlyArray<MongoBinaryFragment>,
): MedienVerzeichnis {
  const genannt = genannteDateinamen(meta)
  const adressen = new Map<string, string>()
  for (const f of fragmente) {
    if (!f.url || f.variant === 'thumbnail' || !istBildFragment(f)) continue
    if (!genannt.has(f.name) || adressen.has(f.name)) continue
    adressen.set(f.name, f.url)
  }
  const names = [...adressen.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return { names, urls: names.map((n) => adressen.get(n) as string) }
}
