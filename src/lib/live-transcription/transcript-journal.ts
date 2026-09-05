/**
 * @fileoverview Transkript-Journal - Abschnitte, Sprecher und Luecken in Reihenfolge
 *
 * @description
 * Haelt das Ergebnis der Live-Erkennung: fertige Abschnitte, die Zuordnung zu
 * Sprechern (wenn das Modell welche erkennt) und die Zeitspannen, deren Text noch
 * aussteht. Reine Datenhaltung ohne Netz- oder Browser-Bezug, damit pruefbar.
 *
 * Liefert das Modell Sprecher-Abschnitte zu einem Beitrag, ersetzen diese den
 * ungegliederten Gesamttext desselben Beitrags — sonst stuende alles doppelt da.
 *
 * @module live-transcription
 *
 * @exports
 * - TranscriptJournal: Klasse - Abschnitte und Luecken einer Aufnahme
 * - GAP_PLACEHOLDER: Platzhalter fuer noch nicht nachgearbeitete Luecken
 *
 * @dependencies
 * - ./types: LiveSegment, LiveGap
 */

import type { LiveGap, LiveSegment } from './types'

/**
 * Steht im Text, solange eine Luecke nicht nachgearbeitet ist. Sichtbar und nicht
 * still: Wer den Text weiterverwendet, sieht sofort, dass hier noch etwas fehlt.
 */
export const GAP_PLACEHOLDER = '[… Aufnahme wird nachgearbeitet …]'

let counter = 0

function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export class TranscriptJournal {
  private readonly entries: LiveSegment[] = []
  private readonly gaps: LiveGap[] = []
  /** Beitraege, zu denen bereits Sprecher-Abschnitte vorliegen. */
  private readonly itemsWithSpeakers = new Set<string>()
  /** Zuordnung Beitrag -> Abschnitt ohne Sprecher, damit er ersetzt werden kann. */
  private readonly plainSegmentByItem = new Map<string, string>()

  /** Nimmt einen abgeschlossenen Beitrag ohne Sprecher-Gliederung auf. */
  addCompleted(itemId: string, text: string, startMs: number, endMs: number): void {
    const trimmed = text.trim()
    if (!trimmed) return
    // Liegen bereits Sprecher-Abschnitte vor, waere der Gesamttext eine Dublette.
    if (this.itemsWithSpeakers.has(itemId)) return

    const segment: LiveSegment = {
      id: nextId('seg'),
      text: trimmed,
      speaker: null,
      startMs,
      endMs,
      source: 'live',
    }
    this.entries.push(segment)
    this.plainSegmentByItem.set(itemId, segment.id)
  }

  /** Nimmt einen Abschnitt mit Sprecher-Label auf. */
  addSpeakerSegment(args: {
    itemId: string
    speaker: string
    text: string
    startMs: number
    endMs: number
  }): void {
    const trimmed = args.text.trim()
    if (!trimmed) return

    // Der ungegliederte Text desselben Beitrags weicht den Sprecher-Abschnitten.
    const plainId = this.plainSegmentByItem.get(args.itemId)
    if (plainId) {
      const index = this.entries.findIndex((entry) => entry.id === plainId)
      if (index >= 0) this.entries.splice(index, 1)
      this.plainSegmentByItem.delete(args.itemId)
    }
    this.itemsWithSpeakers.add(args.itemId)

    this.entries.push({
      id: nextId('seg'),
      text: trimmed,
      speaker: args.speaker || null,
      startMs: args.startMs,
      endMs: args.endMs,
      source: 'live',
    })
  }

  /** Oeffnet eine Luecke und gibt ihre Kennung zurueck. */
  openGap(startMs: number, reason: string): string {
    const gap: LiveGap = {
      id: nextId('gap'),
      startMs,
      endMs: null,
      state: 'offen',
      audio: null,
      reason,
    }
    this.gaps.push(gap)
    return gap.id
  }

  /** Schliesst die Zeitspanne einer Luecke ab; der Mitschnitt liegt jetzt vor. */
  closeGap(gapId: string, endMs: number, audio: Blob | null): void {
    const gap = this.gaps.find((entry) => entry.id === gapId)
    if (!gap) return
    gap.endMs = endMs
    gap.audio = audio
    gap.state = audio && audio.size > 0 ? 'wartet' : 'gescheitert'
  }

  setGapState(gapId: string, state: LiveGap['state']): void {
    const gap = this.gaps.find((entry) => entry.id === gapId)
    if (gap) gap.state = state
  }

  /** Setzt den nachgearbeiteten Text einer Luecke an die richtige Stelle. */
  resolveGap(gapId: string, text: string): void {
    const gap = this.gaps.find((entry) => entry.id === gapId)
    if (!gap) return
    const trimmed = text.trim()
    if (trimmed) {
      this.entries.push({
        id: nextId('seg'),
        text: trimmed,
        speaker: null,
        startMs: gap.startMs,
        endMs: gap.endMs ?? gap.startMs,
        source: 'recovered',
      })
    }
    gap.state = 'geschlossen'
    gap.audio = null
  }

  /** Alle Abschnitte in zeitlicher Reihenfolge. */
  get segments(): LiveSegment[] {
    return [...this.entries].sort((left, right) => left.startMs - right.startMs)
  }

  get openGaps(): LiveGap[] {
    return this.gaps.filter((gap) => gap.state !== 'geschlossen')
  }

  get allGaps(): LiveGap[] {
    return [...this.gaps]
  }

  /**
   * Der zusammengesetzte Text. Sprecherwechsel werden als Praefix ausgewiesen,
   * offene Luecken als sichtbarer Platzhalter an ihrer zeitlichen Position.
   */
  toText(): string {
    const parts: Array<{ startMs: number; text: string }> = this.segments.map((segment) => ({
      startMs: segment.startMs,
      text: segment.speaker ? `${segment.speaker}: ${segment.text}` : segment.text,
    }))

    for (const gap of this.gaps) {
      if (gap.state === 'geschlossen') continue
      parts.push({ startMs: gap.startMs, text: GAP_PLACEHOLDER })
    }

    return parts
      .sort((left, right) => left.startMs - right.startMs)
      .map((part) => part.text)
      .join(' ')
      .trim()
  }
}
