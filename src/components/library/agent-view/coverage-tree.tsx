'use client'

/**
 * @fileoverview Baumansicht der Agentensicht (F1) — read-only.
 *
 * @description
 * „Archiv zeigt die Dateien; die Agentensicht zeigt, was ein Agent davon
 * versteht — und was ihm fehlt." Der Baum rendert exakt das, was der Report
 * liefert; er rechnet nichts nach und kennt kein Storage-Backend.
 *
 * @module components/library/agent-view
 */

import { useMemo } from 'react'
import type { CoverageGap, CoverageReport } from '@/lib/agent-view/types'
import { CoverageTreeNodeRow } from './coverage-tree-node'

export function CoverageTree({ report }: { report: CoverageReport }) {
  const gapsByFolder = useMemo(() => {
    const map = new Map<string, CoverageGap[]>()
    for (const gap of report.gaps) {
      const bucket = map.get(gap.folderId)
      if (bucket) bucket.push(gap)
      else map.set(gap.folderId, [gap])
    }
    return map
  }, [report.gaps])

  if (report.tree.length === 0) {
    return <p className="text-sm text-muted-foreground">Der Scan hat keinen Ordner erfasst.</p>
  }

  return (
    <div className="space-y-1">
      {report.tree.map((node) => (
        <CoverageTreeNodeRow key={node.folderId} node={node} gapsByFolder={gapsByFolder} defaultOpen />
      ))}
    </div>
  )
}
