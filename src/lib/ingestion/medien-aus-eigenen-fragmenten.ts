/**
 * @fileoverview Audio und Cover aus den eigenen Binaerfragmenten eines Twins rechnen.
 *
 * @description
 * „Webseite als Quelle": Die Sammeldatei traegt Medium und Coverbild in
 * `_media_files`; die Transformation registriert sie als Fragmente am Twin
 * der Sammeldatei (Blob-Adresse). Der Ingest rechnet daraus — wie bei Folien
 * und Anhaengen — die Lesersicht: `audio_url` aus dem ersten Audio-Fragment
 * (Dateiname oder MIME), das Cover aus einem Bild-Fragment `cover.*` oder
 * `<irgendwas>.cover.*`. Reine Auswahlfunktionen (testbar ohne Mongo) plus
 * ein Lader. Nichts gefunden = null, der Aufrufer meldet es im Trace.
 *
 * @module ingestion
 */

import { getShadowTwinBinaryFragments, type MongoBinaryFragment } from '@/lib/repositories/shadow-twin-repo'

export interface EigenesFragment {
  name: string
  url: string
}

const AUDIO_ENDUNG = /\.(mp3|m4a|wav|ogg|opus|flac)$/i
const VIDEO_ENDUNG = /\.(mp4|webm|mov|mkv)$/i
const COVER_NAME = /(^|\.)cover\.(jpe?g|png|webp)$/i

/** Erstes Audio-Fragment (Original-Variante) — oder null. */
export function waehleAudio(fragmente: ReadonlyArray<MongoBinaryFragment>): EigenesFragment | null {
  const hit = fragmente.find(
    (f) => !!f.url && f.variant !== 'thumbnail' && (f.kind === 'audio' || f.mimeType?.startsWith('audio/') || AUDIO_ENDUNG.test(f.name)),
  )
  return hit?.url ? { name: hit.name, url: hit.url } : null
}

/** Erstes Video-Fragment (Original-Variante) — oder null. */
export function waehleVideo(fragmente: ReadonlyArray<MongoBinaryFragment>): EigenesFragment | null {
  const hit = fragmente.find(
    (f) => !!f.url && f.variant !== 'thumbnail' && (f.kind === 'video' || f.mimeType?.startsWith('video/') || VIDEO_ENDUNG.test(f.name)),
  )
  return hit?.url ? { name: hit.name, url: hit.url } : null
}

/** Bild-Fragment mit Cover-Namen (`cover.jpg`, `<Basis>.cover.jpg`) — oder null. */
export function waehleCoverFragment(fragmente: ReadonlyArray<MongoBinaryFragment>): EigenesFragment | null {
  const hit = fragmente.find((f) => !!f.url && f.variant !== 'thumbnail' && COVER_NAME.test(f.name))
  return hit?.url ? { name: hit.name, url: hit.url } : null
}

export interface MedienAusEigenenFragmenten {
  audio: EigenesFragment | null
  video: EigenesFragment | null
  cover: EigenesFragment | null
}

/** Laedt die Fragmente des Twins und waehlt Audio, Video und Cover. */
export async function medienAusEigenenFragmenten(libraryId: string, fileId: string): Promise<MedienAusEigenenFragmenten> {
  const fragmente = (await getShadowTwinBinaryFragments(libraryId, fileId)) ?? []
  return { audio: waehleAudio(fragmente), video: waehleVideo(fragmente), cover: waehleCoverFragment(fragmente) }
}
