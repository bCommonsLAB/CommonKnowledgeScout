/**
 * Versand der Kontakt-Formular-Nachrichten (Phase C3) ueber Mailjet.
 *
 * Eigenes kleines Modul (statt MailjetService zu erweitern): der Access-
 * Request-Service ist bereits gross und das Kontakt-Formular hat einen
 * eigenen Kontext (oeffentlicher Absender, Reply-To = Formular-Email).
 * ENV wie gehabt: MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL,
 * MAILJET_FROM_NAME.
 */

import Mailjet from 'node-mailjet'

let mailjetInstance: Mailjet | null = null

function getMailjetClient(): Mailjet {
  if (!mailjetInstance) {
    const apiKey = process.env.MAILJET_API_KEY || ''
    const apiSecret = process.env.MAILJET_API_SECRET || ''
    if (!apiKey || !apiSecret) {
      throw new Error('Mailjet API_KEY und API_SECRET sind erforderlich (ENV)')
    }
    mailjetInstance = new Mailjet({ apiKey, apiSecret })
  }
  return mailjetInstance
}

export interface ContactFormMailInput {
  /** Empfaenger (aus dem Kontakt-Doc, Frontmatter `contact_email`). */
  toEmail: string
  /** Name der Library/Website (Betreff-Kontext). */
  siteName: string
  name: string
  lastName?: string
  senderEmail: string
  message?: string
  newsletter: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Sendet die Kontakt-Nachricht an die konfigurierte Empfaenger-Adresse.
 * Wirft bei fehlender Mailjet-ENV; gibt `false` bei Versand-Fehler zurueck.
 */
export async function sendContactFormMail(input: ContactFormMailInput): Promise<boolean> {
  const fullName = [input.name, input.lastName].filter(Boolean).join(' ')
  const subject = `Kontaktanfrage über ${input.siteName}`
  const lines = [
    `Name: ${fullName}`,
    `E-Mail: ${input.senderEmail}`,
    `Newsletter gewünscht: ${input.newsletter ? 'ja' : 'nein'}`,
    '',
    input.message || '(keine Nachricht)',
  ]

  try {
    const mailjet = getMailjetClient()
    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL,
            Name: process.env.MAILJET_FROM_NAME || 'KnowledgeScout',
          },
          To: [{ Email: input.toEmail }],
          // Antworten gehen direkt an die Person aus dem Formular.
          ReplyTo: { Email: input.senderEmail, Name: fullName },
          Subject: subject,
          TextPart: lines.join('\n'),
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2d5016;">Kontaktanfrage über ${escapeHtml(input.siteName)}</h2>
              <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
              <p><strong>E-Mail:</strong> ${escapeHtml(input.senderEmail)}</p>
              <p><strong>Newsletter gewünscht:</strong> ${input.newsletter ? 'ja' : 'nein'}</p>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; white-space: pre-wrap;">${escapeHtml(input.message || '(keine Nachricht)')}</div>
            </div>
          `,
        },
      ],
    })
    console.log(`[contact-mail] Kontaktanfrage gesendet an ${input.toEmail} (${input.siteName})`)
    return true
  } catch (error) {
    console.error('[contact-mail] Versand fehlgeschlagen:', error)
    return false
  }
}
