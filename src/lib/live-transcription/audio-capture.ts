/**
 * @fileoverview Audio-Aufnahme fuer die Live-Transkription
 *
 * @description
 * Nimmt das Mikrofon ab und liefert fortlaufend PCM-Bloecke in 24 kHz. Bevorzugt wird
 * ein AudioWorklet (laeuft im Audio-Thread und stockt nicht, wenn der Hauptthread
 * beschaeftigt ist); wo es fehlt, greift der aeltere ScriptProcessor.
 *
 * Der Mikrofon-Datenstrom wird nicht selbst geoeffnet, sondern hereingereicht: Der
 * Mitschnitt fuer die Verlustsicherung haengt am selben Datenstrom.
 *
 * @module live-transcription
 *
 * @exports
 * - AudioCaptureHandle: Interface - Griff zum Beenden der Aufnahme
 * - startAudioCapture: Startet die PCM-Lieferung
 *
 * @dependencies
 * - ./pcm: Umrechnung auf das geforderte Format
 */

import { TARGET_SAMPLE_RATE, floatToPcm16, resampleTo24k } from './pcm'

/** Blockgroesse der Lieferung: 100 ms sind klein genug fuer fluessigen Text. */
const CHUNK_MS = 100

/** Bloecke des ScriptProcessor-Rueckfalls (Zweierpotenz, ~85 ms bei 48 kHz). */
const SCRIPT_PROCESSOR_BUFFER = 4096

/**
 * Der Worklet-Code laeuft im Audio-Thread und wird als Blob eingebunden, damit keine
 * zusaetzliche oeffentliche Datei ausgeliefert werden muss.
 */
const WORKLET_SOURCE = `
class PcmCollector extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this._threshold = options.processorOptions.threshold
    this._buffer = []
    this._length = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    this._buffer.push(new Float32Array(channel))
    this._length += channel.length
    if (this._length >= this._threshold) {
      const merged = new Float32Array(this._length)
      let offset = 0
      for (const block of this._buffer) {
        merged.set(block, offset)
        offset += block.length
      }
      this._buffer = []
      this._length = 0
      this.port.postMessage(merged, [merged.buffer])
    }
    return true
  }
}
registerProcessor('pcm-collector', PcmCollector)
`

export interface AudioCaptureHandle {
  /** Tatsaechliche Abtastrate des Kontexts (kann von 24 kHz abweichen). */
  sampleRate: number
  /** Beendet die Aufnahme und gibt die Audio-Ressourcen frei. */
  stop: () => Promise<void>
}

export interface AudioCaptureOptions {
  stream: MediaStream
  onPcm: (chunk: Int16Array) => void
  onError: (error: Error) => void
}

function createAudioContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Dieser Browser unterstuetzt keine Audio-Verarbeitung (AudioContext fehlt).')
  }
  // Die Wunschrate wird nicht ueberall beachtet (Safari); resampleTo24k faengt das ab.
  return new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE })
}

/**
 * Startet die PCM-Lieferung fuer den uebergebenen Mikrofon-Datenstrom.
 */
export async function startAudioCapture(
  options: AudioCaptureOptions
): Promise<AudioCaptureHandle> {
  const { stream, onPcm, onError } = options
  const context = createAudioContext()
  if (context.state === 'suspended') await context.resume()

  const source = context.createMediaStreamSource(stream)
  const sampleRate = context.sampleRate
  const threshold = Math.max(256, Math.round((sampleRate * CHUNK_MS) / 1000))

  const deliver = (samples: Float32Array): void => {
    try {
      onPcm(floatToPcm16(resampleTo24k(samples, sampleRate)))
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Audio-Umwandlung fehlgeschlagen'))
    }
  }

  if (context.audioWorklet) {
    const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
    try {
      await context.audioWorklet.addModule(blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }

    const node = new AudioWorkletNode(context, 'pcm-collector', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { threshold },
    })
    node.port.onmessage = (event: MessageEvent<Float32Array>) => deliver(event.data)
    source.connect(node)

    return {
      sampleRate,
      stop: async () => {
        node.port.onmessage = null
        node.disconnect()
        source.disconnect()
        await context.close()
      },
    }
  }

  // Rueckfall fuer Browser ohne AudioWorklet. Bewusst und sichtbar: der Knoten gilt als
  // veraltet, ist aber die einzige Alternative, die ueberall laeuft.
  console.warn('[live-transcription] AudioWorklet nicht verfuegbar, nutze ScriptProcessor')
  const processor = context.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER, 1, 1)
  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    deliver(new Float32Array(event.inputBuffer.getChannelData(0)))
  }
  source.connect(processor)
  // Ohne Verbindung zum Ziel liefert der Knoten in manchen Browsern keine Ereignisse;
  // eine stumme Verstaerkung haelt ihn am Laufen, ohne etwas hoerbar zu machen.
  const silence = context.createGain()
  silence.gain.value = 0
  processor.connect(silence)
  silence.connect(context.destination)

  return {
    sampleRate,
    stop: async () => {
      processor.onaudioprocess = null
      processor.disconnect()
      silence.disconnect()
      source.disconnect()
      await context.close()
    },
  }
}
