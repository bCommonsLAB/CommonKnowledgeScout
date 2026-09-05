/**
 * @fileoverview Live-Session - Ablauf einer laufenden Live-Transkription
 *
 * @description
 * Fuehrt Aufnahme, Verbindung und Sicherung zusammen. Die Zusage lautet: Gesprochenes
 * geht nicht verloren. Dafuer gibt es drei Stufen — (1) im Normalfall kommt der Text
 * live, (2) bei kurzer Stoerung wird der Ton gepuffert und nachgesendet, (3) bei langer
 * Stoerung uebernimmt der Mitschnitt und wird nachtraeglich transkribiert. Zusaetzlich
 * laeuft ein durchgehender Mitschnitt in die lokale Ablage, damit auch ein Absturz des
 * Browsers nichts vernichtet.
 *
 * Luecken-Logik: ./gap-controller. Ereignis-Zuordnung: ./session-events.
 *
 * @module live-transcription
 *
 * @exports
 * - LiveSession: Klasse - eine laufende Live-Transkription
 *
 * @dependencies
 * - ./audio-capture, ./realtime-socket, ./outbox, ./transcript-journal,
 *   ./connection-policy, ./media-recording, ./gap-controller, ./session-events
 */

import { startAudioCapture, type AudioCaptureHandle } from './audio-capture'
import { AudioOutbox } from './outbox'
import { pcm16ToBase64, pcmDurationMs } from './pcm'
import { openRealtimeSocket, type RealtimeSocketHandle } from './realtime-socket'
import { TranscriptJournal } from './transcript-journal'
import { reconnectDelayMs, shouldRotateSession } from './connection-policy'
import { startContinuousRecording, type ContinuousRecordingHandle } from './media-recording'
import { GapController } from './gap-controller'
import { createSessionEvents } from './session-events'
import type {
  LiveConnectionState,
  LiveStatus,
  LiveTranscriptionSnapshot,
  RealtimeTicket,
} from './types'

/** Bloecke je Nachsende-Runde: 20 Bloecke sind rund zwei Sekunden Audio. */
const FLUSH_BATCH = 20

/** Abstand der Nachsende-Runden. */
const FLUSH_INTERVAL_MS = 100

export interface LiveSessionOptions {
  stream: MediaStream
  /** Holt ein frisches Ticket; wird bei jedem Verbindungsaufbau gerufen. */
  fetchTicket: () => Promise<RealtimeTicket>
  /** Arbeitet den Mitschnitt einer Stoerung nach. */
  recoverGap: (blob: Blob) => Promise<string>
  /** Nimmt Stuecke des durchgehenden Mitschnitts entgegen (lokale Ablage). */
  onRecordingChunk?: (blob: Blob, index: number) => void
  /** Wird nach jeder Zustandsaenderung gerufen. */
  onChange: () => void
}

export class LiveSession {
  private readonly options: LiveSessionOptions
  private readonly journal = new TranscriptJournal()
  private readonly outbox: AudioOutbox
  private readonly gaps: GapController

  private capture: AudioCaptureHandle | null = null
  private recording: ContinuousRecordingHandle | null = null
  private socket: RealtimeSocketHandle | null = null

  private connection: LiveConnectionState = 'getrennt'
  private status: LiveStatus = 'bereit'
  private error: string | null = null
  private pendingText = ''

