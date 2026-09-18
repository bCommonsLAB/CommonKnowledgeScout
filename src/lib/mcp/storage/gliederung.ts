/**
 * @fileoverview Gliederung einer Markdown-Datei OHNE Body (Wunschliste 6, B1).
 *
 * @description
 * Um zu entscheiden, WAS aus einem gewachsenen Bericht ausgelagert wird,
 * musste eine Session ihn bisher ganz lesen (im Anlassfall 69 kB Kontext).
 * Die Gliederung liefert je Ueberschrift nur Ebene, Wortlaut, Zeilenbereich,
 * Bytes und die Zahl offener `- [ ]` — danach wird gezielt mit
 * `bereich: {art: "abschnitt"}` nachgelesen und mit `abschnitt_ersetzen`
 * verdichtet.
 *
 * Die Abschnittsgrenze ist DIESELBE wie beim Lesen und Ersetzen
 * (`findeAbschnitt` in `bereich.ts`): bis zur naechsten gleich- oder
 * hoeherrangigen Ueberschrift, Unterabschnitte eingeschlossen. Die Bytes
 * einer `##` enthalten also ihre `###` — die Summe aller Eintraege ist
 * deshalb groesser als die Datei.
 *
 * Reine Funktionen, kein Storage.
 *
 * @module mcp/storage
 */

export interface GliederungsEintrag {
  ebene: number
  ueberschrift: string
  /** 1-basiert, inklusive — passt zu `bereich: {art: "zeilen", von, bis}`. */
  vonZeile: number
  bisZeile: number
  /** UTF-8-Bytes des Abschnitts samt Unterabschnitten. */
  bytes: number
  /** Offene Checkboxen (`- [ ]`) im Abschnitt samt Unterabschnitten. */
  offenePunkte: number
  /**
   * Die Zeile steht in einem Codeblock oder im Frontmatter (z. B. ein
   * YAML-Kommentar) — sie sieht aus wie eine Ueberschrift, ist aber keine.
   * Ausgewiesen statt verschwiegen, weil `abschnitt` und `abschnitt_ersetzen`
   * sie genauso als Ueberschrift behandeln.
   */
  keineEchteUeberschrift?: true
}

export interface Gliederung {
  zeilenGesamt: number
  /** Bytes vor der ersten Ueberschrift (Frontmatter + Vorspann). */
  vorspannBytes: number
  eintraege: GliederungsEintrag[]
}

function ebene(zeile: string): number {
  const treffer = zeile.match(/^(#{1,6})\s/)
  return treffer ? treffer[1].length : 0
}

function bytes(zeilen: readonly string[]): number {
  return Buffer.from(zeilen.join('\n'), 'utf-8').length
}

/** Zeilen-Indizes (0-basiert), die im Frontmatter oder in einem Codeblock liegen. */
function unechteZeilen(zeilen: readonly string[]): Set<number> {
  const unecht = new Set<number>()
  let i = 0
  if (zeilen[0]?.trim() === '---') {
    const ende = zeilen.findIndex((zeile, idx) => idx > 0 && zeile.trim() === '---')
    if (ende > 0) {
      for (let k = 0; k <= ende; k++) unecht.add(k)
      i = ende + 1
    }
  }
  let zaun: string | null = null
  for (; i < zeilen.length; i++) {
    const treffer = zeilen[i].match(/^\s*(`{3,}|~{3,})/)
    if (zaun === null) {
      if (treffer) zaun = treffer[1]
    } else {
      unecht.add(i)
      // Ein Zaun schliesst nur mit gleichem Zeichen und mindestens gleicher Laenge.
      if (treffer && treffer[1][0] === zaun[0] && treffer[1].length >= zaun.length) zaun = null
    }
  }
  return unecht
}

/** Baut die Gliederung; eine Datei ohne Ueberschrift liefert eine leere Liste (kein Fehler). */
export function baueGliederung(text: string): Gliederung {
  const zeilen = text.split('\n')
  const unecht = unechteZeilen(zeilen)
  const koepfe = zeilen
    .map((zeile, index) => ({ index, stufe: ebene(zeile) }))
    .filter((kopf) => kopf.stufe > 0)

  const eintraege = koepfe.map((kopf, position): GliederungsEintrag => {
    const naechster = koepfe.slice(position + 1).find((spaeter) => spaeter.stufe <= kopf.stufe)
    const ende = naechster ? naechster.index : zeilen.length
    const abschnitt = zeilen.slice(kopf.index, ende)
    return {
      ebene: kopf.stufe,
      ueberschrift: zeilen[kopf.index].slice(kopf.stufe).trim(),
      vonZeile: kopf.index + 1,
      bisZeile: ende,
      bytes: bytes(abschnitt),
      offenePunkte: abschnitt.filter((zeile) => /^\s*- \[ \] /.test(zeile)).length,
      ...(unecht.has(kopf.index) ? { keineEchteUeberschrift: true as const } : {}),
    }
  })

  return {
    zeilenGesamt: zeilen.length,
    vorspannBytes: bytes(zeilen.slice(0, koepfe.length > 0 ? koepfe[0].index : zeilen.length)),
    eintraege,
  }
}
