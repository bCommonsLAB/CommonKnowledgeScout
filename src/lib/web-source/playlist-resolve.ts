/**
 * @fileoverview Playlist (YouTube, Vimeo, PeerTube …) ueber den Secretary aufloesen (Welle K1).
 *
 * @description
 * `POST /api/media/playlist` (Welle S im Secretary) liest die Playlist flach
 * (yt-dlp `extract_flat: 'in_playlist'`) und liefert Titel, Besitzer,
 * Beschreibung, Anzahl und die Eintraege mit Position, Id, Adresse, Titel und
 * Dauer. Private oder geloeschte Eintraege stehen MIT GRUND in der Liste, sie
 * fallen nicht still weg. Fehlt die Route (aelterer Secretary), ist die Seite
 * unbekannt oder die Liste leer, scheitert der Aufruf laut mit Grund.
 *
 * @module web-source
 */

import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { secretaryFehler, secretaryHeaders } from './media-resolve'

export interface PlaylistEintrag {
  /** 1-basiert, Reihenfolge der Playlist. */
  position: number
  id: string
  url: string
  title: string
  /** Sekunden oder null (flache Liste kennt sie nicht immer). */
  duration: number | null
  /** Gesetzt, wenn der Eintrag nicht abrufbar ist (privat, geloescht, gesperrt) — bleibt in der Liste. */
  grund: string | null
}

export interface ResolvedPlaylist {
  url: string
  title: string
  uploader: string
  description: string
  anzahl: number
  entries: PlaylistEintrag[]
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Liest `data` der Secretary-Antwort typgeprueft; leere Liste und fehlende Felder sind Fehler. */
export function parsePlaylistAntwort(data: unknown, url: string): ResolvedPlaylist {
  if (!data || typeof data !== 'object') throw new Error('Secretary media/playlist: Antwort ohne data')
  const d = data as Record<string, unknown>
  const rawEntries = d['entries']
  if (!Array.isArray(rawEntries)) throw new Error('Secretary media/playlist: Antwort ohne entries')
  const entries: PlaylistEintrag[] = []
  rawEntries.forEach((e, index) => {
    if (!e || typeof e !== 'object') throw new Error(`Secretary media/playlist: Eintrag ${index + 1} ist kein Objekt`)
    const o = e as Record<string, unknown>
    const position = typeof o['position'] === 'number' && Number.isInteger(o['position']) && o['position'] > 0 ? o['position'] : index + 1
    const grund = asText(o['grund']) || (o['verfuegbar'] === false ? 'nicht verfuegbar (ohne Grund vom Secretary)' : '')
    const id = asText(o['id'])
    const entryUrl = asText(o['url'])
    if (!grund && (!id || !entryUrl)) throw new Error(`Secretary media/playlist: Eintrag ${position} ohne id/url und ohne Grund`)
    entries.push({
      position, id, url: entryUrl,
      title: asText(o['title']) || (grund ? '(ohne Titel)' : id),
      duration: typeof o['duration'] === 'number' && Number.isFinite(o['duration']) ? o['duration'] : null,
      grund: grund || null,
    })
  })
  if (entries.length === 0) throw new Error(`Playlist ist leer oder nicht lesbar (privat?): ${url}`)
  const anzahl = typeof d['anzahl'] === 'number' ? d['anzahl'] : entries.length
  return { url, title: asText(d['title']), uploader: asText(d['uploader']), description: asText(d['description']), anzahl, entries }
}

/** Fragt den Secretary (yt-dlp, flach) nach den Eintraegen einer Playlist. */
export async function resolvePlaylistViaSecretary(url: string): Promise<ResolvedPlaylist> {
  const { baseUrl, headers } = secretaryHeaders()
  const res = await fetchWithTimeout(`${baseUrl}/media/playlist`, { method: 'POST', headers, body: JSON.stringify({ url }), timeoutMs: 55_000 })
  if (res.status === 404 || res.status === 405) {
    throw new Error('Secretary kennt POST /api/media/playlist nicht — Welle S (CommonSecretaryServices) ist dort noch nicht ausgerollt')
  }
  if (!res.ok) throw await secretaryFehler(res, 'media/playlist')
  const payload = (await res.json().catch(() => null)) as { status?: string; data?: unknown } | null
  if (!payload || payload.status !== 'success') throw new Error('Secretary media/playlist: Antwort ohne status success')
  return parsePlaylistAntwort(payload.data, url)
}
