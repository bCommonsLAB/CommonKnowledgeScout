import { describe, it, expect } from 'vitest'
import { GAP_PLACEHOLDER, TranscriptJournal } from '@/lib/live-transcription/transcript-journal'

describe('TranscriptJournal', () => {
  it('setzt abgeschlossene Abschnitte in zeitlicher Reihenfolge zusammen', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-2', 'zweiter Satz', 2000, 3000)
    journal.addCompleted('item-1', 'erster Satz', 0, 1000)

    expect(journal.toText()).toBe('erster Satz zweiter Satz')
  })

  it('uebergeht leere Abschnitte', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-1', '   ', 0, 1000)
    expect(journal.segments).toHaveLength(0)
  })

  it('stellt Sprecher-Labels voran', () => {
    const journal = new TranscriptJournal()
    journal.addSpeakerSegment({
      itemId: 'item-1',
      speaker: 'Sprecher A',
      text: 'Guten Morgen',
      startMs: 0,
      endMs: 1000,
    })

    expect(journal.toText()).toBe('Sprecher A: Guten Morgen')
  })

  it('ersetzt den ungegliederten Text, wenn Sprecher-Abschnitte nachkommen', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-1', 'Guten Morgen alle zusammen', 0, 2000)
    journal.addSpeakerSegment({
      itemId: 'item-1',
      speaker: 'Sprecher A',
      text: 'Guten Morgen',
      startMs: 0,
      endMs: 1000,
    })
    journal.addSpeakerSegment({
      itemId: 'item-1',
      speaker: 'Sprecher B',
      text: 'alle zusammen',
      startMs: 1000,
      endMs: 2000,
    })

    expect(journal.segments).toHaveLength(2)
    expect(journal.toText()).toBe('Sprecher A: Guten Morgen Sprecher B: alle zusammen')
  })

  it('nimmt keinen Gesamttext mehr auf, wenn Sprecher-Abschnitte vorliegen', () => {
    const journal = new TranscriptJournal()
    journal.addSpeakerSegment({
      itemId: 'item-1',
      speaker: 'Sprecher A',
      text: 'Guten Morgen',
      startMs: 0,
      endMs: 1000,
    })
    journal.addCompleted('item-1', 'Guten Morgen', 0, 1000)

    expect(journal.segments).toHaveLength(1)
  })

  it('zeigt offene Luecken als Platzhalter an ihrer Stelle', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-1', 'davor', 0, 1000)
    journal.openGap(1000, 'Verbindung weg')
    journal.addCompleted('item-2', 'danach', 5000, 6000)

    expect(journal.toText()).toBe(`davor ${GAP_PLACEHOLDER} danach`)
  })

  it('ersetzt den Platzhalter durch den nachgearbeiteten Text', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-1', 'davor', 0, 1000)
    const gapId = journal.openGap(1000, 'Verbindung weg')
    journal.addCompleted('item-2', 'danach', 5000, 6000)

    journal.closeGap(gapId, 5000, new Blob(['x']))
    journal.resolveGap(gapId, 'dazwischen')

    expect(journal.toText()).toBe('davor dazwischen danach')
    expect(journal.openGaps).toHaveLength(0)
  })

  it('markiert eine Luecke ohne Mitschnitt als gescheitert', () => {
    const journal = new TranscriptJournal()
    const gapId = journal.openGap(0, 'Verbindung weg')
    journal.closeGap(gapId, 1000, null)

    expect(journal.allGaps[0].state).toBe('gescheitert')
  })

  it('haelt fest, woher ein Abschnitt stammt', () => {
    const journal = new TranscriptJournal()
    journal.addCompleted('item-1', 'live erkannt', 0, 1000)
    const gapId = journal.openGap(1000, 'Verbindung weg')
    journal.closeGap(gapId, 2000, new Blob(['x']))
    journal.resolveGap(gapId, 'nachgearbeitet')

    const sources = journal.segments.map((segment) => segment.source)
    expect(sources).toEqual(['live', 'recovered'])
  })
})
