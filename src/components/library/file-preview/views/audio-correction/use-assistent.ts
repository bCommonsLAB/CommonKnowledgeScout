'use client'

/**
 * Korrektur-Assistent im Client: Vorschlaege holen (`POST …/suggest` mit dem
 * sichtbaren Auftrag), offene Vorschlaege halten, nach Uebernehmen/Verwerfen
 * entfernen. Offene Vorschlaege und ein geaenderter Auftrag bleiben pro
 * Betrachter im Browser (localStorage), damit ein Neuladen keine bezahlte
 * KI-Antwort wegwirft — Bequemlichkeit, keine Ablage (die Wahrheit ist das
 * gespeicherte Transkript).
 */

import * as React from 'react'
import { STANDARD_AUFTRAG } from '@/lib/transkript-korrektur/assistent-auftrag'
import type { AssistentErgebnis, KorrekturVorschlag, SprecherVorschlag } from '@/lib/transkript-korrektur/assistent-pruefung'

export interface AssistentLaufInfo {
  modell: string
  tokens: number | null
  dauerMs: number
}

type Offen = AssistentErgebnis & { info: AssistentLaufInfo | null }

const LEER: Offen = { korrekturen: [], sprecher: [], verworfen: [], info: null }

function lies<T>(key: string): T | null {
  try {
    const roh = window.localStorage.getItem(key)
    return roh ? (JSON.parse(roh) as T) : null
  } catch {
    return null
  }
}
function schreib(key: string, wert: unknown): void {
  try {
    if (wert === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(wert))
  } catch {
    // Browser-Speicher nicht verfuegbar (privates Fenster): Vorschlaege gelten dann nur bis zum Neuladen.
  }
}

export function useAssistent(libraryId: string, sourceId: string) {
  const offenKey = `ks.korrektur.vorschlaege.${libraryId}.${sourceId}`
  const auftragKey = `ks.korrektur.auftrag.${libraryId}`
  const [offen, setOffen] = React.useState<Offen>(LEER)
  const [auftrag, setAuftragState] = React.useState(STANDARD_AUFTRAG)
  const [laeuft, setLaeuft] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)

  React.useEffect(() => {
    setOffen(lies<Offen>(offenKey) ?? LEER)
    setAuftragState(lies<string>(auftragKey) ?? STANDARD_AUFTRAG)
  }, [offenKey, auftragKey])

  const setze = React.useCallback((neu: Offen) => {
    setOffen(neu)
    schreib(offenKey, neu.korrekturen.length + neu.sprecher.length > 0 ? neu : null)
  }, [offenKey])

  const setAuftrag = React.useCallback((text: string) => {
    setAuftragState(text)
    schreib(auftragKey, text === STANDARD_AUFTRAG ? null : text)
  }, [auftragKey])

  const hole = React.useCallback(async (begleitSourceIds: string[]): Promise<boolean> => {
    setLaeuft(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/library/${libraryId}/transcript-correction/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, begleitSourceIds, auftrag }),
      })
      const json = (await res.json().catch(() => ({}))) as Partial<AssistentErgebnis & AssistentLaufInfo> & { error?: string }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setze({
        korrekturen: json.korrekturen ?? [], sprecher: json.sprecher ?? [], verworfen: json.verworfen ?? [],
        info: { modell: json.modell ?? '?', tokens: json.tokens ?? null, dauerMs: json.dauerMs ?? 0 },
      })
      return true
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setLaeuft(false)
    }
  }, [libraryId, sourceId, auftrag, setze])

  const entferneKorrektur = React.useCallback((id: string) => {
    setze({ ...offen, korrekturen: offen.korrekturen.filter((k) => k.id !== id) })
  }, [offen, setze])

  const entferneSprecher = React.useCallback((id: string) => {
    setze({ ...offen, sprecher: offen.sprecher.filter((s) => s.id !== id) })
  }, [offen, setze])

  /** Nach einer gespeicherten Satzaenderung: Vorschlaege fuer diesen Satz, deren alter Text weg ist, verwerfen. */
  const bereinigeSatz = React.useCallback((satz: number, neuerText: string) => {
    const bleibt = offen.korrekturen.filter((k) => k.satz !== satz || neuerText.includes(k.alt))
    if (bleibt.length !== offen.korrekturen.length) setze({ ...offen, korrekturen: bleibt })
  }, [offen, setze])

  const korrekturenJeSatz = React.useMemo(() => {
    const m = new Map<number, KorrekturVorschlag[]>()
    for (const k of offen.korrekturen) m.set(k.satz, [...(m.get(k.satz) ?? []), k])
    return m
  }, [offen.korrekturen])

  const sprecherJeSatz = React.useMemo(() => new Map<number, SprecherVorschlag>(offen.sprecher.map((s) => [s.abSatz, s])), [offen.sprecher])

  return {
    offen, auftrag, setAuftrag, laeuft, fehler, hole, entferneKorrektur, entferneSprecher, bereinigeSatz,
    korrekturenJeSatz, sprecherJeSatz, verwerfeAlle: () => setze(LEER),
  }
}

export type AssistentState = ReturnType<typeof useAssistent>
