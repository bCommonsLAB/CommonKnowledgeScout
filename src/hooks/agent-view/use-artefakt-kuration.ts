'use client'

/**
 * @fileoverview Kuration je Artefakt (Welle A4) — Verifizieren + twin_status.
 *
 * @description
 * Nachfolger der Familien-Kuration fuer die Werkbank: Der Abnahme-Kopf
 * verifiziert das Artefakt des AKTIVEN Tabs (Transkript ODER
 * Zusammenfassung, Entscheidung 4), die Sammelaktion eine ganze Art auf
 * einmal (Entscheidung 3). EINZIGER Schreibweg bleibt die bestehende
 * Kurations-Patch-Route (Contract §4). Overrides sind je {@link artefaktKey}
 * abgelegt und ueberlagern den Report bis zum naechsten Scan — Baum-Kennung,
 * Zaehler und Tabs lesen sie ueber `useWerkbankBaum`.
 *
 * 409-Antworten sind BEFUNDE (Spiegel-Drift, Selbst-Verifikation): sie
 * erscheinen als Klartext am Ort der Aktion, nichts wurde ueberschrieben.
 * Die Sammelaktion arbeitet SEQUENZIELL und sammelt Fehler je Datei —
 * kein stilles Weiterlaufen.
 *
 * @module hooks/agent-view
 */

import { useCallback, useState } from 'react'
import { verificationStateOf } from '@/lib/agent-view/family-summaries'
import { artefaktKey } from '@/lib/agent-view/werkbank-baum'
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

export interface SammelErgebnis {
  erledigt: number
  gesamt: number
  /** Klartext je fehlgeschlagener Datei — sichtbar, nie still. */
  fehler: string[]
}

export interface UseArtefaktKurationResult {
  overrides: ReadonlyMap<string, LeadingArtifactSummary>
  /** artefaktKey der laufenden Einzel-Aktion. */
  pendingKey: string | null
  /** Klartext-Befund je artefaktKey (409 inklusive). */
  fehler: ReadonlyMap<string, string>
  /** Verifiziert EIN Artefakt; liefert den frischen Zustand oder null (Fehler). */
  verifiziere: (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary) => Promise<LeadingArtifactSummary | null>
  setzeTwinStatus: (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, twinStatus: string) => Promise<void>
  /** Sammel-Verifikation (sequenziell); liefert das benannte Ergebnis. */
  sammelVerifiziere: (
    ziele: readonly { familie: TwinFamilySummary; artefakt: LeadingArtifactSummary }[],
  ) => Promise<SammelErgebnis>
  sammelLaeuft: boolean
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

function mergeArtefakt(
  artefakt: LeadingArtifactSummary,
  curation: CurationRouteResponse['curation'],
): LeadingArtifactSummary {
  return {
    ...artefakt,
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

export function useArtefaktKuration(libraryId: string): UseArtefaktKurationResult {
  const [overrides, setOverrides] = useState<Map<string, LeadingArtifactSummary>>(new Map())
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [fehler, setFehler] = useState<Map<string, string>>(new Map())
  const [sammelLaeuft, setSammelLaeuft] = useState(false)

  const patch = useCallback(
    async (
      familie: TwinFamilySummary,
      artefakt: LeadingArtifactSummary,
      body: { set?: { twin_status: string }; verify?: boolean },
    ): Promise<LeadingArtifactSummary> => {
      const response = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/curation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: familie.sourceId,
            artifact: {
              kind: artefakt.kind,
              targetLanguage: artefakt.targetLanguage,
              templateName: artefakt.templateName ?? undefined,
            },
            ...body,
          }),
        },
      )
      if (!response.ok) throw new Error(await readError(response))
      const result = (await response.json()) as CurationRouteResponse
      const frisch = mergeArtefakt(artefakt, result.curation)
      setOverrides((prev) => new Map(prev).set(artefaktKey(familie.sourceId, artefakt), frisch))
      return frisch
    },
    [libraryId],
  )

  const einzel = useCallback(
    async (
      familie: TwinFamilySummary,
      artefakt: LeadingArtifactSummary,
      body: { set?: { twin_status: string }; verify?: boolean },
    ): Promise<LeadingArtifactSummary | null> => {
      const key = artefaktKey(familie.sourceId, artefakt)
      setPendingKey(key)
      setFehler((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      try {
        return await patch(familie, artefakt, body)
      } catch (err) {
        setFehler((prev) => new Map(prev).set(key, err instanceof Error ? err.message : String(err)))
        return null
      } finally {
        setPendingKey(null)
      }
    },
    [patch],
  )

  const verifiziere = useCallback(
    (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary) => einzel(familie, artefakt, { verify: true }),
    [einzel],
  )
  const setzeTwinStatus = useCallback(
    async (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, twinStatus: string) => {
      await einzel(familie, artefakt, { set: { twin_status: twinStatus } })
    },
    [einzel],
  )

  const sammelVerifiziere = useCallback(
    async (ziele: readonly { familie: TwinFamilySummary; artefakt: LeadingArtifactSummary }[]) => {
      setSammelLaeuft(true)
      const ergebnis: SammelErgebnis = { erledigt: 0, gesamt: ziele.length, fehler: [] }
      try {
        // Sequenziell: gentle zum Storage-Provider, Fehler bleiben zuordenbar.
        for (const { familie, artefakt } of ziele) {
          try {
            await patch(familie, artefakt, { verify: true })
            ergebnis.erledigt += 1
          } catch (err) {
            ergebnis.fehler.push(`${familie.sourceName}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      } finally {
        setSammelLaeuft(false)
      }
      return ergebnis
    },
    [patch],
  )

  return { overrides, pendingKey, fehler, verifiziere, setzeTwinStatus, sammelVerifiziere, sammelLaeuft }
}
