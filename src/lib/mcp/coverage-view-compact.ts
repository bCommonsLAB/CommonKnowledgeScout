/**
 * @fileoverview Kompakt-Bausteine der MCP-Coverage-Sicht (Welle 5).
 *
 * @description
 * Aus `coverage-view.ts` ausgelagert (200-Zeilen-Regel): die Ordnerliste des
 * Teilbaums und die kompakten Befund-/Familien-Formen. Wunschlisten-Punkt C1
 * (Pilot 2026-08-21): Befunde tragen jetzt `targetId`, `folderId` und
 * `scope` — bei `scope: 'source'` IST `targetId` die sourceId fuer
 * `transformation_starten`/`familie_umziehen`/`quelle_erschliessen`. Damit
 * ist der Weg Befund → Aktion ein Feldzugriff statt einer Suche ueber die
 * Familienliste.
 *
 * @module mcp
 */

import type { CoverageGap, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'
import { isInSubtree } from './coverage-view'

/**
 * Ordner des Teilbaums (Pfad + folderId + Prioritaets-Zahlen) — damit kann
 * der Agent `abdeckung_scannen`/`twins_pruefen` gezielt auf einen Teilbaum
 * begrenzen, statt die ganze Library zu laufen (OneDrive: ein API-Call pro
 * Ordner). Reihenfolge: die meisten Befunde zuerst.
 */
export function collectFolders(nodes: readonly CoverageTreeNode[], prefix: string): Array<{
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

export function compactGap(gap: CoverageGap) {
  return {
    type: gap.type,
    actor: gap.actor,
    zyklusSchritt: gap.zyklusSchritt,
    severity: gap.severity,
    /** 'source' | 'folder' | 'library' — sagt, worauf targetId zeigt. */
    scope: gap.scope,
    /** Storage-Id des Knotens; bei scope 'source' die sourceId fuer Werkzeug-Aufrufe. */
    targetId: gap.targetId,
    /** Ordner, unter dem der Befund haengt — Ziel fuer Teilbaum-Scans/-Checks. */
    folderId: gap.folderId,
    path: gap.path,
    targetName: gap.targetName,
    message: gap.message,
    ...(gap.detail ? { detail: gap.detail } : {}),
  }
}

export function compactFamily(family: TwinFamilySummary) {
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
