/**
 * @fileoverview Reine Planungs-Logik fuer die Library-Reconcile (Transkript).
 *
 * @description
 * Entscheidet pro Quelle deterministisch, OHNE I/O:
 * - welche Transkript-Variante kanonisch wird (vollstaendigster gewinnt),
 * - ob die kanonische `{base}.md` (Storage) und/oder Mongo geschrieben werden muessen,
 * - welche Storage-Dateien geloescht werden duerfen (nur strikt unterlegen/redundant,
 *   Name ≠ canonical) + tote `page_NNN.md`,
 * - ob ein Konflikt vorliegt (gleich vollstaendig, anderer Inhalt → nichts anfassen)
 *   oder eine Neu-Extraktion noetig ist (alle Varianten 1 Seite trotz mehr Seiten).
 *
 * Die eigentliche Auswahl macht {@link selectBestArtifactVariant}; hier nur die
 * Reconcile-Entscheidungen drumherum. Reine Funktion → unit-testbar.
 *
 * @module shadow-twin
 */

import { selectBestArtifactVariant, countDistinctPages } from './select-best-artifact-variant'

/** Kandidat fuer die Reconcile-Auswahl. `fileId` nur bei Storage-Herkunft. */
export interface ReconcileCandidate {
  /** Storage-Datei-Id (undefined bei Mongo-Record). */
  fileId?: string
  /** Dateiname (bei Mongo: der kanonische Name). */
  name: string
  /** Markdown-Inhalt. */
  markdown: string
  /** Herkunft. */
  origin: 'storage' | 'mongo'
  /**
   * Zeitpunkt der letzten Aenderung (Storage: Datei-mtime, Mongo: updatedAt).
   * Basis fuer den Handkorrektur-Vorrang (Welle 0d); undefined/null = unbekannt,
   * dann greift ausschliesslich die Score-Logik.
   */
  modifiedAt?: Date | null
}

/** Eine zu loeschende Storage-Datei mit Begruendung. */
export interface ReconcileDeletion {
  fileId: string
  name: string
  reason: 'inferior-or-redundant' | 'dead-page-md'
}

export type ReconcileStatus = 'ok' | 'conflict' | 'needs-reextract' | 'empty'

export interface SourceReconcilePlan {
  status: ReconcileStatus
  canonicalName: string
  /** Gewinner-Inhalt (zum Schreiben), null bei empty. */
  winnerMarkdown: string | null
  winnerOrigin: 'storage' | 'mongo' | null
  winnerName: string | null
  winnerPages: number
  /** Kanonische `{base}.md` (Storage) muss mit Gewinner-Inhalt (ueber)schrieben werden. */
  canonicalNeedsWrite: boolean
  /** Mongo-`artifacts.transcript` muss aktualisiert werden. */
  mongoNeedsUpdate: boolean
  /** Loeschbare Storage-Dateien (nur bei status 'ok' Transkripte; dead-page-md immer). */
  deletions: ReconcileDeletion[]
}

function normalize(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').trim()
}

/**
 * Handkorrektur-Vorrang (Welle 0d).
 *
 * `selectBestArtifactVariant` waehlt nach Score (Seiten, dann Laenge). Das
 * erkennt Migrations-Verluste (abgeschnittene Transkripte), aber KEINE
 * inhaltlichen Korrekturen: Wer im Spiegel „Superbase" zu „Supabase"
 * verbessert, macht den Text nicht laenger — die Mongo-Fassung gewinnt, und
 * der naechste Lauf schreibt die Korrektur zurueck. Genau diesen Rueckweg
 * verspricht der Twin-Datei-Contract §4.5 aber.
 *
 * Regel: Eine Storage-Variante, die NACH dem Mongo-Stand geaendert wurde,
 * inhaltlich abweicht und dabei KEINE Seite verliert, ist der Gewinner.
 * Die Seiten-Bedingung schuetzt den Migrationsfall: Eine abgeschnittene
 * Datei bekommt nie Vorrang, nur weil sie neuer ist.
 *
 * Ohne Zeitstempel (aeltere Aufrufer, Mongo-Record ohne `updatedAt`) greift
 * die Regel nicht — dann bleibt es bei der Score-Logik.
 */
function pickHandEditedWinner(candidates: ReconcileCandidate[]): ReconcileCandidate | null {
  const mongo = candidates.find((c) => c.origin === 'mongo')
  const mongoTime = mongo?.modifiedAt ? mongo.modifiedAt.getTime() : null
  if (!mongo || mongoTime === null) return null

  const mongoContent = normalize(mongo.markdown)
  const mongoPages = countDistinctPages(mongoContent)

  let winner: ReconcileCandidate | null = null
  let winnerTime = mongoTime
  for (const candidate of candidates) {
    if (candidate.origin !== 'storage' || !candidate.modifiedAt) continue
    const time = candidate.modifiedAt.getTime()
    if (time <= winnerTime) continue
    const content = normalize(candidate.markdown)
    if (!content || content === mongoContent) continue
    if (countDistinctPages(content) < mongoPages) continue
    winner = candidate
    winnerTime = time
  }
  return winner
}

