'use client'

/**
 * Audio der Quelle im Reiter „Korrektur": Streaming-URL ueber den Provider
 * (UI kennt das Backend nicht), Sprung an eine Stelle und die aktuelle
 * Abspielzeit, damit die Satzliste den laufenden Satz hervorheben kann.
 *
 * Die Satzzeiten von gpt-transcribe sind geschaetzt (15–30 s daneben); der
 * Sprung setzt deshalb etwas frueher an (`VORLAUF_SEKUNDEN`).
 */

import * as React from 'react'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

export const VORLAUF_SEKUNDEN = 5

export interface AudioSprung {
  url: string | null
  fehler: string | null
  audioRef: React.RefObject<HTMLAudioElement>
  /** Aktuelle Abspielposition in Sekunden (fuer den hervorgehobenen Satz). */
  zeit: number
  springe: (sekunden: number) => void
  /** Relativ spulen (z. B. -5 / +5 s), um Ton und Satz abzugleichen. */
  verschiebe: (deltaSekunden: number) => void
}

export function useAudioSprung(provider: StorageProvider | null, sourceId: string): AudioSprung {
  const [url, setUrl] = React.useState<string | null>(null)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [zeit, setZeit] = React.useState(0)
  const audioRef = React.useRef<HTMLAudioElement>(null)

  React.useEffect(() => {
    if (!provider) return
    let aktiv = true
    setUrl(null)
    setFehler(null)
    provider.getStreamingUrl(sourceId)
      .then((u) => { if (aktiv) setUrl(u) })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        FileLogger.warn('audio-correction', 'Audio-URL nicht ladbar', { sourceId, error: message })
        if (aktiv) setFehler(message)
      })
    return () => { aktiv = false }
  }, [provider, sourceId])

  React.useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setZeit(el.currentTime)
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [url])

  const springe = React.useCallback((sekunden: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.max(0, sekunden - VORLAUF_SEKUNDEN)
    void el.play().catch((e: unknown) => {
      FileLogger.warn('audio-correction', 'Abspielen nicht moeglich', { error: e instanceof Error ? e.message : String(e) })
    })
  }, [])

  const verschiebe = React.useCallback((delta: number) => {
    const el = audioRef.current
    if (!el) return
    const ziel = el.currentTime + delta
    el.currentTime = Math.max(0, Number.isFinite(el.duration) ? Math.min(ziel, el.duration) : ziel)
  }, [])

  return { url, fehler, audioRef, zeit, springe, verschiebe }
}
