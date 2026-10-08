/**
 * Welle B — die zwei Wege der Audio-Erschliessung: Aufruf vor Library vor
 * Standard, Herkunft benannt, naechster Schritt je Weg, Stapel gezaehlt.
 */
import { describe, it, expect } from 'vitest'
import { audioOptionenAusEingabe, bestimmeAudioWeg, fasseWegeZusammen } from '@/lib/mcp/erschliessen-wege'
import { audioKontextVonJob } from '@/lib/mcp/job-audio-kontext'
import type { Library } from '@/types/library'

const lib = (transcriptionSpeakerMode?: boolean): Library =>
  ({ id: 'lib', config: transcriptionSpeakerMode === undefined ? {} : { transcriptionSpeakerMode } }) as unknown as Library

describe('audioOptionenAusEingabe', () => {
  it('bildet die Bruecken-Eingabe auf die Job-Optionen der Pipeline-Route ab', () => {
    expect(audioOptionenAusEingabe({ sprecherErkennung: false, kontext: ' Vortrag Klima ', begriffe: ['Aichner', ' ', 'SHF'] }))
      .toEqual({ speakerMode: false, audioPrompt: 'Vortrag Klima', audioKeywords: ['Aichner', 'SHF'] })
    expect(audioOptionenAusEingabe({})).toEqual({})
  })
})

describe('bestimmeAudioWeg', () => {
  it('Aufruf schlaegt Library schlaegt Standard, jeweils mit Herkunft', () => {
    expect(bestimmeAudioWeg({ speakerMode: true }, lib(false))).toMatchObject({ weg: 'mit_sprechererkennung', herkunft: 'aufruf' })
    expect(bestimmeAudioWeg({}, lib(true))).toMatchObject({ weg: 'mit_sprechererkennung', herkunft: 'library' })
    expect(bestimmeAudioWeg({}, lib())).toMatchObject({ weg: 'ohne_sprechererkennung', herkunft: 'standard' })
  })

  it('nennt je Weg den naechsten Schritt: Korrektur-Reiter in beiden Faellen', () => {
    expect(bestimmeAudioWeg({ speakerMode: false }, lib()).naechsterSchritt).toMatch(/von Hand im Reiter „Korrektur"/)
    expect(bestimmeAudioWeg({ speakerMode: true }, lib()).naechsterSchritt).toMatch(/Sprecher-Zuordnung und Namen im Reiter „Korrektur"/)
  })
})

describe('fasseWegeZusammen', () => {
  it('zaehlt je Weg und ist null ohne Audio-Quellen', () => {
    const mit = bestimmeAudioWeg({ speakerMode: true }, lib())
    const ohne = bestimmeAudioWeg({}, lib())
    expect(fasseWegeZusammen([mit, undefined, ohne, ohne])).toEqual({ mit_sprechererkennung: 1, ohne_sprechererkennung: 2 })
    expect(fasseWegeZusammen([undefined])).toBeNull()
  })
})

describe('audioKontextVonJob', () => {
  it('liest die Optionen vom Job und benennt den Weg oder die Voreinstellung', () => {
    expect(audioKontextVonJob({ correlation: { options: { speakerMode: false, audioPrompt: 'Thema', audioKeywords: ['A', 1] } } }))
      .toEqual({ sprecherErkennung: false, weg: 'ohne_sprechererkennung', kontext: 'Thema', begriffe: ['A'] })
    expect(audioKontextVonJob({ correlation: { options: {} } }).weg).toMatch(/Library-Voreinstellung/)
  })
})
