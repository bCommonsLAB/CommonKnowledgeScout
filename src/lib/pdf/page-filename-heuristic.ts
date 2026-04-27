/**
 * @fileoverview Page Filename Heuristic
 *
 * @description
 * Leitet aus dem Markdown einer PDF-Seite einen sprechenden Dateinamen-Suffix
 * ab, damit die Seitenbilder im Working-Verzeichnis fuer den Anwender lesbar
 * sind (z.B. `page_001__GADERFORM_Preisliste.png`).
 *
 * Wichtig: Diese Heuristik wird NUR fuer das Working-Verzeichnis verwendet.
 * Im Shadow-Twin bleibt das Naming deterministisch bei `page_NNN.<ext>`.
 *
 * Heuristik (in dieser Reihenfolge):
 *  1) Erste Markdown-Headline (`#`, `##`, `###`) auf der Seite.
 *  2) ALL-CAPS-Zeile am Seitenanfang (1-3 Worte, alles Grossbuchstaben).
 *     Mistral-OCR markiert Brand-/Modellnamen wie "GARDENA", "CONFORM" oder
 *     "GADERFORM" oft als alleinstehende Grossbuchstaben-Zeile ohne Hash-Marker.
 *     Diese Stufe erfasst genau diese Faelle, bevor der naechste Fallback
 *     versehentlich Tabellen-/Bildunterschriften aufgreift.
 *  3) Erste nicht-triviale Textzeile (mind. 3 Woerter, keine reine Tabelle/Pipe,
 *     keine reine Zahl, kein Bild-Tag, keine Frontmatter-Zeile).
 *  4) Kein Suffix -> nur `page_NNN.<ext>`.
 *
 * Sanitizing: Wir nutzen `toSafeFolderName` aus dem markdown-page-splitter,
 * damit Sonderzeichen/Umlaute konsistent behandelt werden, und kuerzen das
 * Ergebnis auf max. `maxSuffixLength` Zeichen am letzten Wort-Trennzeichen.
 *
 * @module pdf
 *
 * @usedIn
 * - src/app/api/library/[libraryId]/pdf/split-pages-to-images/route.ts
 */

import { toSafeFolderName } from '@/lib/markdown/markdown-page-splitter'

export interface DeriveSpeakingPageFilenameArgs {
  /** 1-basierte Seitennummer. */
  pageNumber: number
  /**
   * Markdown-Inhalt dieser Seite (Bereich zwischen `--- Seite N ---` und
   * dem naechsten Marker, ohne den Marker selbst). Darf leer sein.
   */
  pageMarkdown: string
  /** Dateierweiterung des Bildes (`png`, `jpeg`, `jpg`). */
  imageExtension: 'png' | 'jpeg' | 'jpg'
  /**
   * Max. Anzahl Zeichen fuer den sprechenden Suffix. Default 40 - das hoffmann
   * laesst auch zusammen mit `page_NNN__` und Pfadlaenge unter Windows-Limits.
   */
  maxSuffixLength?: number
}

const HEADLINE_REGEX = /^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/m
const FRONTMATTER_LINE_REGEX = /^\s*[a-zA-Z_][\w-]*:\s*/
const IMAGE_LINE_REGEX = /!\[[^\]]*\]\([^)]+\)|<img\s/i
const PIPE_TABLE_LINE_REGEX = /^\s*\|/

/**
 * Pruefen, ob eine Zeile als Fallback-Quelle taugt.
 * - Mind. 3 "Woerter" (durch Whitespace getrennt) - schliesst kurze Logo-Texte aus.
 * - Keine reine Zahl, keine Tabellenzeile, keine Frontmatter-/Bild-Zeile.
 */
function isMeaningfulLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (PIPE_TABLE_LINE_REGEX.test(trimmed)) return false
  if (FRONTMATTER_LINE_REGEX.test(trimmed)) return false
  if (IMAGE_LINE_REGEX.test(trimmed)) return false
  if (/^\d+$/.test(trimmed)) return false
  if (/^---/.test(trimmed)) return false
  // Mindestens 3 Woerter (Whitespace-getrennt) - sonst ist's vermutlich Logo/Marke.
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 2)
  return words.length >= 3
}

/**
 * Maximale Zahl nicht-leerer Zeilen, die wir am Seitenanfang nach einer
 * ALL-CAPS-Headline absuchen. So bleibt der Treffer auf den Seitenanfang
 * begrenzt; ALL-CAPS-Brand-Marker tief in einer Tabelle werden ignoriert.
 */
const ALL_CAPS_HEAD_SCAN_LIMIT = 5

/**
 * Sucht eine ALL-CAPS-Single-Line-Headline am Seitenanfang.
 *
 * Hintergrund: Mistral-OCR (und vergleichbare Pipelines) liefern Brand-/Modell-
 * namen typischerweise als Plain-Text-Grossbuchstaben-Zeile (z.B. "GARDENA",
 * "CONFORM", "GADERFORM"), nicht als Markdown-Headline mit `#`. Diese Stufe
 * erfasst solche Faelle, bevor der 3-Woerter-Fallback Tabellenzellen oder
 * Bildunterschriften erfasst.
 *
 * Kriterien (alle muessen erfuellt sein):
 *  - Eine der ersten ALL_CAPS_HEAD_SCAN_LIMIT nicht-leeren Zeilen.
 *  - 1 bis 3 Worte (Whitespace-getrennt).
 *  - Mindestens 3 Buchstaben insgesamt (filtert "AB" oder "v1").
 *  - Alle Buchstaben sind Grossbuchstaben (Latin + dt. Umlaute aeoeuess).
 *  - Keine Pipe-/Bild-/Frontmatter-/Marker-/reine-Zahlen-Zeile.
 */
