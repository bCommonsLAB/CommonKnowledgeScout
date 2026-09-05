/**
 * @fileoverview Testimonial-Schreibzugriff - gemeinsame Pruefkette fuer anonyme Beitraege
 *
 * @description
 * Public-Endpunkte (Diktat ohne Login, z.B. per QR-Link) duerfen nur arbeiten, wenn
 * Library und Event den Zugriff erlauben. Die Regel steckte bisher in der Audio-Route;
 * seit die Live-Transkription dieselbe Pruefung braucht, liegt sie hier — eine Regel,
 * eine Stelle.
 *
 * Regel:
 * - Owner wird ueber `resolveOwnerForTestimonials` aufgeloest (public ODER privat mit writeKey).
 * - Private Library: das Event MUSS einen `testimonialWriteKey` tragen und er MUSS passen.
 * - Public Library: ein `testimonialWriteKey` am Event ist optional, muss aber passen, wenn er da ist.
 *
 * @module public
 *
 * @exports
 * - TestimonialAccessError: Fehlerklasse mit HTTP-Status
 * - assertTestimonialWriteAccess: Prueft den Zugriff und liefert Owner und Provider
 *
 * @usedIn
 * - src/app/api/public/secretary/process-audio/route.ts
 * - src/app/api/public/secretary/realtime-session/route.ts
 *
 * @dependencies
 * - @/lib/public/public-library-owner: Owner-Aufloesung
 * - @/lib/storage/server-provider: Zugriff auf die Event-Datei
 * - @/lib/markdown/frontmatter: Lesen des writeKey aus dem Event-Frontmatter
 */

import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveOwnerForTestimonials } from '@/lib/public/public-library-owner'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

type ServerProvider = Awaited<ReturnType<typeof getServerProvider>>

/** Fehler der Zugriffspruefung, mit dem Status, den die Route zurueckgeben soll. */
export class TestimonialAccessError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'TestimonialAccessError'
    this.status = status
  }
}

export interface TestimonialWriteAccess {
  ownerEmail: string
  isPublicLibrary: boolean
  provider: ServerProvider
}

async function readEventWriteKeyIfAny(args: {
  provider: ServerProvider
  eventFileId: string
}): Promise<string | null> {
  const { blob } = await args.provider.getBinary(args.eventFileId)
  const markdown = await blob.text()
  const { meta } = parseFrontmatter(markdown)
  const key = typeof meta.testimonialWriteKey === 'string' ? meta.testimonialWriteKey.trim() : ''
  return key || null
}

/**
 * Prueft, ob fuer dieses Event anonym geschrieben werden darf.
 *
 * @throws TestimonialAccessError wenn Angaben fehlen, das Event unbekannt ist oder der
 *         writeKey nicht passt.
 */
export async function assertTestimonialWriteAccess(args: {
  libraryId: string
  eventFileId: string
  writeKey: string
}): Promise<TestimonialWriteAccess> {
  const { libraryId, eventFileId, writeKey } = args

  if (!libraryId || !eventFileId) {
    throw new TestimonialAccessError('libraryId und eventFileId sind erforderlich', 400)
  }

  const { ownerEmail, isPublicLibrary } = await resolveOwnerForTestimonials({ libraryId, writeKey })
  const provider = await getServerProvider(ownerEmail, libraryId)

  const eventItem = await provider.getItemById(eventFileId)
  if (!eventItem || eventItem.type !== 'file') {
    throw new TestimonialAccessError('Event-Datei nicht gefunden', 404)
  }

  const requiredKey = await readEventWriteKeyIfAny({ provider, eventFileId })

  if (!isPublicLibrary) {
    if (!requiredKey) {
      throw new TestimonialAccessError(
        'Event ist nicht für anonyme Testimonials freigegeben (testimonialWriteKey fehlt)',
        403
      )
    }
    if (requiredKey !== writeKey) {
      throw new TestimonialAccessError('Ungültiger writeKey', 403)
    }
  }

  if (isPublicLibrary && requiredKey && requiredKey !== writeKey) {
    throw new TestimonialAccessError('Ungültiger writeKey', 403)
  }

  return { ownerEmail, isPublicLibrary, provider }
}
