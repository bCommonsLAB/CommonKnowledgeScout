/**
 * Verifikations-Engine (Welle A1) — scannt alle Dokumente einer Library,
 * sammelt Befunde, repariert optional auto-fixbare Faelle und leitet den
 * Library-Status ab.
 *
 * Als AsyncGenerator gebaut (Vorbild: repair-thumbnails-Service), damit die
 * SSE-Route Fortschritt streamen kann. Der finale Bericht ist der `return`-Wert
 * des Generators. Die Engine ist storage-agnostisch — sie spricht nur den
 * `LibraryDocumentSource`-Port an und ist damit ohne MongoDB unit-testbar.
 */

import type { FacetDef } from '@/lib/chat/dynamic-facets'
import { checkDocument } from './document-check'
import { computeRepairPlan } from './repair'
import type {
  DocumentVerificationResult,
  IssueCountByCode,
  LibraryDocumentSource,
  LibraryVerificationReport,
  LibraryVerificationStatus,
  VerificationMode,
  VerificationProgress,
} from './types'

export interface VerifyLibraryArgs {
  libraryId: string
  mode: VerificationMode
  /** Library-weiter Default-DetailViewType. */
  libraryDetailViewType?: string
  /** Konfigurierte Facetten (inkl. erzwungener Basis-Facetten). */
  facetDefs: FacetDef[]
  /** Dokumentquelle/Repair-Senke. */
  source: LibraryDocumentSource
}

function deriveStatus(documents: DocumentVerificationResult[]): LibraryVerificationStatus {
  // Ein einziger offener Befund (auch nur auto-fixbar) macht die Library
  // reparaturbeduerftig. Sauber == geprueft. „ungeprueft" entsteht nur, wenn
  // gar kein Lauf existiert (vom Repo geliefert), nicht hier.
  return documents.some((d) => !d.ok) ? 'needs-repair' : 'verified'
}

function tallyIssues(documents: DocumentVerificationResult[]): {
  withIssues: number
  totalIssues: number
  autoFixable: number
  issuesByCode: IssueCountByCode
} {
  const issuesByCode: IssueCountByCode = {}
  let withIssues = 0
  let totalIssues = 0
  let autoFixable = 0
  for (const doc of documents) {
    if (doc.issues.length > 0) withIssues += 1
    for (const issue of doc.issues) {
      totalIssues += 1
      if (issue.autoFixable) autoFixable += 1
      issuesByCode[issue.code] = (issuesByCode[issue.code] ?? 0) + 1
    }
  }
  return { withIssues, totalIssues, autoFixable, issuesByCode }
}

/**
 * Fuehrt den Verifikations-(und optional Repair-)Lauf aus.
 * Yields Fortschritt; `return`-Wert ist der vollstaendige Bericht.
 */
export async function* runLibraryVerification(
  args: VerifyLibraryArgs
): AsyncGenerator<VerificationProgress, LibraryVerificationReport> {
  const { libraryId, mode, libraryDetailViewType, facetDefs, source } = args
  const docs = await source.listDocuments()
  const total = docs.length

  yield { phase: 'start', current: 0, total }

  const results: DocumentVerificationResult[] = []
  let repairedDocuments = 0

  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i]
    let result = checkDocument(doc, { libraryDetailViewType, facetDefs })
    let repaired = false

    if (mode === 'repair' && result.issues.some((issue) => issue.autoFixable)) {
      const plan = computeRepairPlan(doc, result, facetDefs)
      if (Object.keys(plan.patch).length > 0) {
        await source.applyRepair(doc.fileId, plan.patch)
        repaired = true
        repairedDocuments += 1
        // Erneut pruefen mit gepatchten Werten → Bericht zeigt den Ist-Zustand.
        const patchedDoc = {
          ...doc,
          docMetaJson: { ...doc.docMetaJson, ...plan.patch },
        }
        result = checkDocument(patchedDoc, { libraryDetailViewType, facetDefs })
      }
    }

    results.push(result)
    yield {
      phase: 'document',
      current: i + 1,
      total,
      fileId: doc.fileId,
      issueCount: result.issues.length,
      repaired,
    }
  }

  const tally = tallyIssues(results)
  const report: LibraryVerificationReport = {
    libraryId,
    status: deriveStatus(results),
    mode,
    summary: {
      scanned: total,
      ok: results.filter((r) => r.ok).length,
      withIssues: tally.withIssues,
      totalIssues: tally.totalIssues,
      autoFixable: tally.autoFixable,
      repairedDocuments,
      issuesByCode: tally.issuesByCode,
    },
    // Saubere Dokumente weglassen — der Bericht zeigt nur, was Aufmerksamkeit braucht.
    documents: results.filter((r) => !r.ok),
    generatedAt: new Date().toISOString(),
  }

  yield { phase: 'done', current: total, total }
  return report
}
