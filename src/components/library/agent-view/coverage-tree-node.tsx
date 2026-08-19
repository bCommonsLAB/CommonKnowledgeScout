'use client'

/**
 * @fileoverview Ein Knoten des Agenten-Baums (F1).
 *
 * @description
 * Zeigt je Ordner: Ampel, Name, erklaerten Stand, Zaehler (Quellen, Dateien,
 * Befunde), die Befunde des Ordners und — seit Welle 4 — die Twin-Familien
 * mit Inline-Kuration (F4). Geschrieben wird ausschliesslich ueber die
 * Kurations-Patch-Route (via `useTwinCuration`), nie direkt.
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, ListTree } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { UseTwinCurationResult } from '@/hooks/agent-view/use-twin-curation'
import { gapLabel, standLabel } from '@/lib/agent-view/labels'
import type { CoverageGap, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'
import { CoverageAmpel, GapCountBadge } from './coverage-ampel'
import { TwinFamilyRow } from './twin-family-row'

export interface CoverageTreeNodeRowProps {
  node: CoverageTreeNode
  gapsByFolder: Map<string, CoverageGap[]>
  familiesByFolder: Map<string, TwinFamilySummary[]>
  curation: UseTwinCurationResult
  defaultOpen?: boolean
}

export function CoverageTreeNodeRow({
  node,
  gapsByFolder,
  familiesByFolder,
  curation,
  defaultOpen = false,
}: CoverageTreeNodeRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const ownGaps = gapsByFolder.get(node.folderId) ?? []
  const ownFamilies = familiesByFolder.get(node.folderId) ?? []
  const hasChildren = node.children.length > 0 || ownGaps.length > 0 || ownFamilies.length > 0

  return (
    <div className="border-l border-border/60 pl-3">
      <div className="flex items-center gap-2 py-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 text-left hover:underline disabled:opacity-40"
          disabled={!hasChildren}
          aria-expanded={open}
        >
          {hasChildren ? (
            open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="inline-block w-3.5" />
          )}
          <CoverageAmpel ampel={node.ampel} />
          <span className="text-sm font-medium">{node.name || '(Wurzel)'}</span>
        </button>

        {node.bearbeitungsstand !== null && (
          <Badge variant="outline" title="Erklaerter Stand aus dem _INDEX.md">
            {standLabel(node.bearbeitungsstand)}
          </Badge>
        )}
        {node.hasBericht && <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-label="BERICHT.md vorhanden" />}
        {node.hasIndex && <ListTree className="h-3.5 w-3.5 text-muted-foreground" aria-label="_INDEX.md vorhanden" />}

        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span title="Quellen mit Twin-Familie in diesem Ordner">{node.sourceCount} Quellen</span>
          <span title="Dateien in diesem Ordner (ohne Spiegelordner)">{node.fileCount} Dateien</span>
          <GapCountBadge count={node.totalGaps} byActor={node.gapsByActor} />
        </span>
      </div>

      {open && (
        <div className="ml-2">
          {ownFamilies.map((family) => (
            <TwinFamilyRow
              key={family.sourceId}
              family={family}
              pending={curation.pendingSourceId === family.sourceId}
              error={curation.errorBySource.get(family.sourceId) ?? null}
              onSetStatus={(twinStatus) => void curation.setTwinStatus(family, twinStatus)}
              onVerify={() => void curation.verify(family)}
            />
          ))}
          {ownGaps.map((gap, index) => (
            <div key={`${gap.type}-${gap.targetId}-${index}`} className="py-0.5 text-xs">
              <span className="font-medium">{gapLabel(gap.type)}</span>
              <span className="text-muted-foreground"> — {gap.message}</span>
              {gap.detail && <span className="text-muted-foreground/80"> ({gap.detail})</span>}
            </div>
          ))}
          {node.children.map((child) => (
            <CoverageTreeNodeRow
              key={child.folderId}
              node={child}
              gapsByFolder={gapsByFolder}
              familiesByFolder={familiesByFolder}
              curation={curation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
