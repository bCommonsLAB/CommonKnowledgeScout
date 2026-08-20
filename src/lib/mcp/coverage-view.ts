/**
 * @fileoverview Kompakte Coverage-Sicht fuer MCP-Agenten (Welle 5).
 *
 * @description
 * Agenten brauchen Zaehler + die relevanten Befunde, nicht 5.000
 * Gap-Objekte. Diese reine Schicht filtert den gespeicherten Report optional
 * auf einen Pfad und kappt die Listen an einem expliziten Budget — jede
 * Kappung wird AUSGEWIESEN, nie still (`no-silent-fallbacks.mdc`).
 * Es wird nichts neu berechnet (Leitprinzip 2: der Report ist die Sicht).
 *
 * @module mcp
 */

import type { CoverageGap, CoverageReport, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'

/** Standard-Budgets der Werkzeug-Ausgabe (per Argument erhoehbar). */
export const DEFAULT_MAX_GAPS = 100
export const DEFAULT_MAX_FAMILIES = 100
export const DEFAULT_MAX_FOLDERS = 200

export interface CoverageViewArgs {
  report: CoverageReport
  generatedAt: string
  /** true, wenn schon der GESPEICHERTE Report gekappt war. */
  storedGapsTruncated: boolean
  totalGaps: number
  /** Library-relativer Pfad-Filter (Ordner); null/'' = ganze Library. */
  pathPrefix?: string | null
  maxGaps?: number
  maxFamilies?: number
  maxFolders?: number
}

function normalizePrefix(pathPrefix: string | null | undefined): string {
  return (pathPrefix ?? '').replace(/^\/+|\/+$/g, '').trim()
}

/** Liegt `path` im Teilbaum von `prefix`? Leerer Prefix matcht alles. */
export function isInSubtree(path: string, prefix: string): boolean {
  if (prefix === '') return true
  return path === prefix || path.startsWith(`${prefix}/`)
}

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

/**
 * Ordner des Teilbaums (Pfad + folderId + Prioritaets-Zahlen) — damit kann
 * der Agent `abdeckung_scannen`/`twins_pruefen` gezielt auf einen Teilbaum
 * begrenzen, statt die ganze Library zu laufen (OneDrive: ein API-Call pro
 * Ordner). Reihenfolge: die meisten Befunde zuerst.
 */
function collectFolders(nodes: readonly CoverageTreeNode[], prefix: string): Array<{
  path: string
  folderId: string
  quellen: number
  befundeImTeilbaum: number
}> {
  const result: Array<{ path: string; folderId: string; quellen: number; befundeImTeilbaum: number }> = []
  const walk = (node: CoverageTreeNode) => {
    if (isInSubtree(node.path, prefix) || (prefix !== '' && isInSubtree(prefix, node.path))) {
      result.push({
        path: node.path || '(Wurzel)',
        folderId: node.folderId,
        quellen: node.sourceCount,
        befundeImTeilbaum: node.totalGaps,
      })
    }
    for (const child of node.children) walk(child)
  }
  for (const node of nodes) walk(node)
  return result.sort((a, b) => b.befundeImTeilbaum - a.befundeImTeilbaum)
}

function compactGap(gap: CoverageGap) {
  return {
    type: gap.type,
    actor: gap.actor,
    zyklusSchritt: gap.zyklusSchritt,
    severity: gap.severity,
    path: gap.path,
    targetName: gap.targetName,
    message: gap.message,
    ...(gap.detail ? { detail: gap.detail } : {}),
  }
}

function compactFamily(family: TwinFamilySummary) {
  return {
    path: family.path,
    sourceName: family.sourceName,
    sourceId: family.sourceId,
    artifactCount: family.artifactCount,
    leading: family.leading
      ? {
          kind: family.leading.kind,
          templateName: family.leading.templateName,
          targetLanguage: family.leading.targetLanguage,
          twinStatus: family.leading.twinStatus,
          verification: family.leading.verification,
          verifiedBy: family.leading.verifiedBy,
        }
      : null,
  }
}

/**
 * Baut die kompakte Agenten-Sicht auf den juengsten Report. Reine Funktion —
 * die Werkzeug-Schicht liefert die Eingaben aus dem Report-Cache.
 */
export function summarizeCoverageReport(args: CoverageViewArgs) {
  const prefix = normalizePrefix(args.pathPrefix)
  const maxGaps = args.maxGaps ?? DEFAULT_MAX_GAPS
  const maxFamilies = args.maxFamilies ?? DEFAULT_MAX_FAMILIES
  const maxFolders = args.maxFolders ?? DEFAULT_MAX_FOLDERS
  const folders = collectFolders(args.report.tree, prefix)

  const gapsInScope = prefix === ''
    ? args.report.gaps
    : args.report.gaps.filter((gap) => isInSubtree(gap.path, prefix))
  const familiesAll = args.report.families
  const familiesInScope = familiesAll === undefined
    ? undefined
    : prefix === ''
      ? familiesAll
      : familiesAll.filter((family) => isInSubtree(family.path, prefix))

  return {
    libraryId: args.report.libraryId,
    generatedAt: args.generatedAt,
    scope: args.report.scope,
    hinweis:
      'Report ist ABGELEITET (berechnet, nicht Wahrheit); Zeitpunkt beachten und bei Bedarf abdeckung_scannen ausfuehren.',
    conventions: args.report.conventions,
    totalsLibraryWeit: args.report.totals,
    gespeicherterReportGekappt: args.storedGapsTruncated
      ? { gespeicherteGaps: args.report.gaps.length, totalGaps: args.totalGaps }
      : null,
    filter: {
      pfad: prefix === '' ? null : prefix,
      /** folderId hier fuer Teilbaum-Scans/-Checks verwenden (statt ganzer Library). */
      ordner: folders.slice(0, maxFolders),
      ordnerAnzahl: folders.length,
      ordnerGekappt: folders.length > maxFolders,
      befundAnzahl: gapsInScope.length,
      befundeNachTyp: countBy(gapsInScope.map((gap) => gap.type)),
      befundeNachAkteur: countBy(gapsInScope.map((gap) => gap.actor)),
      befunde: gapsInScope.slice(0, maxGaps).map(compactGap),
      befundeGekappt: gapsInScope.length > maxGaps,
      familien:
        familiesInScope === undefined
          ? 'Report stammt aus einem Scan vor Welle 4 — Familien erst nach neuem Scan'
          : familiesInScope.slice(0, maxFamilies).map(compactFamily),
      familienAnzahl: familiesInScope?.length ?? null,
      familienGekappt: familiesInScope !== undefined && familiesInScope.length > maxFamilies,
    },
  }
}
