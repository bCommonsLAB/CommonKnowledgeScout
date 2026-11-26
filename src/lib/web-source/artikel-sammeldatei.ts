/**
 * @fileoverview Sammeldatei fuer einen Webseiten-Artikel bauen (reine Funktion).
 *
 * @description
 * Dieselbe Form wie die Vortrags-Sammeldateien: `kind: composite-transcript`,
 * `_include_self: true` (der Artikeltext ist selbst Material), `_source_files`
 * (das heruntergeladene Audio/Video, wird transkribiert — oder die Untertitel-Datei,
 * deren Twin das Transkript schon traegt) und `_media_files`
 * (Medium und Coverbild als Fragmente am Twin — daraus rechnet die Pipeline
 * `audio_url` und `coverImageUrl`). Der Body traegt Titel, Herkunft und die
 * Artikelbloecke WOERTLICH; die Vorlage uebernimmt sie unveraendert. Flaches
 * Frontmatter, Obsidian-kompatibel, ueber den zentralen Serializer.
 *
 * @module web-source
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { zeitmarke, type MediaKapitel } from './media-metadata'
import type { WebPageExtract } from './page-extract'
import type { SeitenLink } from './seite-links'

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
  /**
   * false = das Medium bleibt reine Quelle fuer die Transkription (nur `_source_files`),
   * bekommt keine Blob-Adresse und keinen Player, kein Video-Embed — im Eintrag nur
   * Vorschaubild und Link zum Original (rechtliche Vorgabe des Owners). Default true.
   */
  medienEinbetten?: boolean
  /** Welle K2: Kapitel mit Zeitmarken aus yt-dlp, wenn vorhanden. */
  kapitel?: MediaKapitel[]
  /**
   * Welle K2: true, wenn die Seite eine Videoseite ohne Beschreibung ist — dann ist
   * das Transkript das Material und ein leerer Body kein Fehler. Default false.
   */
  ohneTextErlaubt?: boolean
  /**
   * Modus `struktur`: die Seite woertlich als Markdown (Listen, Tabellen) und ihre Links.
   * Tritt an die Stelle des Abschnitts „Artikel"; ein leerer Artikeltext ist dann kein Fehler.
   */
  struktur?: { markdown: string; links: SeitenLink[] }
  /**
   * Weg `transkript: "untertitel"`: die Untertitel-Datei im selben Ordner tritt als Quelle an die
   * Stelle des Mediums (ihr Twin traegt das Transkript); `herkunft` nennt Anbieter, Art, Sprache, Abruf.
   */
  untertitel?: { datei: string; herkunft: string } | null
}

/** Ueberschriften der Seite um zwei Ebenen tiefer setzen — `#` und `##` gehoeren der Sammeldatei. */
export function stufeUeberschriftenAb(markdown: string): string {
  return markdown.replace(/^(#{1,6}) /gm, (_m, rauten: string) => `${'#'.repeat(Math.min(6, rauten.length + 2))} `)
}

/** Verlinkte Dateien (PDF, Dokument, Medium) als Liste, je Adresse einmal, in Lesereihenfolge. */
export function verlinkteDateien(links: SeitenLink[]): string[] {
  const gesehen = new Set<string>()
  const zeilen: string[] = []
  for (const l of links) {
    if ((l.art !== 'pdf' && l.art !== 'dokument' && l.art !== 'medium') || gesehen.has(l.url)) continue
    gesehen.add(l.url)
    const kontext = l.kontext && l.kontext !== l.text ? ` — ${l.kontext}` : ''
    zeilen.push(`- ${l.art}: [${(l.text || l.url).replace(/[[\]]/g, '\\$&')}](${l.url})${kontext}`)
  }
  return zeilen
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
  const einbetten = input.medienEinbetten !== false
  const videoEmbedUrl = einbetten ? (input.videoEmbedUrl ?? null) : null
  if (!seite.title.trim()) throw new Error('Seite ohne Titel — Sammeldatei nicht gebaut')
  if (seite.bloecke.length === 0 && input.ohneTextErlaubt !== true && !input.struktur) {
    throw new Error('Seite ohne Artikeltext (keine Absaetze gefunden) — Sammeldatei nicht gebaut')
  }
  const kapitel = input.kapitel ?? []

  const meta: Record<string, unknown> = {
    kind: 'composite-transcript',
    title: seite.title,
    _include_self: true,
    _source_files: [medienDatei, input.untertitel?.datei].filter((v): v is string => typeof v === 'string' && v.length > 0),
    _media_files: [einbetten ? medienDatei : null, coverDatei].filter((v): v is string => typeof v === 'string' && v.length > 0),
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
  if (input.struktur) {
    zeilen.push('## Seite', '', stufeUeberschriftenAb(input.struktur.markdown), '')
    const dateien = verlinkteDateien(input.struktur.links)
    if (dateien.length > 0) zeilen.push('## Verlinkte Dateien', '', ...dateien, '')
  } else if (seite.bloecke.length > 0) {
    zeilen.push('## Artikel', '')
    for (const block of seite.bloecke) zeilen.push(block, '')
  }
  if (kapitel.length > 0) {
    zeilen.push('## Kapitel', '')
    for (const k of kapitel) zeilen.push(`- ${zeitmarke(k.start)} ${k.titel}`)
    zeilen.push('')
  }
  if (medienDatei) {
    const dauer = dauerText(medienDauerSekunden)
    zeilen.push(einbetten ? '## Eingebettetes Medium' : '## Medium (nur Quelle, nicht eingebettet)', '')
    zeilen.push(`- Audio/Video: [[${medienDatei}]]${dauer ? ` (${dauer})` : ''}`)
    zeilen.push('')
  }
  if (input.untertitel) {
    zeilen.push('## Transkript aus Untertiteln', '', `- Untertitel: [[${input.untertitel.datei}]] (${input.untertitel.herkunft})`, '')
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
