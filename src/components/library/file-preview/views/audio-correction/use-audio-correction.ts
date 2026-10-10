'use client'

/**
 * Daten der Korrektur-Ansicht: Zustand des Transkripts mit Satz-Segmenten
 * (GET) und die Begleitquellen desselben Ordners (Provider + batch-resolve)
 * fuer den Korrektur-Assistenten. Schreiben laeuft satzweise ueber
 * `useSatzSpeichern`; Vorschlaege ueber `useAssistent`. Fehler werden als Text
 * gehalten und angezeigt, nie verschluckt.
 */

import * as React from 'react'
import { FileLogger } from '@/lib/debug/logger'
import { getMediaKind } from '@/lib/media-types'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { TranskriptZustand } from '@/lib/transkript-korrektur/laden'
import type { SegmenteStand } from './audio-correction-lesen'

async function lesen<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string }
  if (!res.ok) {
    const code = json.code ? ` [${json.code}]` : ''
    throw new Error(`${json.error || `HTTP ${res.status}`}${code}`)
  }
  return json
}

/** GET-Antwort: Zustand plus Satz-Segmente des letzten Laufs (null = keine gespeichert). */
export type KorrekturZustand = TranskriptZustand & { segmente: SegmenteStand | null }

export interface BegleitQuelle {
  id: string
  name: string
  hatTranskript: boolean
  gewaehlt: boolean
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
  const [zustand, setZustand] = React.useState<KorrekturZustand | null>(null)
  const [ladeFehler, setLadeFehler] = React.useState<string | null>(null)
  const [quellen, setQuellen] = React.useState<BegleitQuelle[]>([])

  const ladeZustand = React.useCallback(async () => {
    const res = await fetch(`/api/library/${libraryId}/transcript-correction?sourceId=${encodeURIComponent(sourceId)}`, { cache: 'no-store' })
    setZustand(await lesen<KorrekturZustand>(res))
  }, [libraryId, sourceId])

  const ladeQuellen = React.useCallback(async () => {
    if (!provider) return
    const items = await provider.listItemsById(parentId)
    const kandidaten = items.filter((it: StorageItem) => it.type === 'file' && it.id !== sourceId)
      .filter((it) => ['pdf', 'markdown', 'docx', 'pptx'].includes(getMediaKind(it)))
    // Keine Kandidaten im Ordner: nichts aufzuloesen (batch-resolve lehnt leere Listen ab).
    if (kandidaten.length === 0) {
      FileLogger.debug('audio-correction', 'Keine Begleitquellen im Ordner', { parentId, items: items.length })
      setQuellen([])
      return
    }
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

  return { zustand, setZustand, ladeFehler, quellen, setQuellen }
}

export type AudioCorrectionState = ReturnType<typeof useAudioCorrection>

/** Revisionsstand fuer das Badge „ueberholt" im Reiter Transformation (Server leitet ab, kein Feld). */
export interface TranscriptRevisionInfo {
  revisedAt: string | null
  ueberholt: boolean
}

export function useTranscriptRevision(libraryId: string, sourceId: string, enabled: boolean, tick = 0): TranscriptRevisionInfo {
  const [info, setInfo] = React.useState<TranscriptRevisionInfo>({ revisedAt: null, ueberholt: false })
  React.useEffect(() => {
    if (!enabled) { setInfo({ revisedAt: null, ueberholt: false }); return }
    let aktiv = true
    fetch(`/api/library/${libraryId}/transcript-correction?sourceId=${encodeURIComponent(sourceId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((z: { revisedAt?: string | null; ueberholt?: boolean } | null) => {
        if (aktiv) setInfo({ revisedAt: z?.revisedAt ?? null, ueberholt: z?.ueberholt === true })
      })
      .catch((e: unknown) => {
        FileLogger.warn('audio-correction', 'Revisionsstand nicht lesbar', { sourceId, error: e instanceof Error ? e.message : String(e) })
        if (aktiv) setInfo({ revisedAt: null, ueberholt: false })
      })
    return () => { aktiv = false }
  }, [libraryId, sourceId, enabled, tick])
  return info
}
