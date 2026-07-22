/**
 * @fileoverview Deterministische Identitaets-Felder aus Pfad + Sidecar (Stufe 3).
 *
 * @description
 * Leitet `iln_nummer`, `textur_code`, `title` und `slug` rein deterministisch
 * aus dem Texturpfad/-namen und dem (optionalen) Sidecar-Eintrag ab. KEIN LLM
 * — diese Felder duerfen nicht halluziniert werden:
 *
 *  - `iln_nummer`: 13-stellige Nummer aus dem Verzeichnispfad (auch bei
 *    DivaStandardMaterials gesetzt — der Pfad enthaelt sie trotzdem). Leer,
 *    wenn keine ILN im Pfad.
 *  - `textur_code`: Sidecar-PFTFile hat VORRANG; sonst VCodex; sonst aus dem
 *    Dateinamen abgeleitet (Suffix `_basecolor`/`_normal`/… abschneiden,
 *    fuehrenden Zaehler entfernen, letzten Unterstrich vor der Endnummer auf
 *    "-" normalisieren).
 *  - `title`: Sidecar-`Name` hat VORRANG; sonst der Datei-Stamm ohne Suffix.
 *  - `slug`: ASCII-kebab-case-Form von `title` (max. 80 Zeichen).
 */

import type { OptionvalueEntry } from './types'

/** 13-stellige ILN, nicht in eine laengere Ziffernfolge eingebettet. */
const ILN_PATTERN = /(?<!\d)(\d{13})(?!\d)/

/** PBR-Kanalsuffixe, die hinten am Datei-Stamm wegfallen. */
const CHANNEL_SUFFIX = /_(basecolor|normal|roughness|metallic|ao|height|opacity)$/i

/** Maximale Slug-Laenge (Konvention, wie im Template-Schema dokumentiert). */
const MAX_SLUG_LENGTH = 80

export interface PathDerivedFields {
  /** 13-stellige ILN aus dem Pfad (leer, wenn nicht im Pfad). */
  iln_nummer: string
  /** Stabiler Material-Code (Sidecar-PFTFile bevorzugt, sonst aus Filename). */
  textur_code: string
  /** Anzeige-Titel (Sidecar-Name bevorzugt, sonst Filename-Stamm). */
  title: string
  /** ASCII-kebab-case-Slug aus `title` (max. 80 Zeichen). */
  slug: string
}

/**
 * Leitet die 4 Identitaets-Felder fuer den Pass-1-Postprocessor ab.
 *
 * @param args Quellpfad + Dateiname + Sidecar-Eintrag (oder null).
 */
export function derivePathFields(args: {
  filePath: string
  fileName: string
  supplierEntry: OptionvalueEntry | null
}): PathDerivedFields {
  const ilnMatch = (args.filePath ?? '').match(ILN_PATTERN)
  const iln_nummer = ilnMatch ? ilnMatch[1] : ''

  // PFTFile ist der stabile Textur-Schluessel; VCodex nur als optionaler Fallback.
  const sidecarCode =
    nonEmpty(args.supplierEntry?.PFTFile) ?? nonEmpty(args.supplierEntry?.VCodex)
  const textur_code = sidecarCode ?? extractTextureCodeFromFilename(args.fileName)

  const sidecarName = nonEmpty(args.supplierEntry?.Name)
  const title = sidecarName ?? filenameStem(args.fileName)

  const slug = slugify(title)

  return { iln_nummer, textur_code, title, slug }
}

/** Trim + null-Schutz; gibt undefined bei leerer/fehlender Eingabe. */
function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Filename-stem ohne Extension + ohne PBR-Suffix.
 * Beispiel: "3_ST_2031_0477_basecolor.jpg" → "3_ST_2031_0477".
 */
function filenameStem(fileName: string): string {
  const noExt = (fileName ?? '').replace(/\.[^.]+$/, '')
  return noExt.replace(CHANNEL_SUFFIX, '')
}

/**
 * Texturcode aus dem Dateinamen. Schritte:
 *  1) Datei-Stamm holen (siehe `filenameStem`).
 *  2) Optional fuehrenden Counter ("3_") entfernen.
 *  3) Wenn der Stamm mindestens ZWEI Zahlbloecke am Ende hat (z.B.
 *     "ST_2031_0477"), den letzten Unterstrich VOR der Endnummer auf
 *     Bindestrich normalisieren — das ist die Liefersystem-Konvention
 *     ("ST_2031-0477"). Codes mit nur einem Zahlblock ("LE_6128") bleiben
 *     unveraendert.
 */
function extractTextureCodeFromFilename(fileName: string): string {
  const stem = filenameStem(fileName)
  const withoutCounter = stem.replace(/^\d+_/, '')
  return withoutCounter.replace(/(_\d+)_(\d+)$/, '$1-$2')
}

/**
 * Slugify: ASCII-kebab-case, Diakritika entfernt, max. 80 Zeichen.
 * Beispiel: "Feincord Thyme" → "feincord-thyme",
 *           "Aussen-Stoff (XL)" → "aussen-stoff-xl".
 */
function slugify(input: string): string {
  // U+0300..U+036F = Combining-Diacritical-Marks. Per RegExp-Konstruktor mit
  // expliziten Unicode-Escapes erzeugt, damit das Source-Encoding stabil bleibt
  // (kein wortwoertliches Diakritika-Zeichen im File).
  const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')
  return (input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, MAX_SLUG_LENGTH)
}
