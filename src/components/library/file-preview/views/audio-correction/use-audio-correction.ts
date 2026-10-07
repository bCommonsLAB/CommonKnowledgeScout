'use client'

/**
 * Daten und Aktionen des Reiters „Korrektur" (P3b): Zustand des Transkripts
 * (GET), Begleitquellen desselben Ordners (Provider + batch-resolve),
 * Vorschlaege holen (suggest), Vorschau und Schreiben (POST). Fehler werden
 * als Text gehalten und angezeigt, nie verschluckt.
 */

import * as React from 'react'
import { getMediaKind } from '@/lib/media-types'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { TranskriptZustand } from '@/lib/transkript-korrektur/laden'
import type { Korrekturvorschlag } from '@/lib/transkript-korrektur/vorschlag'
import {
  applyBody,
  ersetzungenAusVorschlag,
  sprecherZeilen,
  type ApplyAntwort,
  type BegleitQuelle,
  type ErsetzungZeile,
  type SprecherZeile,
} from './audio-correction-types'

async function lesen<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string }
  if (!res.ok) {
    const code = json.code ? ` [${json.code}]` : ''
    throw new Error(`${json.error || `HTTP ${res.status}`}${code}`)
  }
  return json
}

export interface AudioCorrectionArgs {
  libraryId: string
  sourceId: string
  parentId: string
  provider: StorageProvider | null
  enabled: boolean
}

export function useAudioCorrection(args: AudioCorrectionArgs) {
  const { libraryId, sourceId, parentId, provider, enabled } = args
  const [zustand, setZustand] = React.useState<TranskriptZustand | null>(null)
  const [ladeFehler, setLadeFehler] = React.useState<string | null>(null)
  const [quellen, setQuellen] = React.useState<BegleitQuelle[]>([])
  const [vorschlag, setVorschlag] = React.useState<Korrekturvorschlag | null>(null)
  const [ersetzungen, setErsetzungen] = React.useState<ErsetzungZeile[]>([])
  const [sprecher, setSprecher] = React.useState<SprecherZeile[]>([])
  const [begruendung, setBegruendung] = React.useState('')
  const [laeuft, setLaeuft] = React.useState<'vorschlag' | 'vorschau' | 'schreiben' | null>(null)
  const [aktionsFehler, setAktionsFehler] = React.useState<string | null>(null)
  const [ergebnis, setErgebnis] = React.useState<ApplyAntwort | null>(null)

  const ladeZustand = React.useCallback(async () => {
    const res = await fetch(`/api/library/${libraryId}/transcript-correction?sourceId=${encodeURIComponent(sourceId)}`, { cache: 'no-store' })
    const z = await lesen<TranskriptZustand>(res)
    setZustand(z)
    setSprecher((alt) => (alt.length ? alt : sprecherZeilen(z, null)))
    return z
  }, [libraryId, sourceId])

  const ladeQuellen = React.useCallback(async () => {
    if (!provider) return
    const items = await provider.listItemsById(parentId)
    const kandidaten = items.filter((it: StorageItem) => it.type === 'file' && it.id !== sourceId)
      .filter((it) => ['pdf', 'markdown', 'docx', 'pptx'].includes(getMediaKind(it)))
    const res = await fetch(`/api/library/${libraryId}/artifacts/batch-resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: kandidaten.map((it) => ({ sourceId: it.id, sourceName: it.metadata.name, parentId })), includeBoth: true, preferredKind: 'transcript' }),
    })
    const json = await lesen<{ transcripts?: Record<string, unknown>; artifacts?: Record<string, unknown> }>(res)
    const transkripte = json.transcripts ?? json.artifacts ?? {}
    setQuellen(kandidaten.map((it) => {
      const hat = !!transkripte[it.id]
      return { id: it.id, name: it.metadata.name, hatTranskript: hat, gewaehlt: hat && getMediaKind(it) === 'pdf' }
    }))
  }, [libraryId, parentId, provider, sourceId])

  React.useEffect(() => {
    if (!enabled) return
    let aktiv = true
    setLadeFehler(null)
    Promise.all([ladeZustand(), ladeQuellen()]).catch((e: unknown) => {
      if (aktiv) setLadeFehler(e instanceof Error ? e.message : String(e))
    })
    return () => { aktiv = false }
  }, [enabled, ladeZustand, ladeQuellen])

  const holeVorschlaege = React.useCallback(async () => {
    if (!zustand) return
    setLaeuft('vorschlag')
    setAktionsFehler(null)
    try {
      const res = await fetch(`/api/library/${libraryId}/transcript-correction/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, begleitSourceIds: quellen.filter((q) => q.gewaehlt).map((q) => q.id), zielsprache: 'de' }),
      })
      const v = await lesen<Korrekturvorschlag>(res)
      setVorschlag(v)
      setErsetzungen((alt) => [...ersetzungenAusVorschlag(v), ...alt.filter((z) => z.quelle === 'hand')])
      setSprecher(sprecherZeilen(zustand, v))
    } catch (e) {
      setAktionsFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setLaeuft(null)
    }
  }, [libraryId, sourceId, quellen, zustand])

  const anwenden = React.useCallback(async (nurVorschau: boolean) => {
    if (!zustand) return
    setLaeuft(nurVorschau ? 'vorschau' : 'schreiben')
    setAktionsFehler(null)
    try {
      const res = await fetch(`/api/library/${libraryId}/transcript-correction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyBody({ sourceId, ersetzungen, sprecher, begruendung, ifUpdatedAt: zustand.updatedAt, nurVorschau })),
      })
      const antwort = await lesen<ApplyAntwort>(res)
      setErgebnis(antwort)
      if (!nurVorschau) {
        setErsetzungen([])
        setSprecher([])
        setVorschlag(null)
        await ladeZustand()
      }
      return antwort
    } catch (e) {
      setAktionsFehler(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLaeuft(null)
    }
  }, [libraryId, sourceId, ersetzungen, sprecher, begruendung, zustand, ladeZustand])

  return {
    zustand, ladeFehler, quellen, setQuellen, vorschlag, ersetzungen, setErsetzungen, sprecher, setSprecher,
    begruendung, setBegruendung, laeuft, aktionsFehler, ergebnis, holeVorschlaege, anwenden,
  }
}

export type AudioCorrectionState = ReturnType<typeof useAudioCorrection>

/** Nur der Zustand (fuer das Badge „ueberholt" im Reiter Transformation). */
export function useTranscriptRevision(libraryId: string, sourceId: string, enabled: boolean): string | null {
  const [revisedAt, setRevisedAt] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!enabled) { setRevisedAt(null); return }
    let aktiv = true
    fetch(`/api/library/${libraryId}/transcript-correction?sourceId=${encodeURIComponent(sourceId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((z: { revisedAt?: string | null } | null) => { if (aktiv) setRevisedAt(z?.revisedAt ?? null) })
      .catch(() => { if (aktiv) setRevisedAt(null) })
    return () => { aktiv = false }
  }, [libraryId, sourceId, enabled])
  return revisedAt
}
