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
  private waitingForNetwork = false

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

  /** True, solange ein Abschnitt auf Nacharbeit wartet oder gerade laeuft. */
  get hasUnfinishedWork(): boolean {
    return this.options.journal.allGaps.some((gap) => gap.state === 'wartet' || gap.state === 'laeuft')
  }

  /**
   * Nimmt die Nacharbeit wieder auf, sobald der Browser wieder online ist. Der Horcher
   * meldet sich selbst ab; mehrfaches Anmelden verhindert `waitingForNetwork`.
   */
  private retryWhenOnline(): void {
    if (this.waitingForNetwork || typeof window === 'undefined') return
    this.waitingForNetwork = true
    const wiederAufnehmen = () => {
      window.removeEventListener('online', wiederAufnehmen)
      this.waitingForNetwork = false
      void this.processPending()
    }
    window.addEventListener('online', wiederAufnehmen)
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
        // Ohne Netz ist das kein Scheitern, sondern ein Aufschub: Der Mitschnitt liegt
        // vor, nur der Dienst ist unerreichbar. Die Luecke bleibt wartend und wird
        // erneut angegangen, sobald die Verbindung zurueck ist — sonst waere der
        // Abschnitt endgueltig verloren, obwohl der Ton noch da ist.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          console.warn(`[live-transcription] Nacharbeit aufgeschoben (kein Netz): ${message}`)
          this.options.journal.setGapState(gap.id, 'wartet')
          this.options.onChange()
          this.retryWhenOnline()
          return
        }
        console.warn(`[live-transcription] Luecke nicht nachgearbeitet: ${message}`)
        this.options.journal.setGapState(gap.id, 'gescheitert')
        this.options.onRecoveryError(message)
      }
      this.options.onChange()
    }
  }
}
