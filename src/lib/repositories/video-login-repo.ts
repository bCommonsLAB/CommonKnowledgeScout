/**
 * @fileoverview Repository `video_logins`: Cookie-Datei je Konto, verschluesselt (Welle C2).
 *
 * @description
 * EIN Dokument je Person (userEmail). Der Inhalt der Cookie-Datei liegt nur
 * als `enc:v1:`-Token (AES-256-GCM, `credential-cipher.ts`) in der
 * Datenbank; daneben die Beschreibung (Zeilen, Domains, Ablauf), aus der
 * Oberflaeche und Bruecke den Status lesen. Der Klartext verlaesst den Server
 * nur Richtung Secretary, im Body eines Medien-Aufrufs. Es wird NIE geloggt.
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import { decryptSecret, encryptSecret } from '@/lib/security/credential-cipher'
import type { CookiesBeschreibung } from '@/lib/video-login/cookies-datei'

export interface VideoLoginDoc {
  _id?: string
  userEmail: string
  /** `enc:v1:`-Token der Cookie-Datei. */
  cookiesEnc: string
  beschreibung: CookiesBeschreibung
  createdAt: string
  updatedAt: string
}

const COLLECTION = 'video_logins'

let collectionCache: Collection<VideoLoginDoc> | null = null
let indexEnsured = false

async function getCol(): Promise<Collection<VideoLoginDoc>> {
  if (collectionCache) return collectionCache
  collectionCache = await getCollection<VideoLoginDoc>(COLLECTION)
  return collectionCache
}

async function ensureIndexes(): Promise<void> {
  if (indexEnsured) return
  const col = await getCol()
  await col.createIndex({ userEmail: 1 }, { unique: true })
  indexEnsured = true
}

function pruefeEmail(userEmail: string): string {
  const email = userEmail.trim()
  if (email === '') throw new Error('Video-Login-Repo: userEmail ist leer')
  return email
}

export async function upsertVideoLogin(userEmail: string, cookiesKlartext: string, beschreibung: CookiesBeschreibung): Promise<void> {
  const email = pruefeEmail(userEmail)
  await ensureIndexes()
  const col = await getCol()
  const now = new Date().toISOString()
  await col.updateOne(
    { userEmail: email },
    { $set: { cookiesEnc: encryptSecret(cookiesKlartext), beschreibung, updatedAt: now }, $setOnInsert: { userEmail: email, createdAt: now } },
    { upsert: true },
  )
}

/** Beschreibung und Zeitpunkte — ohne den verschluesselten Inhalt. */
export async function getVideoLoginBeschreibung(userEmail: string): Promise<Pick<VideoLoginDoc, 'beschreibung' | 'updatedAt'> | null> {
  const col = await getCol()
  const doc = await col.findOne({ userEmail: pruefeEmail(userEmail) }, { projection: { beschreibung: 1, updatedAt: 1 } })
  return doc ? { beschreibung: doc.beschreibung, updatedAt: doc.updatedAt } : null
}

/** Klartext der Cookie-Datei — nur serverseitig, nur fuer den Medien-Aufruf an den Secretary. */
export async function getVideoLoginCookies(userEmail: string): Promise<string | null> {
  const col = await getCol()
  const doc = await col.findOne({ userEmail: pruefeEmail(userEmail) }, { projection: { cookiesEnc: 1 } })
  return doc ? decryptSecret(doc.cookiesEnc) : null
}

export async function deleteVideoLogin(userEmail: string): Promise<boolean> {
  const col = await getCol()
  const result = await col.deleteOne({ userEmail: pruefeEmail(userEmail) })
  return result.deletedCount === 1
}
