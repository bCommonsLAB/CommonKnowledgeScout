/**
 * @fileoverview Geteilte Auswahl-Logik: vollstaendigste Artefakt-Variante gewinnt.
 *
 * @description
 * Ersetzt die bisherige Heuristik „suffixlos bevorzugt / neuester gewinnt"
 * (pickBestTranscript / reconstructFromFolder / sync-from-storage), die bei
 * `_Ökoniomie_en_Innen.pdf` eine kaputte Einzelseite als Transkript gewaehlt
 * und ueber einen Lese-getriggerten Import nach Mongo geschrieben hat
 * (siehe docs/refactor/shadow-twin-deterministic/).
 *
 * Regel: **vollstaendigster gewinnt** = max( Seiten-Marker-Anzahl, dann Markdown-Laenge ).
 * NICHT nach Datei-Suffix, NICHT nach Datum. Vergleich ueber Storage- UND Mongo-Varianten.
 *
 * Sicherheit: nur strikt unterlegene ODER inhaltsgleiche (redundante) Varianten sind
 * loeschbar. Zwei gleich-vollstaendige, aber inhaltlich UNTERSCHIEDLICHE Varianten →
 * Konflikt: kein Gewinner, nichts loeschbar (Caller meldet + ueberspringt).
 *
 * Reine Funktion, kein I/O. Caller (Reconcile) orchestriert das Schreiben des
 * Gewinner-Inhalts in die kanonische `{base}.md` + Mongo und das Loeschen.
 *
 * @module shadow-twin
 */

/**
 * Vergleichsproxy fuer Vollstaendigkeit: Anzahl Seiten-Marker im Markdown.
 * Zaehlt Bild-Seiten-Refs (`page_020.jpeg`) und Textmarker („Seite: 20",
 * „--- Seite 20 ---"). Heuristik — als Score, nicht als exakte Seitenzahl.
 */
export function countPageMarkers(markdown: string): number {
  if (!markdown) return 0
  const matches = markdown.match(/page_\d+|(?:^|\n)\s*-{0,3}\s*seite\s*[:\-]?\s*\d+/gi)
  return matches ? matches.length : 0
}

export interface ArtifactVariant<TRef> {
  /** Opaque Referenz (StorageItem, Mongo-Record, …) — nur der Caller interpretiert sie. */
  ref: TRef
  /** Markdown-Inhalt der Variante. */
  markdown: string
  /** Herkunft — nur fuer Report/Logging. */
  origin: 'storage' | 'mongo'
  /** Dateiname (optional) — Tie-Break Richtung kanonischem `{base}.md`. */
  name?: string
}

export interface SelectBestResult<TRef> {
  /**
   * Gewinner (vollstaendigste Variante). Immer deterministisch gefuellt, sobald es
   * eine nicht-leere Variante gibt — auch bei Konflikt (fuer Lese-Pfade). Nur null,
   * wenn keine nicht-leere Variante existiert.
   */
  best: ArtifactVariant<TRef> | null
  /** true, wenn zwei gleich-vollstaendige Varianten unterschiedlichen Inhalt haben. */
  conflict: boolean
  /**
   * Loeschbar: strikt unterlegen ODER inhaltsgleich (redundant) zum Gewinner.
   * **Leer bei Konflikt** (Reconcile meldet + ueberspringt, loescht nichts).
   */
  deletable: ArtifactVariant<TRef>[]
}

interface Scored<TRef> {
  variant: ArtifactVariant<TRef>
  content: string
  pages: number
  length: number
}

/** Normalisiert Inhalt fuer Gleichheits-Vergleich (CRLF + Rand-Whitespace). */
function normalize(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').trim()
}

/** Strikt vollstaendiger: erst Seiten-Marker, dann Laenge. */
function isHigher(a: Scored<unknown>, b: Scored<unknown>): boolean {
  if (a.pages !== b.pages) return a.pages > b.pages
  return a.length > b.length
}

function sameScore(a: Scored<unknown>, b: Scored<unknown>): boolean {
  return a.pages === b.pages && a.length === b.length
}

/**
 * Waehlt die vollstaendigste Variante einer Quelle. Reine Funktion.
 *
 * @param variants Alle Kandidaten (Storage-Dateien + Mongo-Record).
 * @param canonicalName Bevorzugter Name bei Gleichstand identischen Inhalts (z.B. `{base}.md`).
 */
export function selectBestArtifactVariant<TRef>(
  variants: ReadonlyArray<ArtifactVariant<TRef>>,
  canonicalName?: string,
): SelectBestResult<TRef> {
  const scored: Scored<TRef>[] = variants.map((variant) => {
    const content = normalize(variant.markdown)
    return { variant, content, pages: countPageMarkers(content), length: content.length }
  })

  const nonEmpty = scored.filter((s) => s.length > 0)
  if (nonEmpty.length === 0) return { best: null, conflict: false, deletable: [] }

  // Hoechsten Score bestimmen (nur unter nicht-leeren Varianten).
  let top = nonEmpty[0]
  for (const s of nonEmpty) if (isHigher(s, top)) top = s

  // Alle mit Top-Score; Konflikt, wenn diese unterschiedlichen Inhalt haben.
  const leaders = nonEmpty.filter((s) => sameScore(s, top))
  const conflict = new Set(leaders.map((s) => s.content)).size > 1

  // Deterministischer Gewinner: kanonischer Name, sonst lexikographisch kleinster Name.
  // Auch bei Konflikt gefuellt, damit Lese-Pfade immer ein stabiles Ergebnis bekommen.
  const winner =
    (canonicalName && leaders.find((s) => s.variant.name === canonicalName)) ||
    [...leaders].sort((a, b) => (a.variant.name || '').localeCompare(b.variant.name || ''))[0]

  // Bei Konflikt nichts loeschen. Sonst: jede andere Variante, die inhaltsgleich
  // (redundant) ODER strikt unterlegen ist (kann hier nicht gleich-Score-anderer-Inhalt sein).
  const deletable = conflict
    ? []
    : scored
        .filter((s) => s.variant !== winner.variant)
        .filter((s) => s.content === winner.content || isHigher(winner, s))
        .map((s) => s.variant)

  return { best: winner.variant, conflict, deletable }
}
