/**
 * @fileoverview Resolve owner email for public libraries
 *
 * @description
 * Some "public" flows (e.g. anonymous testimonial uploads) still need to write
 * into the library owner's Storage. Storage providers are configured per userEmail,
 * therefore we resolve a suitable owner email for a given public libraryId.
 *
 * Security note:
 * - This is only used for libraries that are explicitly public.
 * - Additional request-level guards (e.g. per-event write keys) are still required.
 */

import type { Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

export async function resolveOwnerEmailForPublicLibrary(libraryId: string): Promise<string> {
  const id = String(libraryId || '').trim()
  if (!id) throw new Error('libraryId fehlt')

  const collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries'
  const col = await getCollection<Document>(collectionName)

  // Find the first user entry that contains this library AND has it marked as public.
  // Structure in MongoDB: { email, libraries: [ { id, config: { publicPublishing: { isPublic }}} ... ] }
  const row = await col.findOne(
    {
      libraries: {
        $elemMatch: {
          id,
          'config.publicPublishing.isPublic': true,
        },
      },
    },
    { projection: { email: 1 } }
  )

  const email = typeof row?.email === 'string' ? row.email.trim() : ''
  if (!email) throw new Error('Owner-Email für public library konnte nicht aufgelöst werden')
  return email
}

/**
 * Für den anonymen Testimonial-Flow benötigen wir den Storage-Provider des Owners.
 *
 * Ursprünglich war der Public-Endpoint nur für "public libraries" gedacht und hat die Owner-Email
 * ausschließlich über `config.publicPublishing.isPublic=true` aufgelöst.
 *
 * In der Praxis wird der anonyme Flow aber auch für private Libraries verwendet – dann aber nur
 * mit einem per-Event `testimonialWriteKey` (QR-Link enthält writeKey).
 *
 * Diese Funktion:
 * - bevorzugt weiterhin die Public-Library-Auflösung (ohne writeKey-Zwang)
 * - fällt für private Libraries NUR mit vorhandenem writeKey auf eine allgemeine Owner-Suche zurück
 *
 * Sicherheitsprinzip:
 * - private Library => writeKey muss vorhanden sein, sonst keine Owner-Auflösung
 */
export async function resolveOwnerForTestimonials(args: {
  libraryId: string
  writeKey?: string
}): Promise<{ ownerEmail: string; isPublicLibrary: boolean }> {
  const libraryId = String(args.libraryId || '').trim()
  const writeKey = typeof args.writeKey === 'string' ? args.writeKey.trim() : ''
  if (!libraryId) throw new Error('libraryId fehlt')

  // 1) Public libraries: weiterhin wie bisher.
  try {
    const ownerEmail = await resolveOwnerEmailForPublicLibrary(libraryId)
    return { ownerEmail, isPublicLibrary: true }
  } catch {
    // 2) Private libraries: Owner nur auflösen, wenn writeKey vorhanden ist.
    if (!writeKey) {
      throw new Error('Diese Library ist nicht public. writeKey ist erforderlich.')
    }

    const collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries'
    const col = await getCollection<Document>(collectionName)

    // Struktur in MongoDB: { email, libraries: [ { id, ... } ... ] }
    const row = await col.findOne(
      {
        libraries: {
          $elemMatch: { id: libraryId },
        },
      },
      { projection: { email: 1 } }
    )

    const ownerEmail = typeof row?.email === 'string' ? row.email.trim() : ''
    if (!ownerEmail) throw new Error('Owner-Email für library konnte nicht aufgelöst werden')
    return { ownerEmail, isPublicLibrary: false }
  }
}

