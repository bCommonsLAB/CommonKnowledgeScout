/**
 * Prompt mit Dokument-Nummern (D7): zwei Textstellen desselben Dokuments
 * tragen dieselbe Nummer, die Beschreibung nennt beide Stellen, und die
 * Anweisung verlangt Dokument-Nummern.
 */
import { describe, it, expect } from 'vitest'
import { buildChatMessages, buildContext } from '@/lib/chat/common/prompt'
import type { RetrievedSource } from '@/types/retriever'

const sources: RetrievedSource[] = [
  { id: 'a-0', fileId: 'a', fileName: 'Radwege.md', chunkIndex: 0, text: 'Radwege ausbauen.', sourceType: 'body' },
  { id: 'b-3', fileId: 'b', fileName: 'Heizen.md', chunkIndex: 3, text: 'Fernwaerme.', sourceType: 'body' },
  { id: 'a-2', fileId: 'a', fileName: 'Radwege.md', chunkIndex: 2, text: 'Kosten.', sourceType: 'body' },
]

describe('buildContext (D7)', () => {
  it('nummeriert je Dokument und weist die Textstelle aus', () => {
    const ctx = buildContext(sources)
    expect(ctx).toContain('Source [1] Radwege.md (passage 1/2, Markdown body chunk 1')
    expect(ctx).toContain('Source [2] Heizen.md (passage 1/1, Markdown body chunk 4')
    expect(ctx).toContain('Source [1] Radwege.md (passage 2/2, Markdown body chunk 3')
    expect(ctx).not.toContain('Source [3]')
  })
})

describe('buildChatMessages (D7)', () => {
  it('Beschreibungen je Dokument, Anweisung auf Dokument-Nummern', () => {
    const user = buildChatMessages('Frage?', sources, 'mittel', { targetLanguage: 'de' }).find((m) => m.role === 'user')
    expect(user?.content).toContain('[1] = Radwege.md (Markdown body chunk 1; Markdown body chunk 3)')
    expect(user?.content).toContain('[2] = Heizen.md (Markdown body chunk 4)')
    expect(user?.content).toContain('One number = one document')
    expect(user?.content).toContain('document numbers of all sources')
  })
})
