/**
 * @fileoverview Mitschnitt des Mikrofons (Verlustsicherung)
 *
 * @description
 * Zwei Mitschnitte laufen neben der Live-Erkennung:
 *
 * 1. Der durchgehende Mitschnitt wandert stueckweise in die lokale Ablage. Er ist die
 *    Rueckversicherung fuer den Fall, dass der Tab abstuerzt oder der Text spaeter
 *    noch einmal sauber erzeugt werden soll.
 * 2. Der Stoerungs-Mitschnitt laeuft nur, solange die Verbindung weg ist, und liefert
 *    eine in sich vollstaendige Datei. Genau diese wird anschliessend ueber den
 *    bestehenden Weg nachtranskribiert und an der richtigen Stelle eingefuegt.
 *
 * Beide haengen am selben Mikrofon-Datenstrom wie die Live-Erkennung.
 *
 * @module live-transcription
 *
 * @exports
 * - pickAudioMimeType: Waehlt ein vom Browser unterstuetztes Aufnahmeformat
 * - startContinuousRecording: Durchgehender Mitschnitt in Stuecken
 * - startGapRecording: Mitschnitt einer einzelnen Stoerung
 */

/** Stueckgroesse des durchgehenden Mitschnitts. */
const CONTINUOUS_TIMESLICE_MS = 5000

/**
 * Waehlt ein Aufnahmeformat. Opus in WebM ist ueberall dort erste Wahl, wo es geht;
 * Safari liefert MP4/AAC. Kann der Browser gar nichts davon, entscheidet er selbst.
 */
export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return ''
}

function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickAudioMimeType()
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
}

export interface ContinuousRecordingHandle {
  stop: () => Promise<void>
}

/**
 * Startet den durchgehenden Mitschnitt.
 *
 * @param onChunk Wird je Stueck gerufen; der Aufrufer legt es in die lokale Ablage.
 *                Fehler beim Wegschreiben duerfen die Aufnahme nicht abbrechen, deshalb
 *                nimmt der Aufrufer sie entgegen, nicht dieser Helfer.
 */
export function startContinuousRecording(options: {
  stream: MediaStream
  onChunk: (blob: Blob, index: number) => void
}): ContinuousRecordingHandle {
  const recorder = createRecorder(options.stream)
  let index = 0

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      options.onChunk(event.data, index)
      index += 1
    }
  }
  recorder.start(CONTINUOUS_TIMESLICE_MS)

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve()
          return
        }
        recorder.onstop = () => resolve()
        recorder.stop()
      }),
  }
}

export interface GapRecordingHandle {
  /** Beendet den Mitschnitt und liefert die vollstaendige Datei der Stoerung. */
  stop: () => Promise<Blob>
  mimeType: string
}

/**
 * Startet den Mitschnitt einer Stoerung.
 *
 * Bewusst ein eigener Rekorder statt eines Ausschnitts aus dem durchgehenden
 * Mitschnitt: Nur so entsteht eine Datei mit eigenem Kopf, die der Transkriptionsdienst
 * ohne Weiteres lesen kann.
 */
export function startGapRecording(stream: MediaStream): GapRecordingHandle {
  const recorder = createRecorder(stream)
  const chunks: Blob[] = []
  const mimeType = recorder.mimeType || pickAudioMimeType() || 'audio/webm'

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) chunks.push(event.data)
  }
  recorder.start()

  return {
    mimeType,
    stop: () =>
      new Promise<Blob>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: mimeType }))
          return
        }
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
        recorder.stop()
      }),
  }
}
