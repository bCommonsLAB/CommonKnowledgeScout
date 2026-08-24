/**
 * @fileoverview Zeilen-chirurgischer Stand-Patch (F8, Nachzug aus dem W7-Live-Test).
 *
 * @description
 * `patchFrontmatter` (Single-Serializer) schreibt das GESAMTE Frontmatter
 * neu und quotet dabei jeden String (`type: index` → `type: "index"`) —
 * fuer maschinen-eigene Dateien richtig, fuer das von Hand gepflegte
 * `_INDEX.md` aber eine sichtbare Aenderung an Zeilen, die niemand
 * angefasst hat (Test-Befund 24.08.). Dieses Modul ersetzt deshalb NUR die
 * Stand-Zeilen im Frontmatter-Block und laesst alle anderen Zeilen Byte
 * fuer Byte stehen — Schreibweise, Kommentare und Leerzeilen inklusive.
 *
 * Das ist bewusst KEIN zweiter Serializer: Die Werte kommen aus
 * `baueStandPatch` und sind ein geschlossener Vorrat (Stand-Enum + Datum,
 * beides plain-YAML-sicher, nie mehrzeilig), die Keys sind flach
 * (AGENTS.md-Frontmatter-Regel). Der Aufrufer MUSS das Ergebnis vor dem
 * Schreiben gegen den echten Parser ruecklesen (`stand-schreiben.ts` tut
 * das) — schlaegt die Chirurgie fehl, bricht der Vorgang laut ab, nichts
 * wird geschrieben (`no-silent-fallbacks.mdc`).
 *
 * @module agent-view
 */

/** Zeilenende der Datei respektieren — kein Mischmasch in CRLF-Dateien. */
function eolVon(markdown: string): string {
  return markdown.includes('\r\n') ? '\r\n' : '\n'
}

function patchBlock(block: string, patch: Record<string, string>, eol: string): string {
  let ergebnis = block
  const fehlend: string[] = []
  for (const [key, value] of Object.entries(patch)) {
    // `^key:` trifft nur den flachen Top-Level-Key (kein eingerueckter
    // Treffer); `bearbeitungsstand:` trifft `bearbeitungsstand_seit:` nicht,
    // weil der Doppelpunkt direkt folgen muss.
    const zeile = new RegExp(`^${key}:[^\r\n]*$`, 'm')
    if (zeile.test(ergebnis)) {
      // Funktions-Replacement: der Wert bleibt woertlich, auch mit `$` darin.
      ergebnis = ergebnis.replace(zeile, () => `${key}: ${value}`)
    } else {
      fehlend.push(`${key}: ${value}`)
    }
  }
  if (fehlend.length === 0) return ergebnis
  const anhang = fehlend.join(eol)
  return ergebnis === '' ? anhang : `${ergebnis}${eol}${anhang}`
}

/**
 * Ersetzt bzw. ergaenzt die Patch-Zeilen im Frontmatter-Block; eine Datei
 * ohne Frontmatter bekommt einen neuen Block vorangestellt (Body bleibt
 * unveraendert). Werte muessen plain-YAML-sichere Einzeiler sein — fuer den
 * Stand-Patch garantiert `baueStandPatch` genau das.
 */
export function patchStandZeilen(markdown: string, patch: Record<string, string>): string {
  const eol = eolVon(markdown)

  // Erster Zeilen-Treffer `---` nach der Oeffnung schliesst den Block —
  // dieselbe Lesart wie der Parser bei flachem Frontmatter.
  const treffer = markdown.match(/^---(\r?\n)([\s\S]*?)(\r?\n)---(\r?\n|$)/)
  if (!treffer) {
    if (markdown.startsWith('---')) {
      throw new Error(
        'Frontmatter-Block des _INDEX.md nicht eindeutig abgrenzbar — Stand-Patch abgebrochen, nichts geschrieben',
      )
    }
    const block = Object.entries(patch)
      .map(([key, value]) => `${key}: ${value}`)
      .join(eol)
    return `---${eol}${block}${eol}---${eol}${eol}${markdown}`
  }

  const blockStart = 3 + treffer[1].length
  const block = treffer[2]
  const gepatcht = patchBlock(block, patch, eol)
  return markdown.slice(0, blockStart) + gepatcht + markdown.slice(blockStart + block.length)
}
