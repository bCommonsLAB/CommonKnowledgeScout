/**
 * @fileoverview Themen gegen das Vokabular der Library pruefen (Wunschliste 5, A1).
 *
 * @description
 * `themen_setzen` verlangte in seiner Beschreibung Namen aus dem Vokabular,
 * pruefte sie aber nicht — jeder Tippfehler wurde geschrieben und wurde in
 * der Werkbank selbst zum Vokabular (Befund 09.09.2026: `KS-Datenmodel`).
 * Das ist ein stiller Fallback (`no-silent-fallbacks.md`).
 *
 * Hier lebt die reine Pruefung: Welche Namen fehlen im Vokabular, und welche
 * Eintraege liegen ihnen am naechsten? Verglichen wird normalisiert (Klein-
 * schreibung, Umlaute aufgeloest, nur Buchstaben und Ziffern), damit ein
 * Unterschied in Schreibweise als Vorschlag erscheint statt als neues Thema.
 * Kein I/O — die Entscheidung, ob ein unbekanntes Thema trotzdem geschrieben
 * wird, trifft der Aufrufer (`neuesThemaErlauben`).
 *
 * @module agent-view
 */

/** Ein Thema, das nicht im Vokabular steht, samt den naechstliegenden Eintraegen. */
export interface UnbekanntesThema {
  name: string
  vorschlaege: string[]
}

/** Mindestens ein Thema fehlt im Vokabular — nichts wird geschrieben. */
export class ThemaUnbekanntError extends Error {
  readonly code = 'thema_unbekannt' as const
  constructor(readonly unbekannt: readonly UnbekanntesThema[]) {
    super(formuliere(unbekannt))
  }
}

/** Hoechste Editierdistanz, bis zu der ein Vokabular-Eintrag als Vorschlag gilt. */
const MAX_DISTANZ = 2
const MAX_VORSCHLAEGE = 3

const UMLAUTE: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Vergleichsform eines Themennamens: klein, Umlaute aufgeloest, nur [a-z0-9]. */
export function normalisiereThema(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (zeichen) => UMLAUTE[zeichen] ?? zeichen)
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Prueft `themen` gegen `vokabular`. Liefert je unbekanntem Namen bis zu drei
 * Vorschlaege: zuerst Eintraege mit gleicher Vergleichsform (reine
 * Schreibvariante), dann nach Editierdistanz, dann Eintraege, die den Namen
 * enthalten oder in ihm enthalten sind. Leeres Ergebnis = alles bekannt.
 */
export function pruefeGegenVokabular(
  themen: readonly string[],
  vokabular: readonly string[],
): UnbekanntesThema[] {
  const bekannt = new Set(vokabular)
  const unbekannt: UnbekanntesThema[] = []
  for (const name of themen) {
    if (bekannt.has(name)) continue
    unbekannt.push({ name, vorschlaege: naechstliegende(name, vokabular) })
  }
  return unbekannt
}

function naechstliegende(name: string, vokabular: readonly string[]): string[] {
  const ziel = normalisiereThema(name)
  const bewertet = vokabular
    .map((eintrag) => {
      const form = normalisiereThema(eintrag)
      if (form === ziel) return { eintrag, rang: 0 }
      const distanz = editierdistanz(ziel, form)
      if (distanz <= MAX_DISTANZ) return { eintrag, rang: distanz }
      if (form.length >= 4 && (form.includes(ziel) || ziel.includes(form))) return { eintrag, rang: MAX_DISTANZ + 1 }
      return null
    })
    .filter((x): x is { eintrag: string; rang: number } => x !== null)
    .sort((a, b) => a.rang - b.rang || a.eintrag.localeCompare(b.eintrag))
  return bewertet.slice(0, MAX_VORSCHLAEGE).map((x) => x.eintrag)
}

/** Levenshtein-Distanz zweier kurzer Strings (Themennamen, keine Texte). */
function editierdistanz(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let vorherige = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const aktuelle = [i]
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1
      aktuelle[j] = Math.min(aktuelle[j - 1] + 1, vorherige[j] + 1, vorherige[j - 1] + kosten)
    }
    vorherige = aktuelle
  }
  return vorherige[b.length]
}

function formuliere(unbekannt: readonly UnbekanntesThema[]): string {
  const zeilen = unbekannt.map((u) =>
    u.vorschlaege.length > 0
      ? `„${u.name}" (meintest du: ${u.vorschlaege.map((v) => `„${v}"`).join(', ')}?)`
      : `„${u.name}" (nichts Aehnliches im Vokabular)`,
  )
  return (
    `Nicht im Vokabular der Library: ${zeilen.join('; ')} — nichts geschrieben. ` +
    'Namen aus abdeckung_lesen → themen.vokabular verwenden, oder neuesThemaErlauben: true ' +
    'setzen, wenn das Thema bewusst neu ist (dann auch in die Library-Einstellungen aufnehmen).'
  )
}
