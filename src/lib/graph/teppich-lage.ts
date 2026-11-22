/**
 * @fileoverview Lage-Regel des Teppichs der Dokumente (Plan `teppich-der-dokumente`, T1).
 *
 * @description
 * Reine Funktion ohne Datenbank: Aus Zeit, Nachbarn und Umfang jedes Dokuments
 * wird ein fester Platz. Gespeichert werden ORDNUNGEN, keine Pixel:
 *
 * - `x` (0..1): Rang in der Zeit. Datierte Dokumente liegen in [RAND, 1], gleichmaessig
 *   nach ihrem Rang verteilt (nicht linear in der Zeit, sonst bleiben Luecken zwischen
 *   wenigen alten und vielen neuen Dokumenten). Undatierte liegen im Randstreifen [0, RAND).
 * - `y` (0..1): Ordnung nach Aehnlichkeit. Dokumente mit Nachbarn liegen in [0, 1 - RAND],
 *   aehnliche nah beieinander; Dokumente ohne Nachbarn im Randstreifen (1 - RAND, 1].
 * - `gewicht` (0..1): Umfang auf logarithmischer Skala; `null`, wenn er fehlt.
 *
 * Das Packen in Spalten nach der Fensterbreite macht erst der Browser.
 *
 * Aehnlichkeit: Potenz-Iteration ueber den Nachbar-Graphen (naehert die langsamste
 * Schwingung des Graphen an, wie eine spektrale Ordnung), am Ende in gleichmaessige
 * Raenge umgerechnet. Dicht verbundene Gruppen bekommen so zusammenhaengende Baender.
 * Liegt eine fruehere Lage vor, startet die Rechnung dort und macht nur wenige
 * Schritte — bestehende Plaetze bleiben nah.
 *
 * Kein stiller Rueckfall: Fehlende Zeit, Nachbarn oder Umfang werden gezaehlt.
 *
 * @usedIn src/lib/graph/teppich-persist.ts
 */

/** Breite der Randstreifen fuer Dokumente ohne Datum (links) und ohne Nachbarn (oben). */
export const TEPPICH_RAND = 0.04
/** Schritte ohne fruehere Lage bzw. mit frueherer Lage fuer mindestens die Haelfte. */
export const SCHRITTE_NEU = 80
export const SCHRITTE_FORTSETZUNG = 10

export interface TeppichEingabe {
  fileId: string
  /** Zeitpunkt in ms seit 1970; `null` ohne Datum. */
  zeit: number | null
  nachbarn: Array<{ fileId: string; weight: number }>
  /** Umfang (Abschnitte im Index); `null`, wenn unbekannt. */
  umfang: number | null
  /** Lage des letzten Laufs, falls vorhanden. */
  vorher: { x: number; y: number } | null
}

export interface TeppichLage {
  fileId: string
  x: number
  y: number
  gewicht: number | null
}

export interface TeppichErgebnis {
  lagen: TeppichLage[]
  ohneDatum: number
  ohneNachbarn: number
  ohneUmfang: number
  schritte: number
}

