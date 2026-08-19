'use client'

/**
 * @fileoverview Client-Hook fuer die Inline-Kuration der Agentensicht (Welle 4, F4).
 *
 * @description
 * EINZIGER Schreibweg der Agentensicht ist die Kurations-Patch-Route
 * (`POST /api/library/{id}/shadow-twins/curation`, Contract §4) — dieser Hook
 * kapselt sie. Nach einem erfolgreichen Patch wird der Report NICHT neu
 * gerechnet (der Scan bleibt explizit); stattdessen traegt ein Override je
 * Quelle den frischen Kurationszustand, bis der naechste Scan laeuft.
 *
 * 409-Antworten sind BEFUNDE, keine technischen Fehler: `mirror_drift`
 * („erst importieren") und `self_verified` werden der Zeile im Klartext
 * angezeigt — nichts wurde ueberschrieben.
 *
 * @module hooks/agent-view
 */

import { useCallback, useState } from 'react'
import { verificationStateOf } from '@/lib/agent-view/family-summaries'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

interface CurationRouteResponse {
  curation: {
    twinStatus: string | null
    generatedBy: string | null
    generatedAt: string | null
    verifiedBy: string | null
    verifiedAt: string | null
    verificationValid: boolean
  }
}

export interface UseTwinCurationResult {
  /** Frischer Kurationszustand je sourceId — ueberlagert den Report bis zum naechsten Scan. */
  overrides: ReadonlyMap<string, LeadingArtifactSummary>
  /** sourceId der gerade laufenden Aktion (eine zur Zeit). */
  pendingSourceId: string | null
  /** Klartext-Befund je sourceId (409-Codes inklusive). */
  errorBySource: ReadonlyMap<string, string>
  setTwinStatus: (family: TwinFamilySummary, twinStatus: string) => Promise<void>
  verify: (family: TwinFamilySummary) => Promise<void>
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (typeof body.error === 'string' && body.error.trim() !== '') return body.error
  } catch {
    // Antwort ohne JSON-Body: Status-Code ist die beste verfuegbare Aussage.
  }
  return `HTTP ${response.status}`
}

function mergeLeading(
  leading: LeadingArtifactSummary,
  curation: CurationRouteResponse['curation'],
): LeadingArtifactSummary {
  return {
    ...leading,
    twinStatus: curation.twinStatus,
    generatedBy: curation.generatedBy,
    generatedAt: curation.generatedAt,
    verifiedBy: curation.verifiedBy,
    verifiedAt: curation.verifiedAt,
    verification: verificationStateOf({
      generated_at: curation.generatedAt ?? undefined,
      verified_by: curation.verifiedBy ?? undefined,
      verified_at: curation.verifiedAt ?? undefined,
    }),
  }
}

export function useTwinCuration(libraryId: string): UseTwinCurationResult {
  const [overrides, setOverrides] = useState<Map<string, LeadingArtifactSummary>>(new Map())
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null)
  const [errorBySource, setErrorBySource] = useState<Map<string, string>>(new Map())

  const patch = useCallback(
    async (family: TwinFamilySummary, body: { set?: { twin_status: string }; verify?: boolean }) => {
      const leading = family.leading
      if (!leading) return
      setPendingSourceId(family.sourceId)
      setErrorBySource((prev) => {
        const next = new Map(prev)
        next.delete(family.sourceId)
        return next
      })
      try {
        const response = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/curation`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceId: family.sourceId,
              artifact: {
                kind: leading.kind,
                targetLanguage: leading.targetLanguage,
                templateName: leading.templateName ?? undefined,
              },
              ...body,
            }),
          },
        )
        if (!response.ok) throw new Error(await readError(response))
        const result = (await response.json()) as CurationRouteResponse
        setOverrides((prev) => new Map(prev).set(family.sourceId, mergeLeading(leading, result.curation)))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setErrorBySource((prev) => new Map(prev).set(family.sourceId, message))
      } finally {
        setPendingSourceId(null)
      }
    },
    [libraryId],
  )

  const setTwinStatus = useCallback(
    (family: TwinFamilySummary, twinStatus: string) => patch(family, { set: { twin_status: twinStatus } }),
    [patch],
  )
  const verify = useCallback((family: TwinFamilySummary) => patch(family, { verify: true }), [patch])

  return { overrides, pendingSourceId, errorBySource, setTwinStatus, verify }
}
