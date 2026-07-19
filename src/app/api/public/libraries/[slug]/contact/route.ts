import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/library-service'
import { getCollectionNameForLibrary, getByFileIds } from '@/lib/repositories/vector-repo'
import { sendContactFormMail } from '@/lib/services/contact-mail-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Einfaches In-Memory-Rate-Limit pro IP (Phase C3): max. 5 Anfragen pro
 * 10 Minuten. Bewusst prozess-lokal (bei mehreren Instanzen gilt das Limit
 * pro Instanz) — fuer ein oeffentliches Kontakt-Formular ausreichend,
 * kombiniert mit Honeypot.
 */
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const requestLog = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entries = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (entries.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, entries)
    return true
  }
  entries.push(now)
  requestLog.set(ip, entries)
  return false
}

interface ContactRequestBody {
  fileId?: unknown
  name?: unknown
  lastName?: unknown
  email?: unknown
  message?: unknown
  newsletter?: unknown
  /** Honeypot-Feld — bei Menschen leer. */
  website?: unknown
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/public/libraries/[slug]/contact
 *
 * Oeffentliche Kontakt-Formular-API (anonym). Die Empfaenger-Adresse kommt
 * NICHT aus dem Request, sondern serverseitig aus dem Kontakt-Doc der Library
 * (Frontmatter `contact_email` im Doc mit der uebergebenen `fileId`). Fehlt
 * `contact_email`, wird mit 422 abgelehnt (kein stiller Fallback auf die
 * Owner-Email). Schutz: Honeypot + Rate-Limit pro IP.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: 'Slug fehlt' }, { status: 400 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
        { status: 429 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as ContactRequestBody

    // Honeypot: Bot hat das unsichtbare Feld ausgefuellt -> vorgeben, dass
    // gesendet wurde (kein Hinweis an den Bot), aber nichts versenden.
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      console.warn(`[contact] Honeypot ausgeloest (ip=${ip}, slug=${slug}) — kein Versand`)
      return NextResponse.json({ success: true })
    }

    const fileId = typeof body.fileId === 'string' ? body.fileId : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : undefined
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : undefined
    const newsletter = body.newsletter === true

    if (!fileId) return NextResponse.json({ error: 'fileId fehlt' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Gültige E-Mail-Adresse ist erforderlich' }, { status: 400 })
    }
    if (message && message.length > 5000) {
      return NextResponse.json({ error: 'Nachricht ist zu lang (max. 5000 Zeichen)' }, { status: 400 })
    }

    const libraryService = LibraryService.getInstance()
    const library = await libraryService.getPublicLibraryBySlug(slug)
    if (!library || library.config?.publicPublishing?.isPublic !== true) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    // Kontakt-Doc laden und `contact_email` serverseitig lesen.
    const collection = getCollectionNameForLibrary(library)
    const map = await getByFileIds(collection, library.id, [fileId])
    const docMeta = map.get(fileId)
    const docMetaJson = (docMeta?.docMetaJson && typeof docMeta.docMetaJson === 'object')
      ? docMeta.docMetaJson as Record<string, unknown>
      : undefined
    if (!docMeta || docMetaJson?.detailViewType !== 'website') {
      return NextResponse.json({ error: 'Kontakt-Dokument nicht gefunden' }, { status: 404 })
    }
    const contactEmail =
      typeof docMetaJson?.contact_email === 'string' && docMetaJson.contact_email.trim().length > 0
        ? docMetaJson.contact_email.trim()
        : null
    if (!contactEmail) {
      return NextResponse.json(
        { error: 'Kontakt-Formular ist nicht konfiguriert (contact_email fehlt im Dokument)' },
        { status: 422 },
      )
    }

    const siteName = library.config?.publicPublishing?.publicName || library.label
    const sent = await sendContactFormMail({
      toEmail: contactEmail,
      siteName,
      name,
      lastName,
      senderEmail: email,
      message,
      newsletter,
    })
    if (!sent) {
      return NextResponse.json(
        { error: 'Die Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contact] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 },
    )
  }
}
