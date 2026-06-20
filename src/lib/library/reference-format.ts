/**
 * Referenz-Format-Klassifizierer (Plan 1 · A4c).
 *
 * Reine, storage-agnostische Hilfen, um einen Verweis/Anhang in einer Story
 * (eine URL oder ein Dateiname) seinem Anzeige-Format zuzuordnen — damit
 * `ReferenceList` ihn formatgerecht rendert (Audio → Player, Bild → Vorschau,
 * PDF → Dokument-Button, Web → Link …) statt nur „PDF vs. Link".
 *
 * Quelle der Format-Erkennung ist `getFileType` (extension-map.ts) — KEIN
 * zweites Endungs-Mapping (Single Source of Truth). Unbekannte/neue
 * `getFileType`-Werte landen NICHT still in einem Default, sondern werden
 * geloggt (no-silent-fallbacks.mdc). Keine React-Abhaengigkeit → voll
 * unit-testbar.
 */

import { getFileType } from '@/components/library/file-preview/extension-map'

/** Anzeige-Format eines Story-Verweises (steuert den Renderer). */
export type ReferenceFormat =
  | 'pdf'
  | 'audio'
  | 'video'
  | 'image'
  | 'office'
  | 'markdown'
  | 'web'

/** Ein klassifizierter Verweis (URL + Format + lesbarer Name). */
export interface ClassifiedReference {
  url: string
  format: ReferenceFormat
  name: string
}

/**
 * Eingabe fuer `classifyReferences`: entweder eine reine URL (Endung bestimmt
 * Format + Anzeige) ODER `{ url, name }` — dann bestimmt `name` (z.B. der
 * Original-Dateiname) Format UND Anzeige, waehrend `url` nur der Link ist.
 * Noetig, wenn der Link eine aufgeloeste Blob-URL OHNE Endung ist (Session).
 */
export type ReferenceInput = string | { url: string; name?: string }

/**
 * Stabile Gruppen-Reihenfolge fuer die Anzeige (Medien zuerst, Web zuletzt).
 * Exhaustiv ueber `ReferenceFormat` — neue Formate hier ERGAENZEN.
 */
export const REFERENCE_FORMAT_ORDER: readonly ReferenceFormat[] = [
  'image',
  'video',
  'audio',
  'pdf',
  'office',
  'markdown',
  'web',
]

/**
 * Liefert den Pfad-Anteil einer URL (ohne Query/Fragment), dekodiert.
 * Faellt bei relativen URLs/Dateinamen auf manuelles Abschneiden zurueck.
 */
function referencePathname(raw: string): string {
  const trimmed = raw.trim()
  try {
    return decodeURIComponent(new URL(trimmed).pathname)
  } catch {
    const noFragment = trimmed.split('#')[0]
    return noFragment.split('?')[0]
  }
}

/** Letztes Pfadsegment (= Dateiname mit Endung), oder leerer String. */
function fileNameFromReference(raw: string): string {
  const segments = referencePathname(raw).split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

/**
 * Ordnet einen Verweis (URL oder Dateiname) seinem Anzeige-Format zu.
 * Verweise ohne erkennbare Datei-Endung sind bewusst `'web'` (Link) — das ist
 * die korrekte, explizite Kategorie, kein stiller Fehler-Default.
 */
export function classifyReference(urlOrName: string): ReferenceFormat {
  const fileType = getFileType(fileNameFromReference(urlOrName))
  switch (fileType) {
    case 'pdf':
      return 'pdf'
    case 'audio':
      return 'audio'
    case 'video':
      return 'video'
    case 'image':
      return 'image'
    case 'docx':
    case 'pptx':
    case 'xlsx':
      return 'office'
    case 'markdown':
      return 'markdown'
    case 'website':
    case 'unknown':
      return 'web'
    default:
      // Neuer/unerwarteter getFileType-Wert: laut melden, nicht verschlucken.
      console.warn(
        `[reference-format] Unerwarteter getFileType-Wert „${fileType}" — als Web-Link behandelt.`,
      )
      return 'web'
  }
}

/**
 * Erzeugt einen lesbaren Anzeigenamen aus einer URL (Dateiname bevorzugt,
 * sonst Hostname + Pfad). Bei ungueltiger URL den Rohwert zurueckgeben.
 */
export function referenceDisplayName(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment)
    }
    const path = parsed.pathname.length > 1 ? parsed.pathname : ''
    return `${parsed.hostname}${path}`
  } catch {
    return url
  }
}

/**
 * Klassifiziert eine Liste von Verweisen (leere/whitespace-Eintraege fallen
 * weg). Reihenfolge bleibt die der Eingabe. Akzeptiert reine URLs ODER
 * `{ url, name }` (dann bestimmt `name` Format + Anzeige).
 */
export function classifyReferences(
  inputs: readonly ReferenceInput[] | undefined,
): ClassifiedReference[] {
  if (!Array.isArray(inputs)) return []
  const out: ClassifiedReference[] = []
  for (const raw of inputs) {
    const url = (typeof raw === 'string' ? raw : raw?.url ?? '').trim()
    if (!url) continue
    const name = typeof raw === 'string' ? '' : (raw.name ?? '').trim()
    const classifyKey = name || url
    out.push({
      url,
      format: classifyReference(classifyKey),
      name: name || referenceDisplayName(url),
    })
  }
  return out
}

/**
 * Gruppiert klassifizierte Verweise nach Format in stabiler Reihenfolge
 * (`REFERENCE_FORMAT_ORDER`). Leere Gruppen werden weggelassen.
 */
export function groupReferencesByFormat(
  refs: readonly ClassifiedReference[],
): Array<{ format: ReferenceFormat; items: ClassifiedReference[] }> {
  return REFERENCE_FORMAT_ORDER.map((format) => ({
    format,
    items: refs.filter((r) => r.format === format),
  })).filter((group) => group.items.length > 0)
}
