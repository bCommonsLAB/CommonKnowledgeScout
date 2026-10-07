/**
 * @fileoverview Korrekturvorschlag vom Secretary holen (P3b, nutzt P2).
 *
 * @description
 * Aufruf von `POST /api/transcript/korrekturvorschlag` (Vertrag:
 * `docs/_secretary-service-docu/transcript.md`). Der Secretary liefert nur
 * Vorschlaege; geschrieben wird erst nach Bestaetigung ueber `apply`.
 * Fehlercodes des Secretary (`MISSING_TRANSKRIPT`, `INPUT_TOO_LARGE`,
 * `NO_MODEL_CONFIGURED`, …) werden als `SecretaryVorschlagError` mit Status
 * und Code weitergereicht, nicht in „Unerwarteter Fehler" verwandelt.
 *
 * Typen sind bewusst client-tauglich (der Reiter importiert sie), die
 * Funktion selbst laeuft nur auf dem Server (`getSecretaryConfig`).
 *
 * @module transkript-korrektur
 */

import { getSecretaryConfig } from '@/lib/env'
import type { Begleittext } from './laden'

/** Grenze des Secretary (413) — vorab gemessen, damit die Meldung die Zahl nennt. */
export const VORSCHLAG_MAX_ZEICHEN = 600_000

export interface VorschlagErsetzung {
  alt: string
  neu: string
  zeile: number
  kontext: string
  begruendung: string
  /** `einladung`, `folie <N>`, `selbstvorstellung`, `unsicher` */
  beleg: string
}

export interface VorschlagSprecher {
  label: string
  name: string
  begruendung: string
  beleg: string
}

export interface Korrekturvorschlag {
  ersetzungen: VorschlagErsetzung[]
  sprecher: VorschlagSprecher[]
  verworfen: string[]
  modell: string | null
  tokens: number | null
  dauer_ms: number | null
}

export class SecretaryVorschlagError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'SecretaryVorschlagError'
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Antwort streng lesen — fehlende Listen sind leer, fremde Eintraege fallen weg. */
export function parseKorrekturvorschlag(raw: unknown): Korrekturvorschlag {
  const wurzel = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const data = wurzel['data'] && typeof wurzel['data'] === 'object' ? (wurzel['data'] as Record<string, unknown>) : wurzel
  const ersetzungen = (Array.isArray(data['ersetzungen']) ? data['ersetzungen'] : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      alt: str(e['alt']), neu: str(e['neu']), zeile: num(e['zeile']), kontext: str(e['kontext']),
      begruendung: str(e['begruendung']), beleg: str(e['beleg']) || 'unsicher',
    }))
    .filter((e) => e.alt !== '' && e.neu !== '')
  const sprecher = (Array.isArray(data['sprecher']) ? data['sprecher'] : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ label: str(e['label']), name: str(e['name']), begruendung: str(e['begruendung']), beleg: str(e['beleg']) || 'unsicher' }))
    .filter((e) => e.label !== '')
  const verworfen = (Array.isArray(data['verworfen']) ? data['verworfen'] : []).filter((v): v is string => typeof v === 'string')
  return {
    ersetzungen, sprecher, verworfen,
    modell: typeof data['modell'] === 'string' ? data['modell'] : null,
    tokens: typeof data['tokens'] === 'number' ? data['tokens'] : null,
    dauer_ms: typeof data['dauer_ms'] === 'number' ? data['dauer_ms'] : null,
  }
}

export interface VorschlagAnfrage {
  transkript: string
  begleittexte: Begleittext[]
  zielsprache: string
  /** Tests injizieren einen Fetch. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function holeKorrekturvorschlag(args: VorschlagAnfrage): Promise<Korrekturvorschlag> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  const url = `${baseUrl}/transcript/korrekturvorschlag`
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
    headers['X-Secretary-Api-Key'] = apiKey
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 180_000)
  try {
    const res = await (args.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transkript: args.transkript, begleittexte: args.begleittexte, zielsprache: args.zielsprache }),
      signal: controller.signal,
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const err = json && typeof json === 'object' ? (json as { error?: { code?: unknown; message?: unknown } }).error : undefined
      const code = typeof err?.code === 'string' ? err.code : `HTTP_${res.status}`
      const message = typeof err?.message === 'string' ? err.message : `Secretary antwortete mit ${res.status}`
      throw new SecretaryVorschlagError(res.status, code, message)
    }
    return parseKorrekturvorschlag(json)
  } catch (error) {
    if (error instanceof SecretaryVorschlagError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SecretaryVorschlagError(504, 'TIMEOUT', 'Der Secretary hat nicht rechtzeitig geantwortet')
    }
    throw new SecretaryVorschlagError(502, 'SECRETARY_UNREACHABLE', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }
}
