/**
 * @fileoverview Teppich der Dokumente: Punkte auf eine Flaeche packen (Plan
 * `teppich-der-dokumente`, T2).
 *
 * @description
 * Reine Funktionen ohne React und ohne Browser. Der Server speichert je Dokument nur
 * Ordnungen (`x` = Rang in der Zeit, `y` = Ordnung nach Aehnlichkeit, beide 0..1,
 * Route `GET /api/chat/<id>/teppich`). Hier entsteht daraus ein Raster fuer eine
 * bestimmte Flaeche: Spalten nach der Zeit, gleich voll; jede Spalte von oben nach
 * unten nach Aehnlichkeit, mittig gestapelt. Dazu die Jahreszahlen unter den
 * Spalten, an denen ein neues Jahr beginnt.
 */

/** Ein Punkt, wie ihn die Lese-Route liefert. */
export interface TeppichPunkt {
  fileId: string
  x: number
  y: number
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
}

export interface TeppichRaster {
  /** Lage je Punkt, gleiche Reihenfolge wie die Eingabe. */
  px: Float32Array
  py: Float32Array
  /** Abstand zweier Nachbarn im Raster (Pixel). */
  zelle: number
  spalten: number
  jahrMarken: Array<{ jahr: number; x: number }>
}

/** Mindestabstand zweier Jahreszahlen in Pixeln. */
const JAHR_ABSTAND = 44

/** Packt die Punkte auf die Flaeche (siehe Datei-Kommentar). Leere Eingabe ergibt ein leeres Raster. */
export function packeTeppich(punkte: readonly TeppichPunkt[], flaeche: TeppichFlaeche): TeppichRaster {
  const n = punkte.length
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const w = Math.max(1, flaeche.breite - 2 * flaeche.rand)
  const h = Math.max(1, flaeche.hoehe - 2 * flaeche.rand)
  if (n === 0) return { px, py, zelle: 0, spalten: 0, jahrMarken: [] }

  // Spaltenzahl so, dass die Zellen etwa quadratisch werden; mindestens eine.
  const spalten = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * w) / h))))
  const proSpalte = Math.ceil(n / spalten)
  const zelle = Math.min(w / spalten, h / proSpalte)
  const breiteRaster = spalten * (w / spalten)
  const links = flaeche.rand + (w - breiteRaster) / 2
  const mitte = flaeche.rand + h / 2

  const nachZeit = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => punkte[a].x - punkte[b].x || (punkte[a].fileId < punkte[b].fileId ? -1 : 1))
  const jahrMarken: Array<{ jahr: number; x: number }> = []
  let letztesJahr: number | null = null
  for (let s = 0; s < spalten; s++) {
    const spalte = nachZeit.slice(s * proSpalte, (s + 1) * proSpalte)
    if (spalte.length === 0) continue
    spalte.sort((a, b) => punkte[a].y - punkte[b].y || (punkte[a].fileId < punkte[b].fileId ? -1 : 1))
    const x = links + (s + 0.5) * (w / spalten)
    spalte.forEach((i, r) => {
      px[i] = x
      py[i] = mitte + (r - (spalte.length - 1) / 2) * zelle
    })
    const jahre = spalte.map((i) => punkte[i].jahr).filter((j): j is number => j !== null)
    const jahr = jahre.length ? Math.min(...jahre) : null
    if (jahr !== null && (letztesJahr === null || jahr > letztesJahr)) {
      const vorige = jahrMarken[jahrMarken.length - 1]
      if (!vorige || x - vorige.x >= JAHR_ABSTAND) jahrMarken.push({ jahr, x })
      letztesJahr = jahr
    }
  }
  return { px, py, zelle, spalten, jahrMarken }
}

/**
 * Radius eines Punkts: aus der Zelle und dem Gewicht; ohne Gewicht der kleinste.
 * Nach oben eng begrenzt (Ansicht 22.11.2026 an 220 Dokumenten): Bei wenigen Dokumenten
 * ist die Zelle gross, die Punkte sollen trotzdem Minikreise bleiben, keine Knoepfe.
 */
export function teppichRadius(zelle: number, gewicht: number | null): number {
  const basis = Math.min(2.2, Math.max(0.8, zelle * 0.2))
  return basis * (0.8 + 1.4 * (gewicht ?? 0))
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