function findAllCapsHeadline(pageMarkdown: string): string | null {
  const lines = pageMarkdown.split(/\r?\n/)
  let nonEmptyChecked = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    nonEmptyChecked += 1
    if (nonEmptyChecked > ALL_CAPS_HEAD_SCAN_LIMIT) break

    // Strukturzeilen ignorieren - die zaehlen zwar fuer das Scan-Limit (sonst
    // koennten beliebig viele Tabellenzeilen voraus stehen), aber sie sind
    // niemals Headline-Kandidat.
    if (PIPE_TABLE_LINE_REGEX.test(line)) continue
    if (FRONTMATTER_LINE_REGEX.test(line)) continue
    if (IMAGE_LINE_REGEX.test(line)) continue
    if (/^---/.test(line)) continue
    if (/^\d+$/.test(line)) continue

    const words = line.split(/\s+/)
    if (words.length < 1 || words.length > 3) continue

    // Mindestlaenge an Buchstaben (ASCII Latin + dt. Umlaute).
    // Ziffern und Sonderzeichen zaehlen hier bewusst nicht.
    const letters = line.replace(/[^A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF]/g, '')
    if (letters.length < 3) continue

    // ALL CAPS: alle Buchstaben gleich ihrer toUpperCase()-Variante.
    // (toUpperCase() erfasst auch Umlaute korrekt: ae->AE etc., aber wichtig ist
    // hier nur, dass die Originalzeile bereits ueberall Grossbuchstaben hat.)
    if (letters !== letters.toUpperCase()) continue

    return line
  }
  return null
}

/**
 * Truncate am letzten Wort-Trennzeichen `-`, damit nicht mitten im Wort abgeschnitten wird.
 * Falls kein Trennzeichen gefunden: hartes Truncate.
 */
function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const cut = value.slice(0, maxLength)
  const lastDash = cut.lastIndexOf('-')
  // Nur am Wort-Boundary kuerzen, wenn der Rest noch sinnvoll ist (>= 3 Zeichen),
  // sonst fuegt das harte Truncate weniger Verwirrung hinzu.
  if (lastDash >= 3) return cut.slice(0, lastDash)
  return cut
}

/**
 * Liefert den sprechenden Suffix (ohne Trenner, ohne Extension) oder einen leeren
 * String, wenn die Seite keinen brauchbaren Inhalt hat.
 */
export function deriveSpeakingSuffix(args: {
  pageMarkdown: string
  maxSuffixLength: number
}): string {
  const { pageMarkdown, maxSuffixLength } = args
  if (!pageMarkdown || !pageMarkdown.trim()) return ''

  // 1) Markdown-Headline (#, ##, ###)
  const headlineMatch = pageMarkdown.match(HEADLINE_REGEX)
  let candidate: string | null = null
  if (headlineMatch && headlineMatch[1]) {
    candidate = headlineMatch[1]
  }

  // 2) ALL-CAPS-Single-Line-Headline am Seitenanfang
  //    (z.B. OCR-Brand-Marker wie "GARDENA", "CONFORM", "GADERFORM")
  if (!candidate) {
    candidate = findAllCapsHeadline(pageMarkdown)
  }

  // 3) Fallback: erste sinnvolle Textzeile mit >=3 Worten
  if (!candidate) {
    const lines = pageMarkdown.split(/\r?\n/)
    for (const line of lines) {
      if (isMeaningfulLine(line)) {
        candidate = line
        break
      }
    }
  }

  if (!candidate) return ''

  // Sanitize ueber den existierenden Helper (Lowercase, Bindestriche, Umlaute weg).
  const safe = toSafeFolderName(candidate)
  if (!safe) return ''
  return truncateAtWordBoundary(safe, maxSuffixLength)
}

/**
 * Baut den vollstaendigen Dateinamen fuer ein Page-Bild im Working-Verzeichnis.
 *
 * Beispiele:
 *  - Seite 1 mit `# GADERFORM PREISLISTE` -> `page_001__gaderform-preisliste.png`
 *  - Seite 3 ohne Headline, mit Text "Bett Conform Lisbon ..." -> `page_003__bett-conform-lisbon.png`
 *  - Seite 7 leer -> `page_007.png`
 */
export function deriveSpeakingPageFilename(args: DeriveSpeakingPageFilenameArgs): string {
  const { pageNumber, pageMarkdown, imageExtension } = args
  const maxSuffixLength = args.maxSuffixLength ?? 40

  const ext = imageExtension === 'jpg' ? 'jpeg' : imageExtension
  const padded = String(pageNumber).padStart(3, '0')
  const suffix = deriveSpeakingSuffix({ pageMarkdown, maxSuffixLength })

  return suffix ? `page_${padded}__${suffix}.${ext}` : `page_${padded}.${ext}`
}