  private totalSamples = 0
  private sessionStartedAtMs = 0
  private sessionOffsetMs = 0
  private isSpeaking = false
  private stopped = false
  private rotating = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: LiveSessionOptions) {
    this.options = options
    this.outbox = new AudioOutbox({
      onOverflow: (droppedMs) => {
        console.warn(`[live-transcription] Puffer voll, ${Math.round(droppedMs)} ms verworfen`)
        this.gaps.markOverflow()
      },
    })
    this.gaps = new GapController({
      journal: this.journal,
      stream: options.stream,
      outbox: this.outbox,
      recoverGap: options.recoverGap,
      onChange: () => this.emit(),
      onRecoveryError: (message) => {
        this.error = `Ein Abschnitt konnte nicht nachgearbeitet werden: ${message}`
      },
    })
  }

  /** Startet Aufnahme, Mitschnitt und Verbindung. */
  async start(): Promise<void> {
    this.stopped = false
    this.status = 'nimmt-auf'
    this.emit()

    this.capture = await startAudioCapture({
      stream: this.options.stream,
      onPcm: (chunk) => this.handlePcm(chunk),
      onError: (captureError) => this.fail(captureError.message),
    })

    const onChunk = this.options.onRecordingChunk
    if (onChunk) {
      this.recording = startContinuousRecording({ stream: this.options.stream, onChunk })
    }

    await this.connect()
  }

  /** Beendet die Aufnahme. Offene Luecken werden anschliessend nachgearbeitet. */
  async stop(): Promise<void> {
    this.stopped = true
    this.clearTimers()
    this.socket?.close()
    this.socket = null

    await this.capture?.stop()
    this.capture = null
    await this.recording?.stop()
    this.recording = null
    await this.gaps.finish(this.elapsedMs)

    this.connection = 'getrennt'
    this.status = this.journal.openGaps.length > 0 ? 'arbeitet-nach' : 'bereit'
    this.emit()

    await this.gaps.processPending()
    this.status = this.error ? 'fehler' : 'bereit'
    this.emit()
  }

  /** Aktueller Stand fuer die Anzeige. */
  getSnapshot(): LiveTranscriptionSnapshot {
    return {
      status: this.status,
      connection: this.connection,
      segments: this.journal.segments,
      pendingText: this.pendingText,
      gaps: this.journal.openGaps,
      bufferedSeconds: this.outbox.bufferedSeconds,
      elapsedMs: this.elapsedMs,
      error: this.error,
    }
  }

  /** Der zusammengesetzte Text inklusive Platzhaltern fuer offene Luecken. */
  getText(): string {
    return this.journal.toText()
  }

  private get elapsedMs(): number {
    return pcmDurationMs(this.totalSamples)
  }

  private emit(): void {
    this.options.onChange()
  }

  private fail(message: string): void {
    this.error = message
    this.status = 'fehler'
    this.emit()
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.reconnectTimer = null
    this.flushTimer = null
  }

  private handlePcm(chunk: Int16Array): void {
    this.totalSamples += chunk.length

    // Solange etwas im Puffer liegt, geht auch Neues dorthin — sonst kaeme der Ton
    // beim Anbieter in falscher Reihenfolge an.
    if (this.socket?.isOpen() && this.outbox.isEmpty) {
      this.socket.sendAudio(pcm16ToBase64(chunk))
    } else {
      this.outbox.push(chunk)
    }

    if (
      !this.rotating &&
      this.socket?.isOpen() &&
      shouldRotateSession({
        sessionAgeMs: Date.now() - this.sessionStartedAtMs,
        isSpeaking: this.isSpeaking,
      })
    ) {
      void this.rotate()
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    this.connection = this.rotating ? 'wechselt-session' : 'verbindet'
    this.emit()

    let ticket: RealtimeTicket
    try {
      ticket = await this.options.fetchTicket()
    } catch (ticketError) {
      const message = ticketError instanceof Error ? ticketError.message : 'Ticket nicht erhalten'
      this.error = message
      this.scheduleReconnect(message)
      return
    }

    if (this.stopped) return

    this.socket = openRealtimeSocket(
      ticket,
      createSessionEvents({
        journal: this.journal,
        elapsedMs: () => this.elapsedMs,
        sessionOffsetMs: () => this.sessionOffsetMs,
        appendPending: (delta) => {
          this.pendingText += delta
        },
        clearPending: () => {
          this.pendingText = ''
        },
        setSpeaking: (speaking) => {
          this.isSpeaking = speaking
        },
        onOpen: () => this.handleOpen(),
        onServiceError: (message) => {
          // Ein Fehler des Dienstes beendet die Verbindung nicht zwingend. Sichtbar
          // machen, Aufnahme und Mitschnitt laufen weiter.
          console.warn(`[live-transcription] ${message}`)
          this.error = message
          this.emit()
        },
        onClose: (code, reason) => this.handleClose(code, reason),
        emit: () => this.emit(),
      })
    )
  }

  private handleOpen(): void {
    this.reconnectAttempt = 0
    this.error = null
    this.rotating = false
    this.sessionStartedAtMs = Date.now()
    this.sessionOffsetMs = this.elapsedMs
    this.connection = this.outbox.isEmpty ? 'verbunden' : 'puffert'
    this.emit()
    void this.gaps.close(this.elapsedMs).then((needsRecovery) => {
      if (needsRecovery) void this.gaps.processPending()
    })
    this.startFlushing()
  }

  private handleClose(code: number, reason: string): void {
    this.socket = null
    if (this.stopped) return
    this.gaps.open(this.elapsedMs, reason || `Verbindung beendet (Code ${code})`)
    this.connection = 'puffert'
    this.scheduleReconnect(reason)
  }

  private scheduleReconnect(reason: string): void {
    if (this.stopped) return
    this.reconnectAttempt += 1
    const delay = reconnectDelayMs(this.reconnectAttempt)
    console.warn(`[live-transcription] Neuer Verbindungsversuch in ${delay} ms (${reason})`)
    this.reconnectTimer = setTimeout(() => void this.connect(), delay)
  }

  /**
   * Wechselt die Session vor dem Zeitlimit des Anbieters: kontrolliert trennen und
   * sofort neu verbinden. Der Ton der Umschaltpause liegt im Puffer und wird
   * nachgesendet, es geht also nichts verloren.
   */
  private async rotate(): Promise<void> {
    this.rotating = true
    this.connection = 'wechselt-session'
    this.emit()
    this.gaps.open(this.elapsedMs, 'Sessionwechsel')
    this.socket?.close()
    this.socket = null
    await this.connect()
  }

  private startFlushing(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      if (!this.socket?.isOpen()) return
      if (this.outbox.isEmpty) {
        if (this.connection === 'puffert') {
          this.connection = 'verbunden'
          this.emit()
        }
        return
      }
      for (const chunk of this.outbox.take(FLUSH_BATCH)) {
        this.socket.sendAudio(pcm16ToBase64(chunk))
      }
      this.emit()
    }, FLUSH_INTERVAL_MS)
  }
}
