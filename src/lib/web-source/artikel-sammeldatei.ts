/**
 * @fileoverview Sammeldatei fuer einen Webseiten-Artikel bauen (reine Funktion).
 *
 * @description
 * Dieselbe Form wie die Vortrags-Sammeldateien: `kind: composite-transcript`,
 * `_include_self: true` (der Artikeltext ist selbst Material), `_source_files`
 * (das heruntergeladene Audio/Video, wird transkribiert) und `_media_files`
 * (Medium und Coverbild als Fragmente am Twin — daraus rechnet die Pipeline
 * `audio_url` und `coverImageUrl`). Der Body traegt Titel, Herkunft und die
 * Artikelbloecke WOERTLICH; die Vorlage uebernimmt sie unveraendert. Flaches
 * Frontmatter, Obsidian-kompatibel, ueber den zentralen Serializer.
 *
 * @module web-source
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import type { WebPageExtract } from './page-extract'

export interface ArtikelSammeldateiInput {
  seite: WebPageExtract
  /** Dateiname des heruntergeladenen Mediums im selben Ordner, oder null ohne Medium. */
  medienDatei: string | null
  /** Dateiname des Coverbilds im selben Ordner, oder null ohne Bild. */
  coverDatei: string | null
  /** Dauer des Mediums in Sekunden, wenn bekannt. */
  medienDauerSekunden: number | null
  /** Embed-Adresse (YouTube/Vimeo/PeerTube), wenn die Seite ein einbettbares Video ist; sonst null. */
  videoEmbedUrl?: string | null
}

function dauerText(sekunden: number | null): string {
  if (sekunden === null || !Number.isFinite(sekunden) || sekunden <= 0) return ''
  const m = Math.floor(sekunden / 60)
  const s = Math.round(sekunden % 60)
  return `${m}:${String(s).padStart(2, '0')} min`
}

/** Markdown der Sammeldatei: Frontmatter + Body mit woertlichem Artikeltext. */
export function baueArtikelSammeldatei(input: ArtikelSammeldateiInput): string {
  const { seite, medienDatei, coverDatei, medienDauerSekunden } = input
  const videoEmbedUrl = input.videoEmbedUrl ?? null
  if (!seite.title.trim()) throw new Error('Seite ohne Titel — Sammeldatei nicht gebaut')
  if (seite.bloecke.length === 0) throw new Error('Seite ohne Artikeltext (keine Absaetze gefunden) — Sammeldatei nicht gebaut')

  const meta: Record<string, unknown> = {
    kind: 'composite-transcript',
    title: seite.title,
    _include_self: true,
    _source_files: medienDatei ? [medienDatei] : [],
    _media_files: [medienDatei, coverDatei].filter((v): v is string => typeof v === 'string' && v.length > 0),
    source_url: seite.url,
    source: seite.siteName,
    authors: seite.author ? [seite.author] : [],
    date: seite.datePublished,
    language: seite.language,
    ...(videoEmbedUrl ? { video_url: videoEmbedUrl } : {}),
  }

  const herkunft: string[] = []
  if (seite.siteName) herkunft.push(`Quelle: ${seite.siteName}`)
  if (seite.datePublished) herkunft.push(`Datum: ${seite.datePublished}`)
  if (seite.author) herkunft.push(`Autor: ${seite.author}`)
  herkunft.push(`Link: ${seite.url}`)

  const zeilen: string[] = [`# ${seite.title}`, '']
  // Die Kurzbeschreibung nur, wenn sie nicht schon der Vorspann des Artikels ist (sonst doppelt).
  const beschreibungImText = seite.bloecke.some((b) => b.trim() === seite.description.trim())
  if (seite.description && !beschreibungImText) zeilen.push(`*${seite.description}*`, '')
  zeilen.push(herkunft.join(' · '), '')
  zeilen.push('## Artikel', '')
  for (const block of seite.bloecke) zeilen.push(block, '')
  if (medienDatei) {
    const dauer = dauerText(medienDauerSekunden)
    zeilen.push('## Eingebettetes Medium', '')
    zeilen.push(`- Audio/Video: [[${medienDatei}]]${dauer ? ` (${dauer})` : ''}`)
    zeilen.push('')
  }
  if (videoEmbedUrl) {
    zeilen.push(`Video: ${videoEmbedUrl}`, '')
  }
  if (coverDatei) {
    zeilen.push(`Cover: [[${coverDatei}]]`, '')
  }
  return createMarkdownWithFrontmatter(zeilen.join('\n').trimEnd() + '\n', meta)
}

/** Dateiname ohne Endung, als Basis fuer Medium und Cover (`<Basis> - Audio.mp3`, `<Basis> - Cover.jpg`). */
export function basisName(dateiname: string): string {
  return dateiname.replace(/\.md$/i, '')
}
