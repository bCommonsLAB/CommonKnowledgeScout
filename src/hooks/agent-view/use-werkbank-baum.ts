'use client'

/**
 * @fileoverview Baum-Daten der Werkbank-Liste (Welle A2) — Memo-Hook.
 *
 * @description
 * Rechnet aus dem gespeicherten Report die Teilbaum-Zeilen und Pruef-Zaehler
 * je Vorhaben (pure Funktionen aus `werkbank-baum.ts`), ueberlagert mit den
 * frischen Kurations-Overrides (Verifikationen seit dem letzten Scan). Das
 * Panel reicht das Ergebnis als `baum`-Prop an die virtualisierte Liste —
 * die Liste rendert, hier wird gerechnet.
 *
 * @module hooks/agent-view
 */

import { useMemo } from 'react'
import { familienImTeilbaum, findeKnoten } from '@/lib/agent-view/teilbaum'
import type { CoverageReport, LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import {
  baueTeilbaumZeilen,
  effektiveFamilie,
  zaehlePruefstand,
  type BaumZeile,
  type PruefZaehler,
} from '@/lib/agent-view/werkbank-baum'

const KEINE_OVERRIDES: ReadonlyMap<string, LeadingArtifactSummary> = new Map()

export interface WerkbankBaumDaten {
  zeilenFuer: (vorhabenId: string, ordnerZu: ReadonlySet<string>) => BaumZeile[]
  zaehlerFuer: (vorhabenId: string) => PruefZaehler | null
  /** Effektive Familien (Report + Overrides) je Vorhaben — auch fuer Kopf/Detail. */
  familienFuer: (vorhabenId: string) => TwinFamilySummary[] | undefined
  /** Effektive Familie zur sourceId; null = nicht im Report. */
  familieZu: (sourceId: string | null) => TwinFamilySummary | null
}

export function useWerkbankBaum(
  report: CoverageReport,
  overrides: ReadonlyMap<string, LeadingArtifactSummary> = KEINE_OVERRIDES,
): WerkbankBaumDaten {
  const effektiv = useMemo(
    () => report.families?.map((familie) => effektiveFamilie(familie, overrides)),
    [report.families, overrides],
  )

  const jeVorhaben = useMemo(() => {
    const map = new Map<string, TwinFamilySummary[] | undefined>()
    for (const karte of report.vorhaben) {
      map.set(karte.folderId, familienImTeilbaum(effektiv, karte.path))
    }
    return map
  }, [report.vorhaben, effektiv])

  return useMemo<WerkbankBaumDaten>(
    () => ({
      zeilenFuer: (vorhabenId, ordnerZu) =>
        baueTeilbaumZeilen({
          vorhabenFolderId: vorhabenId,
          knoten: findeKnoten(report.tree, vorhabenId),
          familien: jeVorhaben.get(vorhabenId),
          ordnerZu,
        }),
      zaehlerFuer: (vorhabenId) => {
        const familien = jeVorhaben.get(vorhabenId)
        return familien === undefined ? null : zaehlePruefstand(familien)
      },
      familienFuer: (vorhabenId) => jeVorhaben.get(vorhabenId),
      familieZu: (sourceId) =>
        sourceId === null ? null : effektiv?.find((familie) => familie.sourceId === sourceId) ?? null,
    }),
    [report.tree, jeVorhaben, effektiv],
  )
}
