import { describe, it, expect } from 'vitest'
import {
  TARGET_SAMPLE_RATE,
  concatPcm16,
  floatToPcm16,
  pcm16ToBase64,
  pcmDurationMs,
  resampleTo24k,
} from '@/lib/live-transcription/pcm'

describe('resampleTo24k', () => {
  it('gibt die Eingabe unveraendert zurueck, wenn die Rate bereits stimmt', () => {
    const input = new Float32Array([0.1, 0.2, 0.3])
    expect(resampleTo24k(input, TARGET_SAMPLE_RATE)).toBe(input)
  })

  it('halbiert die Anzahl der Werte bei 48 kHz', () => {
    const input = new Float32Array(480)
    const output = resampleTo24k(input, 48000)
    expect(output.length).toBe(240)
  })

  it('verlaengert bei 16 kHz auf 24 kHz', () => {
    const input = new Float32Array(160)
    const output = resampleTo24k(input, 16000)
    expect(output.length).toBe(240)
  })

  it('haelt einen konstanten Pegel konstant', () => {
    const input = new Float32Array(100).fill(0.5)
    const output = resampleTo24k(input, 48000)
    for (const value of output) {
      expect(value).toBeCloseTo(0.5, 5)
    }
  })

  it('wirft bei ungueltiger Abtastrate statt still zu rechnen', () => {
    expect(() => resampleTo24k(new Float32Array(4), 0)).toThrow()
  })
})

describe('floatToPcm16', () => {
  it('wandelt Vollausschlag korrekt um', () => {
    const output = floatToPcm16(new Float32Array([0, 1, -1]))
    expect(output[0]).toBe(0)
    expect(output[1]).toBe(32767)
    expect(output[2]).toBe(-32768)
  })

  it('begrenzt Uebersteuerung statt sie umklappen zu lassen', () => {
    const output = floatToPcm16(new Float32Array([2.5, -2.5]))
    expect(output[0]).toBe(32767)
    expect(output[1]).toBe(-32768)
  })
})

describe('pcm16ToBase64', () => {
  it('kodiert little-endian', () => {
    // 1 als Int16 ist 0x01 0x00 -> Base64 "AQA="
    expect(pcm16ToBase64(new Int16Array([1]))).toBe('AQA=')
  })

  it('kommt mit grossen Bloecken zurecht', () => {
    const large = new Int16Array(200000)
    expect(() => pcm16ToBase64(large)).not.toThrow()
  })
})

describe('pcmDurationMs', () => {
  it('rechnet Abtastwerte in Millisekunden um', () => {
    expect(pcmDurationMs(TARGET_SAMPLE_RATE)).toBe(1000)
    expect(pcmDurationMs(TARGET_SAMPLE_RATE / 10)).toBe(100)
  })
})

describe('concatPcm16', () => {
  it('haengt Bloecke in der Reihenfolge aneinander', () => {
    const merged = concatPcm16([new Int16Array([1, 2]), new Int16Array([3])])
    expect(Array.from(merged)).toEqual([1, 2, 3])
  })
})
