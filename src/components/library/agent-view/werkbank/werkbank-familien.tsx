'use client'

/**
 * @fileoverview Twin-Familien des Teilbaums im Werkbank-Detail (F9, Welle W4).
 *
 * @description
 * Rendert die BESTEHENDE `twin-family-row` (Inline-Kuration inkl.
 * `twin_status`-Dropdown und Verifizieren) — der Kurations-Schreibweg bleibt,
 * wo er ist (v1 F4). Kurations-Overrides ueberlagern wie im Baum lokal bis
 * zum naechsten Scan. Reports aus Scans vor Welle 4 (ohne `families`) werden
 * benannt statt still leer zu bleiben.
 *
 * @module components/library/agent-view
 */

import type { UseTwinCurationResult } from '@/hooks/agent-view/use-twin-curation'
import type { TwinFamilySummary } from '@/lib/agent-view/types'
import { TwinFamilyRow } from '../twin-family-row'

export function WerkbankFamilien({
  familien,
  truncated,
  curation,
}: {
  /** Familien des Teilbaums; undefined = Report aus einem Scan vor Welle 4. */
  familien: readonly TwinFamilySummary[] | undefined
  /** true, wenn der Report die Familienliste am Budget gekappt hat. */
  truncated: boolean
  curation: UseTwinCurationResult
}) {
  if (familien === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Dieser Report stammt aus einem Scan vor Welle 4 — Twin-Familien erscheinen nach &bdquo;Neu
        scannen&ldquo;.
      </p>
    )
  }
  if (familien.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Twin-Familien im Teilbaum dieses Vorhabens.</p>
  }

  return (
    <div className="space-y-1">
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Familienliste des Reports am Budget gekappt — nicht alle Familien sind hier sichtbar.
        </p>
      )}
      {familien.map((family) => {
        const override = curation.overrides.get(family.sourceId)
        const effective = override ? { ...family, leading: override } : family
        return (
          <TwinFamilyRow
            key={family.sourceId}
            family={effective}
            pending={curation.pendingSourceId === family.sourceId}
            error={curation.errorBySource.get(family.sourceId) ?? null}
            onSetStatus={(twinStatus) => void curation.setTwinStatus(effective, twinStatus)}
            onVerify={() => void curation.verify(effective)}
          />
        )
      })}
    </div>
  )
}
