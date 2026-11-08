/**
 * Story-Sektion der Startseite wie eine Suche (08.11.2026): nur das juengste
 * Frage-Antwort-Paar ist sichtbar, der Verweis zaehlt die aelteren.
 */
import { describe, it, expect } from 'vitest'
import { paare, type Nachricht } from '@ks/module-story/react'
import { sichtbaresPaar } from '@/lib/website/story-sichtbares-paar'

function frage(id: string, text: string, queryId?: string): Nachricht {
  return { id, art: 'frage', text, createdAt: '2026-11-08T10:00:00.000Z', queryId }
}
function antwort(id: string, text: string, queryId: string): Nachricht {
  return { id, art: 'antwort', text, createdAt: '2026-11-08T10:00:05.000Z', queryId }
}

describe('sichtbaresPaar', () => {
  it('zeigt von drei beantworteten Fragen nur die letzte und zaehlt zwei fruehere', () => {
    const alle = paare([
      frage('f1', 'Erste?', 'q1'), antwort('a1', 'Eins.', 'q1'),
      frage('f2', 'Zweite?', 'q2'), antwort('a2', 'Zwei.', 'q2'),
      frage('f3', 'Dritte?', 'q3'), antwort('a3', 'Drei.', 'q3'),
    ])
    const s = sichtbaresPaar(alle)
    expect(s.paar?.frage.text).toBe('Dritte?')
    expect(s.paar?.antwort?.text).toBe('Drei.')
    expect(s.fruehere).toBe(2)
  })

  it('zeigt die laufende Frage ohne Antwort als sichtbares Paar', () => {
    const alle = paare([
      frage('f1', 'Erste?', 'q1'), antwort('a1', 'Eins.', 'q1'),
      frage('f2', 'Laeuft gerade?'),
    ])
    const s = sichtbaresPaar(alle)
    expect(s.paar?.frage.text).toBe('Laeuft gerade?')
    expect(s.paar?.antwort).toBeUndefined()
    expect(s.fruehere).toBe(1)
  })

  it('hat ohne Fragen kein Paar und nichts Frueheres', () => {
    expect(sichtbaresPaar([])).toEqual({ paar: null, fruehere: 0 })
  })

  it('zaehlt bei genau einer Frage nichts Frueheres', () => {
    const s = sichtbaresPaar(paare([frage('f1', 'Einzige?', 'q1'), antwort('a1', 'Ja.', 'q1')]))
    expect(s.paar?.frage.text).toBe('Einzige?')
    expect(s.fruehere).toBe(0)
  })
})
