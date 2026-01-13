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

