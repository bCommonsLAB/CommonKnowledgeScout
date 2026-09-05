/**
 * @fileoverview Luecken-Steuerung - Mitschnitt und Nacharbeit gestoerter Abschnitte
 *
 * @description
 * Kuemmert sich um alles, was passiert, wenn die Live-Verbindung aussetzt: Mitschnitt
 * der Stoerung starten, sie beim Wiederverbinden abschliessen und den fehlenden Text
 * nacharbeiten.
 *
 * Entscheidend ist die Weiche beim Abschluss: Solange der Puffer den Ton der Stoerung
 * vollstaendig traegt, wird er nachgesendet und der Mitschnitt verworfen. Erst wenn der
 * Puffer uebergelaufen ist, uebernimmt der Mitschnitt — und dann wird der Puffer
 * verworfen. Nie beides, sonst stuende der Abschnitt doppelt im Text.
 *
 * @module live-transcription
 *
 * @exports
 * - GapController: Klasse - Luecken einer laufenden Aufnahme
 *
 * @dependencies
 * - ./media-recording, ./transcript-journal, ./outbox
 */

import { startGapRecording, type GapRecordingHandle } from './media-recording'
import type { TranscriptJournal } from './transcript-journal'
import type { AudioOutbox } from './outbox'

export interface GapControllerOptions {
  journal: TranscriptJournal
  stream: MediaStream
  outbox: AudioOutbox
  /** Arbeitet den Mitschnitt einer Stoerung nach. */
  recoverGap: (blob: Blob) => Promise<string>
  /** Meldet Zustandsaenderungen nach aussen. */
  onChange: () => void
  /** Meldet einen Fehler der Nacharbeit. */
  onRecoveryError: (message: string) => void
}

export class GapController {
  private readonly options: GapControllerOptions
  private recorder: GapRecordingHandle | null = null
  private currentGapId: string | null = null
  private overflowSeen = false

  constructor(options: GapControllerOptions) {
    this.options = options
  }

  get hasOpenGap(): boolean {
    return this.currentGapId !== null
  }

  /** Merkt vor, dass Audio verworfen wurde — dann ist der Mitschnitt zustaendig. */
  markOverflow(): void {
    this.overflowSeen = true
  }

  /** Beginnt eine Stoerung: Luecke eintragen und Mitschnitt starten. */
  open(atMs: number, reason: string): void {
    if (this.currentGapId) return
    this.overflowSeen = false
    this.currentGapId = this.options.journal.openGap(atMs, reason)
    this.recorder = startGapRecording(this.options.stream)
    this.options.onChange()
  }

  /**
   * Beendet die laufende Stoerung.
   *
   * @returns true, wenn eine Nacharbeit noetig ist (Puffer war uebergelaufen).
   */
  async close(atMs: number): Promise<boolean> {
    const gapId = this.currentGapId
    if (!gapId) return false
    this.currentGapId = null

    const blob = this.recorder ? await this.recorder.stop() : null
    this.recorder = null

    if (!this.overflowSeen) {
      // Der Puffer traegt den Ton: die Luecke schliesst sich von selbst.
      this.options.journal.closeGap(gapId, atMs, null)
      this.options.journal.resolveGap(gapId, '')
      this.options.onChange()
      return false
    }

    this.options.outbox.clear()
    this.options.journal.closeGap(gapId, atMs, blob)
    this.options.onChange()
    return true
  }

  /** Schliesst eine noch offene Stoerung beim Beenden der Aufnahme. */
  async finish(atMs: number): Promise<void> {
    if (!this.currentGapId) return
    const gapId = this.currentGapId
    this.currentGapId = null
    const blob = this.recorder ? await this.recorder.stop() : null
    this.recorder = null
    // Beim Beenden liegt kein Nachsenden mehr an, also traegt immer der Mitschnitt.
    this.options.outbox.clear()
    this.options.journal.closeGap(gapId, atMs, blob)
    this.options.onChange()
  }

  /** Arbeitet alle wartenden Luecken nacheinander ab. */
  async processPending(): Promise<void> {
    for (const gap of this.options.journal.allGaps) {
      if (gap.state !== 'wartet' || !gap.audio) continue

      this.options.journal.setGapState(gap.id, 'laeuft')
      this.options.onChange()
      try {
        const text = await this.options.recoverGap(gap.audio)
        this.options.journal.resolveGap(gap.id, text)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nacharbeit fehlgeschlagen'
        console.warn(`[live-transcription] Luecke nicht nachgearbeitet: ${message}`)
        this.options.journal.setGapState(gap.id, 'gescheitert')
        this.options.onRecoveryError(message)
      }
      this.options.onChange()
    }
  }
}
