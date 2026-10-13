/**
 * @fileoverview Eingebettetes Medium einer Webseite aufloesen und herunterladen.
 *
 * @description
 * Der Secretary kennt yt-dlp (`POST /api/media/resolve`): er loest die
 * Seiten- oder Player-Adresse zur direkten Medienadresse auf, laedt aber
 * nichts. KnowledgeScout laedt die Datei hier selbst (Groessengrenze, Timeout)
 * und legt sie als Quelle ab. Kennt yt-dlp die Seite nicht, bleibt als
 * zweiter Weg die von der Seite selbst genannte Medienadresse (JSON-LD
 * contentUrl, `<audio src>`), wenn sie direkt Audio/Video liefert. Beides
 * scheitert laut mit Grund — nie ein leeres Ergebnis.
 *
 * @module web-source
 */

import { getSecretaryConfig } from '@/lib/env'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'

export interface ResolvedMedia {
  directUrl: string
  ext: string
  title: string
  /** Sekunden oder null. */
  duration: number | null
  istAudio: boolean
  httpHeaders: Record<string, string>
  extractor: string
}

export interface DownloadedMedia {
  buffer: Buffer
  mimeType: string
  ext: string
}

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
}

function extFromMime(mime: string): string | undefined {
  const m = mime.toLowerCase().split(';')[0].trim()
  const hit = Object.entries(MIME_BY_EXT).find(([, v]) => v === m)
  return hit?.[0]
}

/** Fragt den Secretary (yt-dlp) nach der direkten Medienadresse einer Seite. */
export async function resolveMediaViaSecretary(pageUrl: string): Promise<ResolvedMedia> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  if (!baseUrl) throw new Error('SECRETARY_SERVICE_URL fehlt — Medien koennen nicht aufgeloest werden')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
    headers['X-Secretary-Api-Key'] = apiKey
  }
  const res = await fetchWithTimeout(`${baseUrl}/media/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: pageUrl }),
    timeoutMs: 60_000,
  })
  const payload = (await res.json().catch(() => null)) as
    | { status?: string; data?: Record<string, unknown>; error?: { code?: string; message?: string } }
    | null
  if (!res.ok || !payload || payload.status !== 'success' || !payload.data) {
    const msg = payload?.error?.message ?? `HTTP ${res.status}`
    const code = payload?.error?.code ?? 'SECRETARY_ERROR'
    throw new Error(`Secretary media/resolve: [${code}] ${msg}`)
  }
  const d = payload.data
  const directUrl = typeof d['url'] === 'string' ? d['url'] : ''
  if (!directUrl) throw new Error('Secretary media/resolve: Antwort ohne direkte Medienadresse')
  const headersRaw = d['http_headers']
  const httpHeaders: Record<string, string> = {}
  if (headersRaw && typeof headersRaw === 'object') {
    for (const [k, v] of Object.entries(headersRaw as Record<string, unknown>)) if (typeof v === 'string') httpHeaders[k] = v
  }
  return {
    directUrl,
    ext: typeof d['ext'] === 'string' && d['ext'] ? d['ext'].toLowerCase() : 'bin',
    title: typeof d['title'] === 'string' ? d['title'] : '',
    duration: typeof d['duration'] === 'number' ? d['duration'] : null,
    istAudio: d['ist_audio'] === true,
    httpHeaders,
    extractor: typeof d['extractor'] === 'string' ? d['extractor'] : '',
  }
}

/** Laedt eine direkte Medienadresse in den Speicher (Groessengrenze, Timeout). */
export async function downloadMedia(
  directUrl: string,
  options: { ext?: string; httpHeaders?: Record<string, string>; maxBytes?: number; timeoutMs?: number } = {},
): Promise<DownloadedMedia> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const res = await fetchWithTimeout(directUrl, { headers: options.httpHeaders ?? {}, timeoutMs: options.timeoutMs ?? 10 * 60_000 })
  if (!res.ok) throw new Error(`Medien-Download HTTP ${res.status} fuer ${directUrl.slice(0, 120)}`)
  const contentType = res.headers.get('content-type') ?? ''
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > maxBytes) throw new Error(`Medium zu gross: ${declared} Bytes (Grenze ${maxBytes})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > maxBytes) throw new Error(`Medium zu gross: ${buffer.length} Bytes (Grenze ${maxBytes})`)
  if (buffer.length === 0) throw new Error('Medien-Download lieferte 0 Bytes')
  const ext = options.ext && options.ext !== 'bin' ? options.ext : (extFromMime(contentType) ?? 'bin')
  const mimeType = MIME_BY_EXT[ext] ?? (contentType.split(';')[0].trim() || 'application/octet-stream')
  if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
    throw new Error(`Heruntergeladen ist kein Audio/Video (Content-Type "${contentType || 'unbekannt'}", Endung "${ext}")`)
  }
  return { buffer, mimeType, ext }
}

/** Zweiter Weg ohne yt-dlp: eine von der Seite genannte Adresse, wenn sie direkt Audio/Video liefert. */
export async function downloadDeclaredMedia(mediaUrl: string, pageUrl: string, maxBytes?: number): Promise<DownloadedMedia> {
  return downloadMedia(mediaUrl, { httpHeaders: { Referer: pageUrl }, maxBytes })
}
