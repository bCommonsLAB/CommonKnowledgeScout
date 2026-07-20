/**
 * Marker-Guard fuer Website-Uebersetzungen (Phase C4).
 *
 * Der `markdown`-Body eines website-Docs traegt die Sektions-Marker
 * (`<!-- section layout=… bg=… -->`) und Bild-/Video-URLs. Die LLM-Uebersetzung
 * darf Text uebersetzen, aber Struktur und URLs NICHT veraendern — sonst
 * zerfaellt die uebersetzte Landingpage. Dieser Guard prueft das Ergebnis
 * VOR dem Persistieren; Verstoesse lassen die Translation fehlschlagen
 * (kein stiller Fallback auf kaputte Inhalte).
 */

import { parseWebsiteSections } from './parse-website-sections'
import type { WebsiteSection } from './types'

export interface MarkerGuardViolation {
  type: 'unparseable' | 'section-count' | 'section-attrs' | 'image-url' | 'video-url'
  message: string
}

/** Alle Markdown-Bild-URLs in Dokument-Reihenfolge (`![alt](url)`). */
function extractImageUrls(markdown: string): string[] {
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g
  const urls: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) urls.push(m[1])
  return urls
}

function tryParse(markdown: string): { sections: WebsiteSection[] } | { error: string } {
  try {
    return { sections: parseWebsiteSections(markdown) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Prueft, ob die Uebersetzung von `original` die Sektions-Marker und URLs
 * erhaelt. Leeres Array = alles in Ordnung.
 */
export function checkWebsiteMarkdownTranslation(
  original: string,
  translated: string,
): MarkerGuardViolation[] {
  const violations: MarkerGuardViolation[] = []

  const src = tryParse(original)
  const dst = tryParse(translated)
  if ('error' in src) {
    // Original selbst kaputt — hier nicht Aufgabe des Guards, aber melden.
    return [{ type: 'unparseable', message: `Original nicht parsebar: ${src.error}` }]
  }
  if ('error' in dst) {
    return [{ type: 'unparseable', message: `Uebersetzung nicht parsebar: ${dst.error}` }]
  }

  if (src.sections.length !== dst.sections.length) {
    violations.push({
      type: 'section-count',
      message: `Sektions-Anzahl veraendert: ${src.sections.length} -> ${dst.sections.length}`,
    })
    // Ohne gleiche Anzahl ist ein Paar-Vergleich nicht sinnvoll; URLs pruefen wir trotzdem.
  } else {
    src.sections.forEach((s, i) => {
      const d = dst.sections[i]
      if (s.layout !== d.layout || s.bg !== d.bg) {
        violations.push({
          type: 'section-attrs',
          message: `Sektion ${i + 1}: layout/bg veraendert (${s.layout}/${s.bg} -> ${d.layout}/${d.bg})`,
        })
      }
      if ((s.videoUrl ?? null) !== (d.videoUrl ?? null)) {
        violations.push({
          type: 'video-url',
          message: `Sektion ${i + 1}: Video-URL veraendert (${s.videoUrl ?? '—'} -> ${d.videoUrl ?? '—'})`,
        })
      }
    })
  }

  // Bild-URLs muessen exakt (inkl. Reihenfolge) erhalten bleiben — Alt-Texte
  // duerfen uebersetzt werden, die URL nicht.
  const srcUrls = extractImageUrls(original)
  const dstUrls = extractImageUrls(translated)
  if (srcUrls.length !== dstUrls.length || srcUrls.some((u, i) => u !== dstUrls[i])) {
    violations.push({
      type: 'image-url',
      message: `Bild-URLs veraendert: [${srcUrls.join(', ')}] -> [${dstUrls.join(', ')}]`,
    })
  }

  return violations
}
