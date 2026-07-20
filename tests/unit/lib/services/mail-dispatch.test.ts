/**
 * Tests fuer den zentralen Mail-Versand (dispatchMail):
 * - Erfolg -> Mailjet-Request + Log-Eintrag status='sent', Rueckgabe true
 * - Mailjet-Fehler -> Log-Eintrag status='error' mit Message, Rueckgabe false
 * - Log-Fehler blockiert den Versand nicht (Rueckgabe bleibt true)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requestMock = vi.fn()
vi.mock('node-mailjet', () => ({
  default: vi.fn().mockImplementation(() => ({
    post: vi.fn(() => ({ request: requestMock })),
  })),
}))

const logMailAttemptMock = vi.fn()
vi.mock('@/lib/repositories/mail-log-repo', () => ({
  logMailAttempt: (...args: unknown[]) => logMailAttemptMock(...args),
}))

import { dispatchMail } from '@/lib/services/mail-dispatch'

const MESSAGE = {
  From: { Email: 'noreply@example.org', Name: 'Test' },
  To: [{ Email: 'empfaenger@example.org' }],
  ReplyTo: { Email: 'absender@example.org' },
  Subject: 'Testbetreff',
  TextPart: 'Hallo Welt',
}

describe('dispatchMail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MAILJET_API_KEY = 'key'
    process.env.MAILJET_API_SECRET = 'secret'
    logMailAttemptMock.mockResolvedValue(undefined)
  })

  it('sendet und protokolliert mit status=sent', async () => {
    requestMock.mockResolvedValue({})

    const ok = await dispatchMail('contact-form', MESSAGE, { siteName: 'Oldies' })

    expect(ok).toBe(true)
    expect(requestMock).toHaveBeenCalledWith({ Messages: [MESSAGE] })
    expect(logMailAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'contact-form',
        to: ['empfaenger@example.org'],
        replyTo: 'absender@example.org',
        subject: 'Testbetreff',
        text: 'Hallo Welt',
        status: 'sent',
        context: { siteName: 'Oldies' },
      }),
    )
  })

  it('protokolliert Fehler mit status=error und liefert false', async () => {
    requestMock.mockRejectedValue(new Error('Mailjet down'))

    const ok = await dispatchMail('invite', MESSAGE)

    expect(ok).toBe(false)
    expect(logMailAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'invite', status: 'error', error: 'Mailjet down' }),
    )
  })

  it('Log-Fehler blockiert den Versand nicht', async () => {
    requestMock.mockResolvedValue({})
    // logMailAttempt wirft laut Contract nie — dispatchMail faengt defensiv ab.
    logMailAttemptMock.mockRejectedValue(new Error('Mongo weg'))

    const ok = await dispatchMail('invite', MESSAGE)

    expect(ok).toBe(true)
  })
})
