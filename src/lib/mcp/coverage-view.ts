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

import type { CoverageReport } from '@/lib/agent-view/types'
import { describeEmptyFilter } from './coverage-filter-warning'
import { collectFolders, compactFamily, compactGap } from './coverage-view-compact'

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
  /** C5 (Pilot-Wunschliste): nur Befunde dieses Akteurs. */
  akteur?: 'mensch' | 'cowork' | 'knowledgescout' | null
  /** C5: nur Befunde dieses Zyklus-Schritts (1-4). */
  zyklusSchritt?: number | null
  /** C5: nur Zaehler liefern — Befund-/Familienlisten bleiben leer (ausgewiesen). */
  nurZaehler?: boolean
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

/**
 * Bildet einen LIBRARY-relativen Filter auf einen Teilbaum-Report ab, dessen
 * Pfade SCOPE-relativ sind (Cowork-Befund: beides zusammen ergab still 0
 * Treffer). Kennt der Report seinen Scope-Pfad, wird gekuerzt; sonst wird
 * der Filter unveraendert (scope-relativ) interpretiert.
 */
export function mapPrefixToScope(prefix: string, scopePath: string): string {
  if (prefix === '' || scopePath === '') return prefix
  if (prefix === scopePath || isInSubtree(scopePath, prefix)) return ''
  if (isInSubtree(prefix, scopePath)) return prefix.slice(scopePath.length + 1)
  return prefix
}

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

/**
 * Baut die kompakte Agenten-Sicht auf den juengsten Report. Reine Funktion —
 * die Werkzeug-Schicht liefert die Eingaben aus dem Report-Cache.
 */
export function summarizeCoverageReport(args: CoverageViewArgs) {
  const requestedPrefix = normalizePrefix(args.pathPrefix)
  const scoped = args.report.scope.folderId != null
  const scopePath = normalizePrefix(args.report.scope.path ?? '')
  const prefix = scoped ? mapPrefixToScope(requestedPrefix, scopePath) : requestedPrefix
  const maxGaps = args.maxGaps ?? DEFAULT_MAX_GAPS
  const maxFamilies = args.maxFamilies ?? DEFAULT_MAX_FAMILIES
  const maxFolders = args.maxFolders ?? DEFAULT_MAX_FOLDERS
  const folders = collectFolders(args.report.tree, prefix)

  const gapsInPath = prefix === ''
    ? args.report.gaps
    : args.report.gaps.filter((gap) => isInSubtree(gap.path, prefix))
  const akteur = args.akteur ?? null
  const zyklusSchritt = args.zyklusSchritt ?? null
  const gapsInScope = gapsInPath.filter(
    (gap) =>
      (akteur === null || gap.actor === akteur) &&
      (zyklusSchritt === null || gap.zyklusSchritt === zyklusSchritt),
  )
  // D2 (Pilot-Wunschliste): „bereit zur Abnahme“ = im Pfad-Scope wartet alles
  // auf den Menschen — null maschinelle Befunde, mindestens ein F4-Befund.
  // Das erreichbare Ziel eines Agentenlaufs; gruen kann nur der Mensch machen.
  const maschinell = gapsInPath.filter((gap) => gap.actor !== 'mensch').length
  const bereitZurAbnahme = maschinell === 0 && gapsInPath.length > 0
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
    scopeHinweis: scoped
      ? `TEILBAUM-Report${scopePath ? ` (Scope: ${scopePath})` : ' (Scope-Pfad unbekannt)'} — Pfade im Report sind SCOPE-relativ; ` +
        (scopePath
          ? 'library-relative Filter werden automatisch auf den Scope gekuerzt.'
          : 'Filter scope-relativ angeben oder weglassen.')
      : null,
    conventions: args.report.conventions,
    totalsLibraryWeit: args.report.totals,
    gespeicherterReportGekappt: args.storedGapsTruncated
      ? { gespeicherteGaps: args.report.gaps.length, totalGaps: args.totalGaps }
      : null,
    filter: {
      pfad: prefix === '' ? null : prefix,
      pfadAngefragt: requestedPrefix === '' ? null : requestedPrefix,
      akteur,
      zyklusSchritt,
      /** D2: null maschinelle Befunde im Pfad-Scope — alles wartet auf F4/Abnahme. */
      bereitZurAbnahme,
      /** Gesetzt, wenn der Filter ins Leere griff — nie stille 0 (Pilot-Befund). */
      warnung: describeEmptyFilter({
        requestedPrefix, scoped, scopePath,
        // Nur ECHTE Teilbaum-Treffer: collectFolders liefert auch Vorfahren
        // (die Wurzel matcht immer) — die sind kein Beleg fuer einen Treffer.
        matchedFolders: folders.filter((f) => f.path !== '(Wurzel)' && isInSubtree(f.path, prefix)).length,
        matchedGaps: gapsInPath.length,
        reportGaps: args.report.gaps.length,
      }),
      /** folderId hier fuer Teilbaum-Scans/-Checks verwenden (statt ganzer Library). */
      ordner: folders.slice(0, maxFolders),
      ordnerAnzahl: folders.length,
      ordnerGekappt: folders.length > maxFolders,
      befundAnzahl: gapsInScope.length,
      befundeNachTyp: countBy(gapsInScope.map((gap) => gap.type)),
      befundeNachAkteur: countBy(gapsInScope.map((gap) => gap.actor)),
      befunde: args.nurZaehler === true ? [] : gapsInScope.slice(0, maxGaps).map(compactGap),
      befundeGekappt: args.nurZaehler === true ? false : gapsInScope.length > maxGaps,
      nurZaehler: args.nurZaehler === true
        ? 'Listen bewusst leer (nurZaehler) — Zaehler und Ordnerliste sind vollstaendig'
        : null,
      familien: args.nurZaehler === true
        ? []
        : familiesInScope === undefined
          ? 'Report stammt aus einem Scan vor Welle 4 — Familien erst nach neuem Scan'
          : familiesInScope.slice(0, maxFamilies).map(compactFamily),
      familienAnzahl: familiesInScope?.length ?? null,
      familienGekappt: familiesInScope !== undefined && familiesInScope.length > maxFamilies,
    },
  }
}
