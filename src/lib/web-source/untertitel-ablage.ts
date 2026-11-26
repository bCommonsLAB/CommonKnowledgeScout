/**
 * @fileoverview Untertitel als Quelldatei und als Transkript am Twin ablegen.
 *
 * @description
 * Der Weg `transkript: "untertitel"` laedt kein Medium. An die Stelle von
 * `<Basis> - Audio.m4a` tritt `<Basis> - Untertitel.txt`: die Untertitel als
 * Text mit Zeitmarken, im Ordner lesbar. Ihr Twin traegt denselben Text als
 * gewoehnliches Transkript — die Sammeldatei loest die Quelle damit auf wie
 * eine transkribierte Tonspur, und `transkript_korrigieren` arbeitet darauf.
 * Die Herkunft steht dreimal, damit sie niemand suchen muss: im Kopf der
 * Datei, im Frontmatter des Transkripts (flach) und in der Sammeldatei.
 *
 * @module web-source
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { persistShadowTwinToMongo } from '@/lib/shadow-twin/shadow-twin-mongo-writer'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { Untertitel } from './untertitel'

/** Unter diesem Anteil der Laufzeit gilt die Spur als lueckenhaft und bekommt einen Hinweis. */
const MIN_ANTEIL = 0.9
/** Ab dieser Luecke (Sekunden) nennt die Antwort die Stelle. */
const LUECKE_HINWEIS_SEKUNDEN = 300

const ANBIETER: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', peertube: 'PeerTube' }

/** Name der Quelldatei neben der Sammeldatei. */
export function untertitelDateiname(basis: string): string {
  return `${basis} - Untertitel.txt`
}

function anbieter(extractor: string): string {
  const name = extractor.trim().toLowerCase().split(':')[0]
  return ANBIETER[name] ?? (extractor.trim() || 'Videoseite')
}

/** `en, automatisch` — die Kurzform fuer die Antwort. */
export function untertitelSpur(u: Untertitel): string {
  return `${u.sprache}, ${u.art}`
}

/** `YouTube, automatisch erzeugt, Sprache en, abgerufen am 2026-11-26`. */
export function untertitelHerkunft(u: Untertitel, abgerufenAm: Date): string {
  const art = u.art === 'manuell' ? 'von Hand gepflegt' : 'automatisch erzeugt'
  return `${anbieter(u.extractor)}, ${art}, Sprache ${u.sprache}, abgerufen am ${abgerufenAm.toISOString().slice(0, 10)}`
}

/** Inhalt von `<Basis> - Untertitel.txt`: zwei Kopfzeilen zur Herkunft, dann der Text mit Zeitmarken. */
export function untertitelDateiInhalt(u: Untertitel, url: string, abgerufenAm: Date): string {
  return `Untertitel: ${untertitelHerkunft(u, abgerufenAm)}\nQuelle: ${url}\n\n${u.text.trim()}\n`
}

/** Transkript fuer den Twin: flaches Frontmatter mit der Herkunft, Body ist der Text mit Zeitmarken. */
export function untertitelTranskript(u: Untertitel, url: string, abgerufenAm: Date): string {
  return createMarkdownWithFrontmatter(`${u.text.trim()}\n`, {
    transcript_origin: 'subtitles',
    subtitle_provider: anbieter(u.extractor),
    subtitle_kind: u.art === 'manuell' ? 'manual' : 'automatic',
    subtitle_language: u.sprache,
    subtitle_track: u.spur,
    subtitle_fetched_at: abgerufenAm.toISOString(),
    source_url: url,
  })
}

function minuten(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Was der Mensch ueber die Spur wissen sollte: automatisch erzeugt, deckt nicht alles ab, grosse Luecke. */
export function untertitelHinweise(u: Untertitel): string[] {
  const hinweise: string[] = []
  if (u.art === 'automatisch') hinweise.push('Transkript aus automatisch erzeugten Untertiteln — Namen, Fachwoerter und Zahlen sind unsicherer als bei einer Transkription der Tonspur')
  const { anteil, groessteLuecke, groessteLueckeBei } = u.abdeckung
  if (anteil !== null && anteil < MIN_ANTEIL) {
    hinweise.push(`Untertitel enden bei ${Math.round(anteil * 100)} % der Laufzeit — der Rest des Videos fehlt im Transkript`)
  }
  if (groessteLuecke >= LUECKE_HINWEIS_SEKUNDEN) {
    hinweise.push(`Untertitel haben eine Luecke von ${minuten(groessteLuecke)} min ab ${minuten(groessteLueckeBei)} — dort fehlt Text oder es wurde nicht gesprochen`)
  }
  return hinweise
}

/** Schreibt die Untertitel als Transkript an den Twin der Quelldatei (Kern-Stempel wie bei jeder Extraktion). */
export async function schreibeUntertitelTranskript(args: {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  /** Die hochgeladene `<Basis> - Untertitel.txt`. */
  quelle: StorageItem
  targetLanguage: string
  markdown: string
}): Promise<void> {
  await persistShadowTwinToMongo({
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    sourceItem: args.quelle,
    provider: args.provider,
    artifactKey: { sourceId: args.quelle.id, kind: 'transcript', targetLanguage: args.targetLanguage },
    markdown: args.markdown,
    generatedBy: 'knowledgescout/untertitel',
  })
}
