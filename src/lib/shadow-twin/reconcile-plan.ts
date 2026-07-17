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

  if (!sel.best) return base

  const winner = sel.best.ref
  const winnerContent = normalize(winner.markdown)
  const winnerPages = countDistinctPages(winnerContent)

  // Konflikt: nichts an den Transkripten anfassen (nur tote page_NNN.md duerfen weg).
  if (sel.conflict) {
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

  const transcriptDeletions: ReconcileDeletion[] = transcriptCandidates
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
