'use client'

/**
 * @fileoverview K1-Hook: Kurationszustand des gewaehlten Vorhabens nachladen.
 *
 * @description
 * Nach einem Reload zeigte die Werkbank den alten Report — 28 Verifikationen
 * unsichtbar, bis ein Voll-Scan lief (K1, Testsession 25.08.2026). Dieser
 * Hook laedt beim Wechsel des Vorhabens dessen Kurationszustand ueber
 * `POST agent-view/kuration` (EINE Mongo-Abfrage, Millisekunden) und liefert
 * die Basis-Override-Map; das Panel merged sie UNTER die Session-Overrides
 * (`mergeOverrides` — die eigene, juengere Aktion gewinnt). Damit stimmen
 * Baum-Kennung, Zaehler und Chip nach dem Reload wieder — und der Kopf
 * widerspricht nicht mehr dem daneben angezeigten Frontmatter (K2).
 *
 * Fehler sind BENANNT (`fehler`), nie still: dann gilt sichtbar wieder nur
 * der gespeicherte Report.
 *
 * @module hooks/agent-view
 */

import { useEffect, useMemo, useState } from 'react'
import { baueNachladeOverrides, type KurationsEintrag } from '@/lib/agent-view/kuration-overlay'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

const KEINE_BASIS: ReadonlyMap<string, LeadingArtifactSummary> = new Map()

export interface KurationNachladenResult {
  /** Nachgeladene Overrides (leer, solange nichts gewaehlt/geladen ist). */
  basis: ReadonlyMap<string, LeadingArtifactSummary>
  /** Klartext, wenn das Nachladen scheiterte — der Report gilt dann sichtbar allein. */
  fehler: string | null
}

async function ladeEintraege(
  libraryId: string,
  sourceIds: readonly string[],
  signal: AbortSignal,
): Promise<KurationsEintrag[]> {
  const response = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/agent-view/kuration`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
      signal,
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${response.status}`)
  }
  const body = (await response.json()) as { eintraege?: KurationsEintrag[] }
  if (!Array.isArray(body.eintraege)) throw new Error('Antwort ohne eintraege')
  return body.eintraege
}

/**
 * Laedt den Kurationszustand fuer die Familien des gewaehlten Vorhabens.
 * `familien === undefined` (nichts gewaehlt / Report vor Welle 4) laedt
 * nichts und liefert die leere Basis.
 */
export function useKurationNachladen(
  libraryId: string,
  familien: readonly TwinFamilySummary[] | undefined,
): KurationNachladenResult {
  const [geladen, setGeladen] = useState<{ key: string; eintraege: KurationsEintrag[] } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  // Stabiler Schluessel der Anfrage: dieselbe Id-Menge laedt nicht erneut.
  const sourceIds = useMemo(
    () => (familien === undefined ? null : familien.map((familie) => familie.sourceId).sort()),
    [familien],
  )
  const key = sourceIds === null || sourceIds.length === 0 ? null : sourceIds.join('\n')

  useEffect(() => {
    if (key === null || sourceIds === null) return
    if (geladen?.key === key) return
    const controller = new AbortController()
    ladeEintraege(libraryId, sourceIds, controller.signal)
      .then((eintraege) => {
        setGeladen({ key, eintraege })
        setFehler(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const meldung = error instanceof Error ? error.message : String(error)
        console.error('[useKurationNachladen] Nachladen fehlgeschlagen — es gilt der gespeicherte Report', meldung)
        setFehler(meldung)
      })
    return () => controller.abort()
  }, [libraryId, key, sourceIds, geladen])

  const basis = useMemo(
    () => (geladen === null || geladen.key !== key ? KEINE_BASIS : baueNachladeOverrides(geladen.eintraege)),
    [geladen, key],
  )

  return { basis, fehler: key === null ? null : fehler }
}
