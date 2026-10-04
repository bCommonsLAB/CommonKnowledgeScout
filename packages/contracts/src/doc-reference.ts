/**
 * @fileoverview Referenzen — welches Dokument wurde zitiert, und warum
 *
 * @description
 * Zwei kleine Formen, die Galerie und Chat gemeinsam brauchen: Der Chat
 * erzeugt sie beim Antworten, die Galerie zeigt an, welche Dokumente eine
 * Antwort belegt haben.
 *
 * **Warum hier**: Sie lagen als Feld INNERHALB von `ChatResponse` und
 * `QueryLog`. Die Galerie griff deshalb ueberall durch einen Chat-Typ
 * hindurch — `ChatResponse['references']` an zehn Stellen,
 * `QueryLog['sources']` an sieben. Das sah nach einer Abhaengigkeit der
 * Galerie vom Chat aus, war aber nur ein geteilter Begriff ohne Zuhause
 * (Audit `01-audit-galerie-chat.md`, Befunde 1 und 2).
 *
 * Was hier NICHT liegt: die Chat-Antwort selbst (`answer`,
 * `suggestedQuestions`) und die Retrieval-Diagnostik (Zeitmessungen,
 * Cache-Hashes, Prompt-Infos). Davon braucht die Galerie nichts.
 *
 * @module contracts/doc-reference
 */

/**
 * Eine zitierte Textstelle eines Dokuments (D7, Plan
 * `story-dreiteilung-fragenchronik`). `page` gibt es nur fuer Quellen mit
 * Seitenankern (PDF-Transkripte); Audio, Video, Markdown haben keine —
 * kein Ersatzwert.
 */
export interface DocPassage {
  chunkIndex?: number
  page?: number
  /** Die ersten ~160 Zeichen der Textstelle, serverseitig mitgeliefert. */
  excerpt: string
}

/**
 * Ein zitiertes Dokument, wie es unter einer Antwort erscheint.
 *
 * `number` ist die Zitatmarke im Antworttext (`[1]`, `[2]`, …). Seit D7 wird
 * je DOKUMENT nummeriert, die Textstellen haengen als `passages` darunter.
 * Aeltere Antworten (ohne `passages`) tragen eine Nummer je Textstelle —
 * die Oberflaeche gruppiert sie weiterhin nach `fileId`.
 */
export interface DocReference {
  number: number
  fileId: string
  fileName?: string
  /** D12k: Titel des Dokuments, serverseitig aus dem Meta-Dokument angereichert; fehlt bei aelteren Antworten. */
  title?: string
  description: string
  /** Inhaltstyp des referenzierten Dokuments (A4: formatgerechte Story-Verweise). */
  detailViewType?: string
  /** D7: die zitierten Textstellen dieses Dokuments; fehlt bei alten Antworten. */
  passages?: DocPassage[]
}

/**
 * Ein Treffer aus dem Retrieval, wie er im Abfrage-Protokoll mitgeschrieben
 * wird — die schnelle Sicht darauf, was gefunden wurde.
 */
export interface QuerySource {
  id: string
  fileName?: string
  chunkIndex?: number
  score?: number
}
