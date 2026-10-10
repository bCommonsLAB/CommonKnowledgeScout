/**
 * @fileoverview Satz-Segmente bewerten: welche Stellen sollte ein Mensch nachhoeren?
 *
 * @description
 * Rein, ohne I/O. Wendet Schwellen auf die Rohwerte des Secretary an und
 * liefert je Satz die Gruende, warum er gelb markiert wird, plus Luecken
 * zwischen Saetzen. Ohne Befund heisst: die Werte sprechen nicht dagegen —
 * nicht „geprueft und richtig". Fehlen die Werte (`null`), gibt es keinen
 * Wert-Befund; ob ueberhaupt Werte da waren, sagt `mitWerten`.
 *
 * Schwellen: Startpunkt aus dem Prueffall 09.10.2026 (gpt-transcribe) und den
 * Whisper-Voreinstellungen. Sie stehen hier an EINER Stelle; konfigurierbar pro
 * Library ist ein spaeterer Schritt.
 *
 * @module transkript-verlaesslichkeit
 */

import type { TranscriptSegment, TranslatedChunk } from './segmente'

export const VERLAESSLICHKEIT_SCHWELLEN = {
  /** Schlechtestes Wort eines Satzes: darunter vermutlich verhoert (Namen, erfundene Woerter). */
  minLogprob: -1.0,
  /** Whisper: mittlere Wahrscheinlichkeit des Abschnitts. */
  avgLogprob: -1.0,
  /** Wiederholung (Schleife). */
  compressionRatio: 2.4,
  /** Stille-Wahrscheinlichkeit — zaehlt nur zusammen mit schlechtem avgLogprob (Whisper-Regel). */
  noSpeechProb: 0.6,
  /** Sekunden ohne Satz zwischen zwei Saetzen: hier fehlt vielleicht Rede. */
  lueckeSekunden: 10,
} as const

export type BefundArt = 'unsicheres_wort' | 'unsicherer_abschnitt' | 'wiederholung' | 'vielleicht_erfunden' | 'fremde_sprache' | 'unverstaendlich' | 'uebersetzt'

export interface SatzBefund {
  art: BefundArt
  /** Ein Satz Klartext fuer den Tooltip. */
  text: string
}

export interface BewerteterSatz {
  index: number
  segment: TranscriptSegment
  befunde: SatzBefund[]
  /** Sekunden ohne Text VOR diesem Satz, wenn ueber der Schwelle; sonst null. */
  lueckeDavor: number | null
}

export interface Bewertung {
  saetze: BewerteterSatz[]
  /** Saetze mit mindestens einem Befund. */
  gelb: number
  luecken: number
  /** Saetze, fuer die das Modell ueberhaupt Werte geliefert hat. */
  mitWerten: number
  /** Ob die Sprachpruefung lief (nur mit erlaubten Sprachen). */
  sprachpruefung: boolean
  /** Uebersetzte Stuecke im Gesamttext: 'unbekannt' = Secretary meldet es nicht; sonst Anzahl (0 = nichts uebersetzt). */
  uebersetzung: 'unbekannt' | number
}

function f(n: number): string {
  return n.toFixed(2)
}

function befundeFuer(s: TranscriptSegment, erlaubt: ReadonlySet<string>): SatzBefund[] {
  const t = VERLAESSLICHKEIT_SCHWELLEN
  const out: SatzBefund[] = []
  if (s.minLogprob !== null && s.minLogprob < t.minLogprob) {
    out.push({ art: 'unsicheres_wort', text: `Ein Wort ist unsicher erkannt (${f(s.minLogprob)}) — oft ein Name oder ein verhoertes Wort.` })
  }
  if (s.avgLogprob !== null && s.avgLogprob < t.avgLogprob) {
    out.push({ art: 'unsicherer_abschnitt', text: `Der ganze Abschnitt ist unsicher erkannt (${f(s.avgLogprob)}).` })
  }
  if (s.compressionRatio !== null && s.compressionRatio > t.compressionRatio) {
    out.push({ art: 'wiederholung', text: `Der Text wiederholt sich auffaellig (${f(s.compressionRatio)}) — vielleicht eine Schleife.` })
  }
  if (s.noSpeechProb !== null && s.noSpeechProb > t.noSpeechProb && s.avgLogprob !== null && s.avgLogprob < t.avgLogprob) {
    out.push({ art: 'vielleicht_erfunden', text: 'Hier war vermutlich keine Sprache — der Text ist vielleicht erfunden.' })
  }
  if (erlaubt.size > 0 && s.textLanguage !== null && !erlaubt.has(s.textLanguage)) {
    out.push({ art: 'fremde_sprache', text: `Sprache „${s.textLanguage}" ist nicht angegeben — vielleicht falsch erkannt oder uebersetzt.` })
  }
  if (s.text.includes('…') || s.text.includes('...')) {
    out.push({ art: 'unverstaendlich', text: 'Das Modell hat hier selbst eine unverstaendliche Stelle markiert (…).' })
  }
  return out
}

export function bewerteSegmente(
  segments: readonly TranscriptSegment[],
  erlaubteSprachen: readonly string[],
  translatedChunks: readonly TranslatedChunk[] | null = null,
): Bewertung {
  const erlaubt = new Set(erlaubteSprachen.map((s) => s.toLowerCase()))
  let vorherEnde: number | null = null
  const saetze = segments.map((segment, index): BewerteterSatz => {
    const abstand: number | null = vorherEnde === null ? null : segment.start - vorherEnde
    const lueckeDavor = abstand !== null && abstand > VERLAESSLICHKEIT_SCHWELLEN.lueckeSekunden ? abstand : null
    vorherEnde = Math.max(vorherEnde ?? 0, segment.end)
    const befunde = befundeFuer(segment, erlaubt)
    // Secretary PR #33: Stuecke, die im Gesamttext nachtraeglich uebersetzt wurden — die Saetze zeigen
    // das Original, das Transkript nicht. Mit translate=false darf das nie vorkommen.
    const chunk = (translatedChunks ?? []).find((c) => segment.start < c.end && segment.end > c.start)
    if (chunk) befunde.push({ art: 'uebersetzt', text: `Im Transkript ist dieser Abschnitt uebersetzt (${chunk.sourceLanguage ?? '?'} → ${chunk.targetLanguage ?? '?'}); der Satz hier zeigt das Original.` })
    return { index, segment, befunde, lueckeDavor }
  })
  return {
    saetze,
    gelb: saetze.filter((s) => s.befunde.length > 0).length,
    luecken: saetze.filter((s) => s.lueckeDavor !== null).length,
    mitWerten: segments.filter((s) => s.minLogprob !== null || s.avgLogprob !== null).length,
    sprachpruefung: erlaubt.size > 0,
    uebersetzung: translatedChunks === null ? 'unbekannt' : translatedChunks.length,
  }
}

/** mm:ss bzw. h:mm:ss fuer die Zeitmarke am Satz. */
export function formatZeit(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
