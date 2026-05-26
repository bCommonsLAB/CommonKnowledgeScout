/**
 * @fileoverview Heuristischer Sidecar-Matcher (Stufe 1).
 *
 * @description
 * Ordnet einen Texturdateinamen einem Liefersystem-Eintrag zu. Rein
 * deterministisch, KEIN LLM. Strategien gegen VCodex / PFTFile /
 * TextureName mit Bindestrich/Unterstrich-Normalisierung, Prefix-Strip
 * (z.B. "3_") und Suffix-Strip (z.B. "_basecolor.jpg"). Die Funktion ist
 * pure und liefert ALLE Versuche zurueck — das Logging uebernimmt der
 * Aufrufer (siehe diva-texture-logger.ts), damit der Matcher in jeder
 * Umgebung importierbar + testbar bleibt.
 */

import type { MatchAttempt, MatchField, MatchResult, SupplierEntry } from './types'

/** Bekannte PBR-Map-Suffixe, die vom Texturnamen abgeschnitten werden. */
const MAP_SUFFIXES = [
  'basecolor', 'base_color', 'albedo', 'diffuse', 'color',
  'normal', 'roughness', 'metallic', 'metalness', 'height',
  'displacement', 'ao', 'ambientocclusion', 'opacity', 'alpha', 'preview',
]

/** Entfernt die Dateiendung (letztes Segment nach dem letzten Punkt). */
function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.slice(0, idx) : name
}

/**
 * Normalisiert Separatoren: Bindestrich/Unterstrich/Whitespace werden zu "_"
 * verschmolzen, Ergebnis in lowercase und ohne fuehrende/abschliessende "_".
 */
export function normalizeSeparators(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Schneidet ein abschliessendes PBR-Map-Suffix ab (z.B. "_basecolor"). */
function stripMapSuffix(base: string): string {
  for (const suffix of MAP_SUFFIXES) {
    const re = new RegExp(`[_-]${suffix}$`, 'i')
    if (re.test(base)) return base.replace(re, '')
  }
  return base
}

/** Schneidet einen fuehrenden Mapping-Prefix wie "3_" ab. */
function stripLeadingNumericPrefix(base: string): string {
  return base.replace(/^\d+[_-]/, '')
}

/**
 * Versucht, den Dateinamen einem Liefersystem-Eintrag zuzuordnen.
 *
 * @param fileName Dateiname der Textur (z.B. "3_ST_2031_0477_basecolor.jpg").
 * @param entries Bereits auf IsTexture==="True" gefilterte Sidecar-Eintraege.
 * @returns Erster Treffer (oder null) + Protokoll aller Versuche.
 */
export function matchTextureCode(fileName: string, entries: SupplierEntry[]): MatchResult {
  const base = stripExtension(fileName)
  const noSuffix = stripMapSuffix(base)
  const noPrefix = stripLeadingNumericPrefix(noSuffix)

  const candWithPrefix = normalizeSeparators(noSuffix)
  const candNoPrefix = normalizeSeparators(noPrefix)

  const attempts: MatchAttempt[] = []
  let firstMatch: MatchResult['match'] = null

  for (const { key, entry } of entries) {
    const strategies: Array<{ id: string; field: MatchField; candidate: string; rawTarget?: string }> = [
      { id: 'pftfile-exact', field: 'PFTFile', candidate: candWithPrefix, rawTarget: entry.PFTFile },
      { id: 'texturename-exact', field: 'TextureName', candidate: candWithPrefix, rawTarget: entry.TextureName },
      { id: 'vcodex-normalized', field: 'VCodex', candidate: candNoPrefix, rawTarget: entry.VCodex },
      { id: 'vcodex-withprefix', field: 'VCodex', candidate: candWithPrefix, rawTarget: entry.VCodex },
    ]

    for (const s of strategies) {
      if (s.rawTarget === undefined || s.rawTarget === null || String(s.rawTarget).trim() === '') continue
      const target = normalizeSeparators(String(s.rawTarget))
      if (target.length === 0) continue
      const matched = s.candidate.length > 0 && s.candidate === target
      attempts.push({
        strategy: s.id,
        field: s.field,
        entryKey: key,
        candidate: s.candidate,
        target,
        matched,
      })
      if (matched && firstMatch === null) {
        firstMatch = { entry, entryKey: key, strategy: s.id }
      }
    }
  }

  return { match: firstMatch, attempts }
}
