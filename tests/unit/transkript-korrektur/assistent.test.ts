import { describe, expect, it } from 'vitest'
import { baueAssistentNachricht, STANDARD_AUFTRAG } from '@/lib/transkript-korrektur/assistent-auftrag'
import { pruefeAssistentAntwort, satzMitKorrektur } from '@/lib/transkript-korrektur/assistent-pruefung'
import { ersetzungFuerSprecherwechsel, mitSprecher } from '@/lib/transkript-verlaesslichkeit/sprecher-wechsel'
import { zerlegeMitVorschlaegen } from '@/components/library/file-preview/views/audio-correction/satz-text'
import type { TranscriptSegment } from '@/lib/transkript-verlaesslichkeit/segmente'

const saetze = [
  { index: 0, text: 'Grazie Assunta.' },
  { index: 1, text: 'Frau Britzko hat gesagt, das stimmt.' },
  { index: 2, text: 'Ich habe eine Frage.' },
]
const begleit = [{ name: 'Flyer.pdf', text: 'Referentinnen: Sascha Britsko und Assunta Corbo. Moderation: Elisa Tafeiner.' }]

describe('Korrektur-Assistent: Auftrag', () => {
  it('Nachricht enthaelt Auftrag, festes Format, Begleitdokument und nummerierte Saetze', () => {
    const n = baueAssistentNachricht({ auftrag: STANDARD_AUFTRAG, saetze, begleittexte: begleit })
    expect(n).toContain('Sprecher: Markiere')
    expect(n).toContain('"ab_satz"')
    expect(n).toContain('### Flyer.pdf')
    expect(n).toContain('[1] Frau Britzko hat gesagt, das stimmt.')
  })
})

describe('Korrektur-Assistent: Pruefung der Antwort', () => {
  it('nimmt belegbare Korrekturen und Sprecher, verwirft den Rest mit Grund', () => {
    const r = pruefeAssistentAntwort({
      korrekturen: [
        { satz: 1, alt: 'Britzko', neu: 'Britsko', grund: 'Flyer' },
        { satz: 1, alt: 'Brizko', neu: 'Britsko' },
        { satz: 9, alt: 'x', neu: 'y' },
      ],
      sprecher: [
        { ab_satz: 2, name: 'Publikum', rolle: 'Publikum' },
        { ab_satz: 0, name: 'Elisa Tafeiner', rolle: 'Moderation' },
        { ab_satz: 1, name: 'Sascha Britsko', rolle: 'Referentin' },
        { ab_satz: 1, name: 'Max Muster' },
      ],
    }, saetze, begleit)
    expect(r.korrekturen.map((k) => k.alt)).toEqual(['Britzko'])
    expect(r.sprecher.map((s) => [s.abSatz, s.name])).toEqual([[0, 'Elisa Tafeiner'], [1, 'Sascha Britsko'], [2, 'Publikum']])
    expect(r.verworfen).toHaveLength(3)
    expect(r.verworfen.join(' ')).toContain('Max Muster')
  })

  it('Korrektur mit erfundenem Namen wird verworfen; bekannte Namen der Library belegen', () => {
    const s = [{ index: 0, text: 'Ja, Peter Eichner, ich bin Softwarearchitekt.' }]
    const r = pruefeAssistentAntwort({ korrekturen: [
      { satz: 0, alt: 'Peter Eichner', neu: 'Peter Anreiter' },
      { satz: 0, alt: 'Eichner', neu: 'Aichner' },
    ] }, s, [], ['Peter Aichner'])
    expect(r.korrekturen.map((k) => k.neu)).toEqual(['Aichner'])
    expect(r.verworfen[0]).toContain('Anreiter')
  })

  it('ohne Begleitdokumente nur Rollen, keine Namen', () => {
    const r = pruefeAssistentAntwort({ sprecher: [{ ab_satz: 0, name: 'Sascha Britsko' }, { ab_satz: 2, name: 'Moderation' }] }, saetze, [])
    expect(r.sprecher.map((s) => s.name)).toEqual(['Moderation'])
  })

  it('satzMitKorrektur ersetzt das erste Vorkommen im Satz', () => {
    expect(satzMitKorrektur('Frau Britzko hat gesagt.', { alt: 'Britzko', neu: 'Britsko' })).toBe('Frau Britsko hat gesagt.')
  })
})

describe('Sprecherwechsel', () => {
  it('setzen: neuer Absatz mit Praefix; Namen mit * oder : sind ein Fehler', () => {
    const seg = { text: 'Ich habe eine Frage.', speaker: null }
    expect(ersetzungFuerSprecherwechsel(seg, 'Publikum', 'Ich habe eine Frage.')).toEqual({ alt: 'Ich habe eine Frage.', neu: '\n\n**Publikum:** Ich habe eine Frage.' })
    expect(() => ersetzungFuerSprecherwechsel(seg, 'A: B', '')).toThrow()
    expect(() => ersetzungFuerSprecherwechsel(seg, null, '')).toThrow(/nichts zu entfernen/)
  })

  it('umbenennen tauscht nur das Praefix; entfernen nimmt Praefix und Absatzumbruch', () => {
    const seg = { text: 'Ich habe eine Frage.', speaker: 'Publikum' }
    expect(ersetzungFuerSprecherwechsel(seg, 'Anita Rossi', 'x\n\n**Publikum:** Ich habe eine Frage.'))
      .toEqual({ alt: '**Publikum:** Ich habe eine Frage.', neu: '**Anita Rossi:** Ich habe eine Frage.' })
    expect(ersetzungFuerSprecherwechsel(seg, null, 'x\n\n**Publikum:** Ich habe eine Frage.'))
      .toEqual({ alt: '\n\n**Publikum:** Ich habe eine Frage.', neu: 'Ich habe eine Frage.' })
    // Am Dateianfang gibt es keinen Umbruch davor.
    expect(ersetzungFuerSprecherwechsel(seg, null, '**Publikum:** Ich habe eine Frage.').alt).toBe('**Publikum:** Ich habe eine Frage.')
    expect(() => ersetzungFuerSprecherwechsel(seg, null, 'ganz anderer Text')).toThrow(/neu laden/)
  })

  it('setzt, benennt um und entfernt den Sprecher am Segment', () => {
    const seg = { start: 0, end: 1, text: 'x', speaker: null } as unknown as TranscriptSegment
    expect(mitSprecher([seg, seg], [{ satzIndex: 1, name: 'Publikum' }]).map((s) => s.speaker)).toEqual([null, 'Publikum'])
    expect(mitSprecher([{ ...seg, speaker: 'X' }], [{ satzIndex: 0, name: null }])[0].speaker).toBeNull()
    expect(() => mitSprecher([seg], [{ satzIndex: 3, name: 'X' }])).toThrow()
  })
})

describe('Revision im Text', () => {
  it('zerlegt den Satz an den Vorschlaegen, ueberlappende bleiben nur an der Karte', () => {
    const v = (alt: string, neu: string) => ({ id: alt, satz: 1, alt, neu, grund: '' })
    const teile = zerlegeMitVorschlaegen('Frau Britzko hat gesagt', [v('gesagt', 'gesagt.'), v('Britzko', 'Britsko'), v('Britzko hat', 'x')])
    expect(teile.map((t) => [t.text, t.vorschlag?.neu ?? null])).toEqual([
      ['Frau ', null], ['Britzko', 'Britsko'], [' hat ', null], ['gesagt', 'gesagt.'],
    ])
  })
})
