/**
 * @fileoverview PCM-Aufbereitung fuer die Live-Transkription
 *
 * @description
 * Die Realtime-Schnittstelle nimmt ausschliesslich 16-Bit-PCM mit 24 kHz, mono,
 * little-endian entgegen. Der Browser liefert Float32 in seiner eigenen Abtastrate
 * (haeufig 44,1 oder 48 kHz; Safari laesst sich die Rate nicht vorschreiben). Diese
 * Datei rechnet um — reine Funktionen, damit sie ohne Browser pruefbar sind.
 *
 * @module live-transcription
 *
 * @exports
 * - TARGET_SAMPLE_RATE: Zielabtastrate
 * - resampleTo24k: Rechnet Float32-Abtastwerte auf 24 kHz um
 * - floatToPcm16: Wandelt Float32 in Int16
 * - pcm16ToBase64: Kodiert Int16-Daten fuer den Versand
 * - pcmDurationMs: Dauer eines PCM-Puffers in Millisekunden
 */

/** Einzig zulaessige Abtastrate der Realtime-Schnittstelle. */
export const TARGET_SAMPLE_RATE = 24000

/** Zwei Byte je Abtastwert (16 Bit, mono). */
export const BYTES_PER_SAMPLE = 2

/**
 * Rechnet Abtastwerte auf 24 kHz um.
 *
 * Lineare Interpolation: fuer Sprache ausreichend und billig genug, um im
 * Audio-Callback zu laufen. Stimmt die Rate bereits, wird nichts kopiert.
 */
export function resampleTo24k(input: Float32Array, inputRate: number): Float32Array {
  if (!Number.isFinite(inputRate) || inputRate <= 0) {
    throw new Error(`Ungueltige Abtastrate: ${inputRate}`)
  }
  if (inputRate === TARGET_SAMPLE_RATE) return input
  if (input.length === 0) return input

  const ratio = inputRate / TARGET_SAMPLE_RATE
  const outputLength = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    const weight = position - left
    output[i] = input[left] * (1 - weight) + input[right] * weight
  }

  return output
}

/**
 * Wandelt Float32 (-1..1) in Int16.
 *
 * Werte ausserhalb des Bereichs werden begrenzt statt umzuklappen — sonst wird aus
 * Uebersteuerung Knacken, das die Erkennung stoert.
 */
export function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i]))
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return output
}

/**
 * Kodiert PCM-Daten als Base64.
 *
 * Die Umwandlung laeuft blockweise, weil `String.fromCharCode` mit sehr grossen
 * Argumentlisten den Stack sprengt.
 */
export function pcm16ToBase64(input: Int16Array): string {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  const blockSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    const block = bytes.subarray(offset, offset + blockSize)
    binary += String.fromCharCode(...block)
  }
  return btoa(binary)
}

/** Dauer eines PCM-Puffers in Millisekunden. */
export function pcmDurationMs(sampleCount: number): number {
  return (sampleCount / TARGET_SAMPLE_RATE) * 1000
}

/** Fuegt mehrere PCM-Bloecke zu einem zusammen. */
export function concatPcm16(blocks: Int16Array[]): Int16Array {
  const total = blocks.reduce((sum, block) => sum + block.length, 0)
  const merged = new Int16Array(total)
  let offset = 0
  for (const block of blocks) {
    merged.set(block, offset)
    offset += block.length
  }
  return merged
}
