/**
 * Mail-Log-Repository — protokolliert JEDEN E-Mail-Versandversuch (Debugging).
 *
 * Bewusste Abweichung vom Per-Library-Pattern (mongodb-repository-pattern.md):
 * EINE globale Collection `mail_log`, damit alle Versandwege (Kontakt-Formular,
 * Zugriffsanfragen, Einladungen, …) an einem Ort inspizierbar sind. Der
 * Library-Bezug liegt als Feld im `context`.
 *
 * Der Logger darf den Versand NIE blockieren: Fehler beim Schreiben werden
 * laut geloggt (console.error), aber nicht geworfen.
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

const COLLECTION_NAME = 'mail_log'

export interface MailLogEntry {
  /** Versandweg/Zweck, z.B. 'contact-form', 'invite', 'access-approved'. */
  kind: string
  /** Empfaenger-Adressen. */
  to: string[]
  /** Reply-To (z.B. Formular-Absender beim Kontakt-Formular). */
  replyTo?: string
  subject: string
  /** Gekuerzter Text-Inhalt (max. 2000 Zeichen) — reicht zum Debuggen. */
  textPreview?: string
  /** 'sent' = Mailjet hat den Request akzeptiert; 'error' = Versand fehlgeschlagen. */
  status: 'sent' | 'error'
  /** Fehlermeldung bei status='error'. */
  error?: string
  /** Freier Kontext: libraryId, slug, ausloesender User, jobId, … */
  context?: Record<string, unknown>
  /** ISO-Zeitstempel des Versandversuchs. */
  createdAt: string
}

let cachedCollection: Collection<MailLogEntry> | null = null
let indexesEnsured = false

async function getCol(): Promise<Collection<MailLogEntry>> {
  if (cachedCollection) return cachedCollection
  cachedCollection = await getCollection<MailLogEntry>(COLLECTION_NAME)
  return cachedCollection
}

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return
  const col = await getCol()
  await col.createIndex({ createdAt: -1 })
  await col.createIndex({ kind: 1, createdAt: -1 })
  await col.createIndex({ status: 1, createdAt: -1 })
  indexesEnsured = true
}

const TEXT_PREVIEW_MAX = 2000

/**
 * Schreibt einen Versandversuch ins Mail-Log. Wirft nie — ein kaputtes Log
 * darf den eigentlichen Versand nicht beeintraechtigen (Fehler werden laut
 * auf der Konsole gemeldet).
 */
export async function logMailAttempt(
  entry: Omit<MailLogEntry, 'createdAt' | 'textPreview'> & { text?: string },
): Promise<void> {
  try {
    await ensureIndexes()
    const col = await getCol()
    const { text, ...rest } = entry
    await col.insertOne({
      ...rest,
      textPreview: typeof text === 'string' ? text.slice(0, TEXT_PREVIEW_MAX) : undefined,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    // Bewusst nicht werfen (siehe Modul-Kommentar) — aber laut melden.
    console.error('[mail-log] Schreiben des Mail-Logs fehlgeschlagen:', error)
  }
}
