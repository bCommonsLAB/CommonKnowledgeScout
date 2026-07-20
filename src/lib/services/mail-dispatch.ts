/**
 * Zentraler Mail-Versand (Mailjet) mit Pflicht-Protokoll.
 *
 * EINZIGER Weg, ueber den die App E-Mails versendet: kapselt den Mailjet-
 * Client UND schreibt jeden Versandversuch (Erfolg + Fehler) in die
 * `mail_log`-Collection (Debugging: "ist die Mail rausgegangen?").
 *
 * Aufrufer (MailjetService, contact-mail-service) bauen nur noch die
 * Message und rufen `dispatchMail(kind, message, context)`.
 */

import Mailjet from 'node-mailjet'
import { logMailAttempt } from '@/lib/repositories/mail-log-repo'

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

/** Mailjet-v3.1-Message (Teilmenge, die die App verwendet). */
export interface MailjetMessage {
  From: { Email?: string; Name?: string }
  To: Array<{ Email: string; Name?: string }>
  ReplyTo?: { Email: string; Name?: string }
  Subject: string
  TextPart?: string
  HTMLPart?: string
}

/**
 * Versendet eine Mail und protokolliert den Versuch im Mail-Log.
 *
 * @param kind    Versandweg/Zweck (z.B. 'contact-form', 'invite') — Log-Filter.
 * @param message Mailjet-Message (From/To/Subject/Parts).
 * @param context Freier Debug-Kontext (libraryId, slug, User, …).
 * @returns true = Mailjet hat den Request akzeptiert; false = Fehler (geloggt).
 */
export async function dispatchMail(
  kind: string,
  message: MailjetMessage,
  context?: Record<string, unknown>,
): Promise<boolean> {
  const logBase = {
    kind,
    to: message.To.map((t) => t.Email),
    replyTo: message.ReplyTo?.Email,
    subject: message.Subject,
    text: message.TextPart,
    context,
  }
  // Log darf den Versand nie beeintraechtigen: `logMailAttempt` wirft per
  // Contract nicht — hier trotzdem defensiv abfangen (laut, nicht still).
  const safeLog = (entry: Parameters<typeof logMailAttempt>[0]) =>
    logMailAttempt(entry).catch((e) => console.error('[mail-dispatch] Mail-Log fehlgeschlagen:', e))

  try {
    const mailjet = getMailjetClient()
    await mailjet.post('send', { version: 'v3.1' }).request({ Messages: [message] })
    await safeLog({ ...logBase, status: 'sent' })
    console.log(`[mail-dispatch] ${kind} gesendet an ${logBase.to.join(', ')}`)
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await safeLog({ ...logBase, status: 'error', error: msg })
    console.error(`[mail-dispatch] ${kind} FEHLGESCHLAGEN an ${logBase.to.join(', ')}:`, error)
    return false
  }
}
