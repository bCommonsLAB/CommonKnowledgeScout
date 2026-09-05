/**
 * @fileoverview Audio-Puffer fuer Verbindungsluecken
 *
 * @description
 * Faellt die Verbindung aus, laufen die PCM-Bloecke hier hinein und werden nach der
 * Wiederverbindung nachgesendet. Kurze Stoerungen kosten den Sprechenden damit gar
 * nichts — der Text kommt vollstaendig, nur verzoegert.
 *
 * Der Puffer ist begrenzt, weil er im Arbeitsspeicher liegt. Laeuft er ueber, werden
 * die aeltesten Bloecke verworfen und die betroffene Zeitspanne gemeldet: Der
 * Session-Manager macht daraus eine Luecke, die aus dem Mitschnitt nachgearbeitet wird.
 * Verworfen wird also nie stillschweigend.
 *
 * @module live-transcription
 *
 * @exports
 * - AudioOutbox: Klasse - gepufferte PCM-Bloecke
 *
 * @dependencies
 * - ./pcm: Dauerberechnung
 */

import { pcmDurationMs } from './pcm'

/** Voreinstellung: zwei Minuten Audio. Deckt uebliche Netzaussetzer ab. */
export const DEFAULT_MAX_BUFFER_SECONDS = 120

export interface AudioOutboxOptions {
  maxSeconds?: number
  /** Wird gerufen, wenn Bloecke verworfen werden mussten. */
  onOverflow: (droppedMs: number) => void
}

export class AudioOutbox {
  private readonly chunks: Int16Array[] = []
  private readonly maxSeconds: number
  private readonly onOverflow: (droppedMs: number) => void
  private bufferedSamples = 0

  constructor(options: AudioOutboxOptions) {
    this.maxSeconds = options.maxSeconds ?? DEFAULT_MAX_BUFFER_SECONDS
    this.onOverflow = options.onOverflow
  }

  /** Nimmt einen Block auf und verwirft notfalls die aeltesten. */
  push(chunk: Int16Array): void {
    this.chunks.push(chunk)
    this.bufferedSamples += chunk.length

    const maxSamples = this.maxSeconds * 24000
    let droppedSamples = 0
    while (this.bufferedSamples > maxSamples && this.chunks.length > 0) {
      const dropped = this.chunks.shift()
      if (!dropped) break
      this.bufferedSamples -= dropped.length
      droppedSamples += dropped.length
    }

    if (droppedSamples > 0) {
      this.onOverflow(pcmDurationMs(droppedSamples))
    }
  }

  /**
   * Entnimmt bis zu `count` Bloecke in der Reihenfolge ihres Eingangs.
   * Der Aufrufer bestimmt damit das Tempo des Nachsendens.
   */
  take(count: number): Int16Array[] {
    const batch = this.chunks.splice(0, Math.max(0, count))
    for (const chunk of batch) {
      this.bufferedSamples -= chunk.length
    }
    return batch
  }

  /** Gepufferte Audiodauer in Sekunden. */
  get bufferedSeconds(): number {
    return pcmDurationMs(this.bufferedSamples) / 1000
  }

  get isEmpty(): boolean {
    return this.chunks.length === 0
  }

  clear(): void {
    this.chunks.length = 0
    this.bufferedSamples = 0
  }
}
