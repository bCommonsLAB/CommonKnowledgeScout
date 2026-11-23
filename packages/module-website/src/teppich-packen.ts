/**
 * @fileoverview Teppich der Dokumente: Punkte auf eine Flaeche legen (Plan
 * `teppich-der-dokumente`, T2/T5b).
 *
 * @description
 * Reine Funktionen ohne React und ohne Browser. Seit T5b (Owner 23.11.2026, E7) liegen die
 * Punkte in der Wolke: Der Server rechnet sie einmal mit der Physik der Graph-Ansicht und
 * liefert je Dokument `wx`, `wy` (0..1, Seitenverhaeltnis erhalten) und die staerksten
 * Nachbarn (Route `GET /api/chat/<id>/teppich`). Hier wird die Wolke in den Kasten eingepasst:
 * gleicher Massstab auf beiden Achsen, mittig. Das fruehere Raster (Zeit nach rechts) und die
 * Jahreszahlen entfallen (E8).
 */

/** Ein Punkt, wie ihn die Lese-Route liefert. */
export interface TeppichPunkt {
  fileId: string
  /** Fruehere Ordnung (Raster); die Seite nutzt sie seit T5b nicht mehr. */
  x: number
  y: number
  /** Platz in der Wolke (T5a); `null`, solange der Lauf sie nicht gerechnet hat. */
  wx: number | null
  wy: number | null
  /** Staerkste Nachbarn als Indizes in `items`, staerkster zuerst. */
  nachbarn: number[]
  gewicht: number | null
  jahr: number | null
  titel: string
}

export type TeppichZustand = 'bereit' | 'veraltet' | 'nicht_berechnet'

/** Antwort der Lese-Route `GET /api/chat/<id>/teppich`. */
export interface TeppichAntwort {
  zustand: TeppichZustand
  stand: string | null
  gesamt: number
  ohneLage: number
  items: TeppichPunkt[]
}

export interface TeppichFlaeche {
  breite: number
  hoehe: number
  /** Abstand zum Rand der Flaeche in Pixeln. */
  rand: number
  /**
   * Verschiebung nach rechts (Pixel): Die Leinwand ist breiter als der Kasten,
   * damit der Schwarm ueber dessen Rand hinaus fliegen kann (Owner 23.11.2026).
   */
  versatz?: number
}

export interface TeppichPlaetze {
  /** Platz je Punkt in Pixeln der Leinwand, gleiche Reihenfolge wie die Eingabe. */
  px: Float32Array
  py: Float32Array
  /** Mittlerer Abstand zweier Punkte (Pixel); bestimmt Radius und Trefferweite. */
  zelle: number
}

/** Hat jeder Punkt einen Platz in der Wolke? Sonst ist der Lauf `teppich_berechnen` faellig. */
export function hatWolke(punkte: readonly TeppichPunkt[]): boolean {
  return punkte.length > 0 && punkte.every((p) => p.wx !== null && p.wy !== null)
}

/**
 * Passt die Wolke in die Flaeche: ein Massstab fuer beide Achsen, mittig. Ein Punkt ohne Platz in
 * der Wolke ist ein Fehler (vorher `hatWolke` pruefen), kein stiller Rueckfall.
 */
export function packeWolke(punkte: readonly TeppichPunkt[], flaeche: TeppichFlaeche): TeppichPlaetze {
  const n = punkte.length
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  if (n === 0) return { px, py, zelle: 0 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of punkte) {
    if (p.wx === null || p.wy === null) throw new Error(`Teppich: ${p.fileId} hat keinen Platz in der Wolke — teppich_berechnen ausfuehren`)
    minX = Math.min(minX, p.wx); maxX = Math.max(maxX, p.wx)
    minY = Math.min(minY, p.wy); maxY = Math.max(maxY, p.wy)
  }
  const w = Math.max(1, flaeche.breite - 2 * flaeche.rand)
  const h = Math.max(1, flaeche.hoehe - 2 * flaeche.rand)
  const sx = maxX - minX || 1
  const sy = maxY - minY || 1
  const mass = Math.min(w / sx, h / sy)
  const mx = (flaeche.versatz ?? 0) + flaeche.breite / 2
  const my = flaeche.hoehe / 2
  punkte.forEach((p, i) => {
    px[i] = mx + ((p.wx as number) - (minX + maxX) / 2) * mass
    py[i] = my + ((p.wy as number) - (minY + maxY) / 2) * mass
  })
  return { px, py, zelle: Math.sqrt((sx * mass * sy * mass) / n) }
}

/**
 * Radius eines Punkts: aus der Zelle und dem Gewicht; ohne Gewicht der kleinste.
 * Owner 22.11.2026: eher gross und dafuer blass (die Blaesse kommt von der Leinwand) — die
 * Punkte duerfen die Zelle gut zur Haelfte fuellen, hoechstens 6 px Grundmass.
 */
export function teppichRadius(zelle: number, gewicht: number | null): number {
  const basis = Math.min(6, Math.max(1, zelle * 0.24))
  return basis * (0.8 + 1.2 * (gewicht ?? 0))
}

/** Platz ueber dem Kasten (die Frage) und darunter (die Botschaft), in Pixeln. */
export const TEPPICH_OBEN = 96
export const TEPPICH_UNTEN = 64
/** Breite der Antwort (`max-w-5xl`) samt Rand der Sektion (`px-6`). */
const ANTWORT_BREITE = 1024
const SEKTION_RAND = 24

export interface TeppichKasten {
  /** Breite und Hoehe der Flaeche, auf der das Raster liegt. */
  breite: number
  hoehe: number
  /** Abstand vom linken Rand der Leinwand. */
  links: number
}

/**
 * Kasten des Teppichs (Owner 23.11.2026): so breit wie die Antwort und so hoch wie der sichtbare
 * Bereich abzueglich Frage und Botschaft — alles zusammen bleibt ganz im Bild. `breite` ist die
 * Breite der Sektion, `sicht` die sichtbare Hoehe, `sektion` die Hoehe der Sektion.
 */
export function teppichKasten(breite: number, sicht: number, sektion: number): TeppichKasten {
  const kb = Math.floor(Math.max(0, Math.min(ANTWORT_BREITE, breite - 2 * SEKTION_RAND)))
  const hoehe = Math.floor(Math.max(0, Math.min(sicht, sektion) - TEPPICH_OBEN - TEPPICH_UNTEN))
  return { breite: kb, hoehe, links: Math.floor((breite - kb) / 2) }
}

/** Index des naechsten Punkts innerhalb von `maxAbstand`, sonst -1. */
export function naechsterTeppichPunkt(px: Float32Array, py: Float32Array, x: number, y: number, maxAbstand: number): number {
  let best = -1
  let bestD = maxAbstand * maxAbstand
  for (let i = 0; i < px.length; i++) {
    const dx = px[i] - x
    const dy = py[i] - y
    const d = dx * dx + dy * dy
    if (d <= bestD) { bestD = d; best = i }
  }
  return best
}
