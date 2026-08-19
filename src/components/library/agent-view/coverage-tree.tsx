'use client'

/**
 * @fileoverview Baumansicht der Agentensicht (F1).
 *
 * @description
 * „Archiv zeigt die Dateien; die Agentensicht zeigt, was ein Agent davon
 * versteht — und was ihm fehlt." Der Baum rendert exakt das, was der Report
 * liefert; er rechnet nichts nach und kennt kein Storage-Backend.
 *
 * Seit Welle 4 traegt jeder Twin-Knoten die Inline-Kuration (F4):
 * `twin_status`-Dropdown + Verify — ueber die Kurations-Patch-Route, den
 * EINZIGEN Schreibweg der Sicht. Frisch kuratierte Zustaende ueberlagern den
 * Report lokal, bis der naechste explizite Scan laeuft.
 *
 * @module components/library/agent-view
 */

import { useMemo } from 'react'
import { useTwinCuration } from '@/hooks/agent-view/use-twin-curation'
import type { CoverageGap, CoverageReport, TwinFamilySummary } from '@/lib/agent-view/types'
import { CoverageTreeNodeRow } from './coverage-tree-node'

export function CoverageTree({ report }: { report: CoverageReport }) {
  const curation = useTwinCuration(report.libraryId)

  const gapsByFolder = useMemo(() => {
    const map = new Map<string, CoverageGap[]>()
    for (const gap of report.gaps) {
      const bucket = map.get(gap.folderId)
      if (bucket) bucket.push(gap)
      else map.set(gap.folderId, [gap])
    }
    return map
  }, [report.gaps])

  // Frisch kuratierte Familien (Overrides) ueber den Report-Stand legen.
  const familiesByFolder = useMemo(() => {
    const map = new Map<string, TwinFamilySummary[]>()
    for (const family of report.families ?? []) {
      const override = curation.overrides.get(family.sourceId)
      const effective = override ? { ...family, leading: override } : family
      const bucket = map.get(family.folderId)
      if (bucket) bucket.push(effective)
      else map.set(family.folderId, [effective])
    }
    return map
  }, [report.families, curation.overrides])

  if (report.tree.length === 0) {
    return <p className="text-sm text-muted-foreground">Der Scan hat keinen Ordner erfasst.</p>
  }

  return (
    <div className="space-y-1">
      {report.families === undefined && (
        <p className="text-xs text-muted-foreground">
          Dieser Report stammt aus einem Scan vor Welle 4 — Twin-Familien und Inline-Verifikation
          erscheinen nach &bdquo;Neu scannen&ldquo;.
        </p>
      )}
      {report.familiesTruncated && (
        <p className="text-xs text-muted-foreground">
          Familienliste am Budget gekappt — nicht alle Twin-Familien sind im Baum sichtbar.
        </p>
      )}
      {report.tree.map((node) => (
        <CoverageTreeNodeRow
          key={node.folderId}
          node={node}
          gapsByFolder={gapsByFolder}
          familiesByFolder={familiesByFolder}
          curation={curation}
          defaultOpen
        />
      ))}
    </div>
  )
}
