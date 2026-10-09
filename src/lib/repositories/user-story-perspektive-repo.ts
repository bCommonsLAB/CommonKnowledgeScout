/**
 * @fileoverview Story-Perspektive je Benutzer (09.10.2026)
 *
 * @description
 * Eine Perspektive je angemeldeter Person, library-uebergreifend wie bisher im
 * localStorage. Schluessel ist die normalisierte E-Mail (Projektkonvention,
 * nicht die Clerk-ID). Das Repo prueft keine Rechte — die Route liefert nur
 * die eigene Perspektive der angemeldeten Person.
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import type { ProfilPerspektiveDto } from '@ks/contracts'
import { getCollection } from '@/lib/mongodb-service'
import { normalizeEmail } from '@/lib/auth/user-email'

const COLLECTION_NAME = 'user_story_perspektiven'

interface UserStoryPerspektiveDoc extends ProfilPerspektiveDto {
  userEmail: string
  updatedAt: string
}

let indexBereit = false

async function sammlung(): Promise<Collection<UserStoryPerspektiveDoc>> {
  const col = await getCollection<UserStoryPerspektiveDoc>(COLLECTION_NAME)
  if (!indexBereit) {
    await col.createIndex({ userEmail: 1 }, { unique: true, name: 'user_email_unique' })
    indexBereit = true
  }
  return col
}

function email(userEmail: string): string {
  const normalisiert = normalizeEmail(userEmail)
  if (!normalisiert) throw new Error('user-story-perspektive: userEmail ist erforderlich')
  return normalisiert
}

/** Die gespeicherte Perspektive oder `null`, wenn die Person noch keine hat. */
export async function getProfilPerspektive(userEmail: string): Promise<ProfilPerspektiveDto | null> {
  const col = await sammlung()
  const doc = await col.findOne({ userEmail: email(userEmail) }, { projection: { _id: 0, userEmail: 0, updatedAt: 0 } })
  return doc
}

/** Legt die Perspektive ab (ersetzt die bisherige). */
export async function setProfilPerspektive(userEmail: string, perspektive: ProfilPerspektiveDto): Promise<void> {
  const col = await sammlung()
  const userEmailNorm = email(userEmail)
  await col.updateOne(
    { userEmail: userEmailNorm },
    { $set: { ...perspektive, userEmail: userEmailNorm, updatedAt: new Date().toISOString() } },
    { upsert: true },
  )
}
