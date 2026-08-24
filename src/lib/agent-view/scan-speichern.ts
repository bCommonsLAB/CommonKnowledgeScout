/**
 * @fileoverview Scannen + Merge + Speichern — der EINE Weg (F10, Nachzug W8).
 *
 * @description
 * Teilbaum-Scans muessen sich ins Gesamtbild einfuegen, egal wer sie ausloest:
 * die Agentensicht („Teilbaum neu scannen") ODER die MCP-Bruecke
 * (`abdeckung_scannen`). Vor diesem Modul lag die Merge-Entscheidung nur in
 * der Route — ein MCP-Teilbaum-Scan ERSETZTE den Voll-Report und liess die
 * Werkbank mit einem einzigen Vorhaben zurueck (Live-Befund 24.08.2026).
 *
 * Jetzt teilen sich beide Aufrufer diesen Ablauf (Projektauftrag v2 §7:
 * geteilte Praedikate, kein Drift). Nicht mergebare Lagen sind BENANNT
 * (`mergeHinweis`) statt still — `no-silent-fallbacks.mdc`.
 *
 * @module agent-view
 */

import { getCoverageReport, saveCoverageReport, type CoverageReportDoc } from '@/lib/repositories/agent-view-coverage-repo'
import { mergeTeilbaumReport } from './report-merge'
import { scanLibraryCoverage } from './run-coverage-scan'
import type { CoverageReport } from './types'

export interface ScanSpeichernArgs {
  libraryId: string
  userEmail: string
  /** null = Voll-Scan; sonst der Teilbaum-Scope (Merge-Kandidat). */
  folderId: string | null
  /** Library-relativer Scope-Pfad (nur beim pfad-Aufruf der Bruecke bekannt). */
  scopePath?: string | null
}

export interface ScanSpeichernErgebnis {
  stored: CoverageReportDoc
  /** true = der Teil-Report wurde in den gespeicherten Voll-Report gemergt. */
  merged: boolean
  /** Warum NICHT gemergt wurde; null = gemergt oder Voll-Scan. */
  mergeHinweis: string | null
}

/**
 * Entscheidet ueber den Merge eines frischen Teil-Reports. Ohne gespeicherten
 * Report und bei gekappter Befundliste ist die Aequivalenz zum Voll-Scan nicht
 * beweisbar — dann ersetzt der Teil-Report, und der Grund wird gesagt.
 */
function mergeOderErsetze(
  teil: CoverageReport,
  gespeichert: CoverageReportDoc | null,
): { zuSpeichern: CoverageReport; merged: boolean; mergeHinweis: string | null } {
  if (gespeichert === null) {
    return {
      zuSpeichern: teil,
      merged: false,
      mergeHinweis: 'Kein gespeicherter Report vorhanden — der Teilbaum-Report wird direkt gespeichert.',
    }
  }
  if (gespeichert.gapsTruncated) {
    return {
      zuSpeichern: teil,
      merged: false,
      mergeHinweis:
        'Die gespeicherte Befundliste ist gekappt — Merge nicht beweisbar, der Teilbaum-Report ersetzt sie (einmal voll scannen).',
    }
  }
  const ergebnis = mergeTeilbaumReport({ voll: gespeichert.report, teil })
  if (ergebnis.merged) return { zuSpeichern: ergebnis.report, merged: true, mergeHinweis: null }
  return { zuSpeichern: teil, merged: false, mergeHinweis: ergebnis.erklaerung }
}

/**
 * Scannt (voll oder Teilbaum), merged wenn beweisbar und speichert. EIN Weg
 * fuer Agentensicht-Route und MCP-Bruecke.
 */
export async function scanneUndSpeichere(args: ScanSpeichernArgs): Promise<ScanSpeichernErgebnis> {
  const report = await scanLibraryCoverage({
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    folderId: args.folderId,
    scopePath: args.scopePath ?? null,
  })

  // Voll-Scan ersetzt immer — es gibt nichts zu mergen.
  if (args.folderId === null) {
    return { stored: await saveCoverageReport(report), merged: false, mergeHinweis: null }
  }

  const gespeichert = await getCoverageReport(args.libraryId)
  const { zuSpeichern, merged, mergeHinweis } = mergeOderErsetze(report, gespeichert)
  return { stored: await saveCoverageReport(zuSpeichern), merged, mergeHinweis }
}