/**
 * Baut den Reconcile-Plan fuer das Transkript EINER Quelle.
 *
 * @param canonicalName Kanonischer Dateiname (`{base}.md`).
 * @param transcriptCandidates Storage-Varianten + (optional) Mongo-Record.
 * @param deadPageMd Tote `page_NNN.md`-Dateien im Shadow-Twin-Ordner (immer loeschbar).
 * @param expectedPages Erwartete Seitenzahl (z.B. aus Transformation-Frontmatter), optional.
 */
export function buildTranscriptReconcilePlan(args: {
  canonicalName: string
  transcriptCandidates: ReconcileCandidate[]
  deadPageMd?: Array<{ fileId: string; name: string }>
  expectedPages?: number
}): SourceReconcilePlan {
  const { canonicalName, transcriptCandidates, deadPageMd = [], expectedPages } = args

  const deadDeletions: ReconcileDeletion[] = deadPageMd.map((f) => ({
    fileId: f.fileId,
    name: f.name,
    reason: 'dead-page-md',
  }))

  const base: SourceReconcilePlan = {
    status: 'empty',
    canonicalName,
    winnerMarkdown: null,
    winnerOrigin: null,
    winnerName: null,
    winnerPages: 0,
    canonicalNeedsWrite: false,
    mongoNeedsUpdate: false,
    deletions: deadDeletions,
  }

  const sel = selectBestArtifactVariant(
    transcriptCandidates.map((c) => ({ ref: c, markdown: c.markdown, origin: c.origin, name: c.name })),
    canonicalName,
  )

  // Handkorrektur im Spiegel schlaegt den Score (siehe pickHandEditedWinner).
  const handEdited = pickHandEditedWinner(transcriptCandidates)
  if (!handEdited && !sel.best) return base

  const winner = handEdited ?? (sel.best as { ref: ReconcileCandidate }).ref
  const winnerContent = normalize(winner.markdown)
  const winnerPages = countDistinctPages(winnerContent)

  // Konflikt: nichts an den Transkripten anfassen (nur tote page_NNN.md duerfen weg).
  // Bei einer Handkorrektur ist die Lage eindeutig — die juengere Fassung gilt.
  if (sel.conflict && !handEdited) {
    return { ...base, status: 'conflict', winnerOrigin: winner.origin, winnerName: winner.name, winnerPages }
  }

  // Neu-Extraktion noetig: bester Fund ist trotzdem 1 Seite, obwohl mehr erwartet.
  // Konservativ: melden, NICHT loeschen (Varianten fuer manuelle Pruefung behalten).
  if (expectedPages !== undefined && expectedPages > 1 && winnerPages <= 1) {
    return {
      ...base,
      status: 'needs-reextract',
      winnerMarkdown: winnerContent,
      winnerOrigin: winner.origin,
      winnerName: winner.name,
      winnerPages,
    }
  }

  // OK: Gewinner ist gueltig. Kanonische {base}.md sicherstellen, Mongo angleichen,
  // alle anderen Storage-Transkripte (Name ≠ canonical) loeschen (inferior/redundant).
  const canonicalStorage = transcriptCandidates.find((c) => c.origin === 'storage' && c.name === canonicalName)
  const canonicalNeedsWrite = !canonicalStorage || normalize(canonicalStorage.markdown) !== winnerContent

  const mongoCandidate = transcriptCandidates.find((c) => c.origin === 'mongo')
  const mongoNeedsUpdate = !mongoCandidate || normalize(mongoCandidate.markdown) !== winnerContent

  // Bei Handkorrektur-Vorrang konservativ NICHTS loeschen: Der Score-Gewinner
  // war ein anderer, also ist die Unterlegenheits-Aussage hier nicht gedeckt.
  const transcriptDeletions: ReconcileDeletion[] = handEdited
    ? []
    : transcriptCandidates
        .filter((c) => c.origin === 'storage' && !!c.fileId && c.name !== canonicalName)
        .map((c) => ({ fileId: c.fileId as string, name: c.name, reason: 'inferior-or-redundant' as const }))

  return {
    status: 'ok',
    canonicalName,
    winnerMarkdown: winnerContent,
    winnerOrigin: winner.origin,
    winnerName: winner.name,
    winnerPages,
    canonicalNeedsWrite,
    mongoNeedsUpdate,
    deletions: [...transcriptDeletions, ...deadDeletions],
  }
}
