/**
 * @fileoverview Sprecherliste eines Audio-Transkripts ins Frontmatter (P3a, C2).
 *
 * @description
 * Der Job-Weg speichert Transkripte ohne das Frontmatter des Secretary
 * (`stripAllFrontmatter`, „reines Transkript"); den Twin-Kern stempelt der
 * Writer spaeter per Patch. Die Sprecherliste aus `audio/process-diarized`
 * muss diesen Strip ueberleben — deshalb wird sie an den Speicherstellen
 * (Callback-Route, Extract-Only) NACH dem Strip als flaches Feld `speakers`
 * angelegt. Ohne Sprecher-Erkennung bleibt das Markdown unveraendert.
 *
 * Frontmatter nur ueber den zentralen Serializer (patchFrontmatter →
 * createMarkdownWithFrontmatter), siehe frontmatter-single-serializer.md.
 *
 * @module external-jobs
 */

import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { extractSecretaryAudioTranscript } from '@/lib/secretary/extract-audio-text'

/** Flaches Frontmatter-Feld fuer die Sprecherliste (snake_case, Obsidian-kompatibel). */
export const SPEAKERS_FRONTMATTER_KEY = 'speakers'

/**
 * Sprecher-Transkript aus einem Callback-Body (`{ phase, data }`), oder null,
 * wenn die Antwort keine Sprecher-Segmente traegt.
 */
export function extractSpeakerTranscript(callbackBody: unknown): { text: string; speakers: string[] } | null {
  const transcript = extractSecretaryAudioTranscript(callbackBody)
  if (transcript.speakers.length === 0) return null
  return transcript
}

/** Sprecherliste aus dem Callback-Body; leer ohne Sprecher-Erkennung. */
export function readAudioSpeakersFromCallback(callbackBody: unknown): string[] {
  return extractSpeakerTranscript(callbackBody)?.speakers ?? []
}

/** Haengt `speakers` als flaches Feld an; ohne Sprecher unveraendert. */
export function applySpeakersFrontmatter(markdown: string, speakers: string[]): string {
  if (speakers.length === 0) return markdown
  return patchFrontmatter(markdown, { [SPEAKERS_FRONTMATTER_KEY]: speakers })
}
