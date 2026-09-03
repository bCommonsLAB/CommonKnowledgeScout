'use client'

/**
 * @fileoverview Kuration je Artefakt (Welle A4) — Verifizieren, Markieren,
 * Korrekturauftrag, twin_status.
 *
 * @description
 * Kuration je Artefakt fuer die Werkbank: Der Kopf verifiziert oder markiert
 * das Artefakt des AKTIVEN Tabs (Transkript ODER Zusammenfassung).
 * EINZIGER Schreibweg bleibt die bestehende Kurations-Patch-Route
 * (Contract §4). Overrides sind je {@link artefaktKey} abgelegt und
 * ueberlagern den Report bis zum naechsten Scan — Baum-Kennung, Zaehler und
 * Tabs lesen sie ueber `useWerkbankBaum`.
 *
 * Sammelaktionen gibt es seit ADR 0006 nicht mehr: In Modell B ist nichts
 * massenhaft zu bestaetigen — genau ihre Existenz war das Symptom der
 * Zustimmungspflicht.
 *
 * 409-Antworten sind BEFUNDE (Spiegel-Drift, Selbst-Verifikation): sie
 * erscheinen als Klartext am Ort der Aktion, nichts wurde ueberschrieben.
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
    flaggedBy: string | null
    flaggedAt: string | null
    flaggedNote: string | null
    korrekturAuftrag: string | null
    korrekturVon: string | null
    korrekturAt: string | null
    korrekturErledigtAt: string | null
    verificationValid: boolean
  }
}

/** Body-Formen der Kurations-Route — genau eine Aktion je Aufruf. */
type KurationsAktion =
  | { set: { twin_status: string } }
  | { verify: true }
  | { markiere: { notiz: string } }
  | { korrigiere: { auftrag: string } }
  | { nimmKorrekturZurueck: true }

export interface UseArtefaktKurationResult {
  overrides: ReadonlyMap<string, LeadingArtifactSummary>
  /** artefaktKey der laufenden Einzel-Aktion. */
  pendingKey: string | null
  /** Klartext-Befund je artefaktKey (409 inklusive). */
  fehler: ReadonlyMap<string, string>
  /** Verifiziert EIN Artefakt; liefert den frischen Zustand oder null (Fehler). */
  verifiziere: (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary) => Promise<LeadingArtifactSummary | null>
  /**
   * Markiert EIN Artefakt als fehlerhaft (ADR 0006). Die Notiz ist Pflicht —
   * eine leere lehnt der Server ab, der Befund erscheint in {@link fehler}.
   */
  markiere: (
    familie: TwinFamilySummary,
    artefakt: LeadingArtifactSummary,
    notiz: string,
  ) => Promise<LeadingArtifactSummary | null>
  /**
   * Stellt EINEN Korrekturauftrag an den Agenten (K1) — was mit der Datei
   * geschehen soll. Der Text ist Pflicht; ein leerer wird abgelehnt.
   */
  korrigiere: (
    familie: TwinFamilySummary,
    artefakt: LeadingArtifactSummary,
    auftrag: string,
  ) => Promise<LeadingArtifactSummary | null>
  /** Nimmt den Korrekturauftrag zurueck (Fehl-Diktat). */
  nimmKorrekturZurueck: (
    familie: TwinFamilySummary,
    artefakt: LeadingArtifactSummary,
  ) => Promise<LeadingArtifactSummary | null>
  setzeTwinStatus: (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, twinStatus: string) => Promise<void>
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
    flaggedBy: curation.flaggedBy,
    flaggedAt: curation.flaggedAt,
    flaggedNote: curation.flaggedNote,
    korrekturAuftrag: curation.korrekturAuftrag,
    korrekturVon: curation.korrekturVon,
    korrekturAt: curation.korrekturAt,
    korrekturErledigtAt: curation.korrekturErledigtAt,
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

  const patch = useCallback(
    async (
      familie: TwinFamilySummary,
      artefakt: LeadingArtifactSummary,
      body: KurationsAktion,
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
      body: KurationsAktion,
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
  const markiere = useCallback(
    (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, notiz: string) =>
      einzel(familie, artefakt, { markiere: { notiz } }),
    [einzel],
  )
  const korrigiere = useCallback(
    (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, auftrag: string) =>
      einzel(familie, artefakt, { korrigiere: { auftrag } }),
    [einzel],
  )
  const nimmKorrekturZurueck = useCallback(
    (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary) =>
      einzel(familie, artefakt, { nimmKorrekturZurueck: true }),
    [einzel],
  )
  const setzeTwinStatus = useCallback(
    async (familie: TwinFamilySummary, artefakt: LeadingArtifactSummary, twinStatus: string) => {
      await einzel(familie, artefakt, { set: { twin_status: twinStatus } })
    },
    [einzel],
  )

  return {
    overrides, pendingKey, fehler,
    verifiziere, markiere, korrigiere, nimmKorrekturZurueck, setzeTwinStatus,
  }
}
