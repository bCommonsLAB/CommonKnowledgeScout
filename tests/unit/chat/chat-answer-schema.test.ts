/**
 * Antwort-Schema und Prompt (D5): `shortTitle` kommt aus derselben Antwort
 * wie `answer`, ist optional (ein Modell ohne das Feld verwirft nicht die
 * Antwort) und steht im Prompt wie im JSON-Schema — es gibt keinen zweiten
 * LLM-Aufruf dafuer.
 */
import { describe, it, expect } from 'vitest'
import { chatAnswerSchemaJson, chatAnswerZodSchema } from '@/lib/chat/common/structured-schemas'
import { buildChatMessages } from '@/lib/chat/common/prompt'

describe('chatAnswerZodSchema', () => {
  it('akzeptiert Antworten mit und ohne shortTitle', () => {
    const basis = { answer: 'Text [1]', suggestedQuestions: ['Und weiter?'], usedReferences: [1] }
    expect(chatAnswerZodSchema.parse(basis).shortTitle).toBeUndefined()
    expect(chatAnswerZodSchema.parse({ ...basis, shortTitle: 'Heizen ohne Öl' }).shortTitle).toBe('Heizen ohne Öl')
  })

  it('JSON-Schema fuehrt shortTitle als optionale Eigenschaft (additionalProperties bleibt false)', () => {
    const schema = JSON.parse(chatAnswerSchemaJson) as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean }
    expect(schema.properties.shortTitle).toMatchObject({ type: 'string' })
    expect(schema.required).not.toContain('shortTitle')
    expect(schema.additionalProperties).toBe(false)
  })
})

describe('Prompt verlangt den Kurztitel in derselben Antwort', () => {
  it('die Nutzer-Nachricht nennt shortTitle als viertes Feld samt Beispiel', () => {
    const messages = buildChatMessages('Wie heizen wir morgen?', [], 'mittel', { targetLanguage: 'de' })
    const user = messages.find((m) => m.role === 'user')
    expect(user?.content).toContain('"shortTitle"')
    expect(user?.content).toContain('exactly these four fields')
    expect(user?.content).toContain('"shortTitle": "How X works"')
  })
})