/** Fester Wert 0..1 aus der Kennung (FNV-1a), damit jeder Lauf gleich ausfaellt. */
export function hash01(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

const runde = (v: number): number => Math.round(v * 100000) / 100000

/** Ordnet Werte nach Rang auf (rang + 0,5) / n; gleiche Werte nach Kennung. */
function raenge(ids: string[], werte: Float64Array): Float64Array {
  const ordnung = ids.map((_, i) => i).sort((a, b) => werte[a] - werte[b] || (ids[a] < ids[b] ? -1 : 1))
  const out = new Float64Array(ids.length)
  ordnung.forEach((i, rang) => { out[i] = (rang + 0.5) / ids.length })
  return out
}

function zeitAchse(docs: TeppichEingabe[]): Map<string, number> {
  const datiert = docs.filter((d) => d.zeit !== null)
    .sort((a, b) => (a.zeit as number) - (b.zeit as number) || (a.fileId < b.fileId ? -1 : 1))
  const x = new Map<string, number>()
  datiert.forEach((d, rang) => x.set(d.fileId, TEPPICH_RAND + (1 - TEPPICH_RAND) * (rang + 0.5) / datiert.length))
  for (const d of docs) if (d.zeit === null) x.set(d.fileId, hash01(d.fileId) * TEPPICH_RAND)
  return x
}

function aehnlichkeitsAchse(docs: TeppichEingabe[]): { y: Map<string, number>; schritte: number; ohneNachbarn: number } {
  const index = new Map(docs.map((d, i) => [d.fileId, i]))
  // Ungerichtete Kanten: jede Nachbarschaft zaehlt in beide Richtungen.
  const kanten: Array<Array<[number, number]>> = docs.map(() => [])
  for (const [i, d] of docs.entries()) {
    for (const n of d.nachbarn) {
      const j = index.get(n.fileId)
      const w = Math.max(0, n.weight)
      if (j === undefined || j === i || w === 0) continue
      kanten[i].push([j, w])
      kanten[j].push([i, w])
    }
  }
  const verbunden = docs.map((_, i) => i).filter((i) => kanten[i].length > 0)
  const ids = verbunden.map((i) => docs[i].fileId)
  const pos = new Map(verbunden.map((i, k) => [i, k]))

  const mitVorher = verbunden.filter((i) => docs[i].vorher !== null).length
  const schritte = verbunden.length && mitVorher * 2 >= verbunden.length ? SCHRITTE_FORTSETZUNG : SCHRITTE_NEU
  const grad = new Float64Array(verbunden.map((i) => kanten[i].reduce((s, [, w]) => s + w, 0)))
  const gradSumme = grad.reduce((s, g) => s + g, 0)
  let y: Float64Array = new Float64Array(verbunden.map((i) => {
    const v = docs[i].vorher
    return v && v.y >= 0 && v.y <= 1 ? v.y : hash01(docs[i].fileId)
  }))

  // Potenz-Iteration auf dem Mittel der Nachbarn. Der gleichfoermige Anteil wird nach
  // Grad abgezogen (er ist die triviale Loesung), danach auf Streuung 1 gebracht. Ueber
  // die Schritte bleibt so die langsamste Schwingung des Graphen: Getrennte oder schwach
  // verbundene Gruppen bekommen verschiedene Werte, innerhalb einer Gruppe ordnet sie
  // nach Naehe. Ein kleiner Eigenanteil verhindert Hin-und-her-Springen.
  const glaette = (werte: Float64Array): Float64Array => {
    const neu = new Float64Array(werte.length)
    verbunden.forEach((i, k) => {
      let summe = 0
      for (const [j, w] of kanten[i]) summe += w * werte[pos.get(j) as number]
      neu[k] = 0.2 * werte[k] + 0.8 * (summe / grad[k])
    })
    let mittel = 0
    neu.forEach((v, k) => { mittel += v * grad[k] })
    mittel /= gradSumme
    let streuung = 0
    neu.forEach((v, k) => { neu[k] = v - mittel; streuung += neu[k] * neu[k] })
    const s = Math.sqrt(streuung / neu.length)
    if (s > 0) neu.forEach((v, k) => { neu[k] = v / s })
    return neu
  }
  for (let s = 0; s < schritte; s++) y = glaette(y)
  y = raenge(ids, y)

  const out = new Map<string, number>()
  ids.forEach((id, k) => out.set(id, y[k] * (1 - TEPPICH_RAND)))
  for (const d of docs) if (!out.has(d.fileId)) out.set(d.fileId, 1 - TEPPICH_RAND + hash01(d.fileId) * TEPPICH_RAND)
  return { y: out, schritte: verbunden.length ? schritte : 0, ohneNachbarn: docs.length - verbunden.length }
}

function gewichte(docs: TeppichEingabe[]): Map<string, number | null> {
  const bekannt = docs.filter((d) => d.umfang !== null).map((d) => Math.max(0, d.umfang as number))
  const max = bekannt.length ? Math.max(...bekannt) : 0
  const out = new Map<string, number | null>()
  for (const d of docs) {
    if (d.umfang === null) out.set(d.fileId, null)
    else out.set(d.fileId, max > 0 ? Math.round((Math.log1p(Math.max(0, d.umfang)) / Math.log1p(max)) * 10000) / 10000 : 0)
  }
  return out
}

/** Berechnet die festen Plaetze aller Dokumente (siehe Datei-Kommentar). */
export function berechneTeppichLagen(docs: TeppichEingabe[]): TeppichErgebnis {
  const x = zeitAchse(docs)
  const { y, schritte, ohneNachbarn } = aehnlichkeitsAchse(docs)
  const g = gewichte(docs)
  return {
    lagen: docs.map((d) => ({
      fileId: d.fileId,
      x: runde(x.get(d.fileId) as number),
      y: runde(y.get(d.fileId) as number),
      gewicht: g.get(d.fileId) ?? null,
    })),
    ohneDatum: docs.filter((d) => d.zeit === null).length,
    ohneNachbarn,
    ohneUmfang: docs.filter((d) => d.umfang === null).length,
    schritte,
  }
}
