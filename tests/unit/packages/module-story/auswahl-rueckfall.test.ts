/**
 * `auswahlRueckfall` (08.11.2026): Eine Konversations-Auswahl mit nur lokaler
 * Frage-Kennung, die im Verlauf fehlt, faellt aufs juengste gespeicherte Paar
 * zurueck (sonst Uebersicht); eine fehlende gespeicherte Kennung bleibt.
 */
import { describe, it, expect } from 'vitest'
import { STORY_UEBERSICHT, auswahlRueckfall, type Nachricht } from '@ks/module-story/react'

const verlauf: Nachricht[] = [
  { id: 'q1-question', art: 'frage', text: 'Erste?', createdAt: '2026-11-08T10:00:00.000Z', queryId: 'q1' },
  { id: 'q1-answer', art: 'antwort', text: 'Eins.', createdAt: '2026-11-08T10:00:00.000Z', queryId: 'q1' },
  { id: 'q2-question', art: 'frage', text: 'Zweite?', createdAt: '2026-11-08T10:05:00.000Z', queryId: 'q2' },
  { id: 'q2-answer', art: 'antwort', text: 'Zwei.', createdAt: '2026-11-08T10:05:00.000Z', queryId: 'q2' },
]

describe('auswahlRueckfall', () => {
  it('lokale Kennung ohne Treffer → juengstes gespeichertes Paar', () => {
    expect(auswahlRueckfall(verlauf, { art: 'konversation', frageId: 'question-123' })).toEqual({
      art: 'konversation', queryId: 'q2', frageId: 'q2-question',
    })
  })

  it('lokale Kennung ohne Treffer in leerer Sitzung → Uebersicht', () => {
    expect(auswahlRueckfall([], { art: 'konversation', frageId: 'question-123' })).toEqual(STORY_UEBERSICHT)
  })

  it('lokale Frage ist im Verlauf (laufende Frage dieses Gastgebers) → kein Rueckfall', () => {
    const laufend: Nachricht = { id: 'question-123', art: 'frage', text: 'Laeuft?', createdAt: '2026-11-08T10:10:00.000Z' }
    expect(auswahlRueckfall([...verlauf, laufend], { art: 'konversation', frageId: 'question-123' })).toBeNull()
  })

  it('gespeicherte Kennung ohne Treffer bleibt gewaehlt (geteilter Link) → kein Rueckfall', () => {
    expect(auswahlRueckfall(verlauf, { art: 'konversation', queryId: 'bogus' })).toBeNull()
  })

  it('Uebersicht und Thema sind nie betroffen', () => {
    expect(auswahlRueckfall(verlauf, STORY_UEBERSICHT)).toBeNull()
    expect(auswahlRueckfall(verlauf, { art: 'thema', themaId: 't1' })).toBeNull()
  })
})
