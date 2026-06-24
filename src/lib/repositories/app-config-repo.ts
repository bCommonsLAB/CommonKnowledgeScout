/**
 * Globale App-Konfiguration (Singleton-Dokument in MongoDB).
 *
 * Aktuell nur: `rootLibrarySlug` — die Library, deren Landingpage unter `/`
 * (Root) gerendert wird (E7). Bewusst eine eigene, kleine Collection statt
 * Env-Variable, damit der Wert spaeter ueber eine Admin-UI pflegbar ist.
 */

import { getCollection } from '@/lib/mongodb-service'

/** Globale, library-uebergreifende App-Einstellungen. */
export interface AppConfig {
  /** Slug der Library, deren Landingpage unter `/` gerendert wird (E7). */
  rootLibrarySlug?: string
}

interface AppConfigDoc {
  _id: string
  rootLibrarySlug?: string | null
}

const COLLECTION = 'app_config'
const SINGLETON_ID = 'global'

/** Liest die globale App-Config; leeres Objekt, wenn noch nichts gesetzt ist. */
export async function getAppConfig(): Promise<AppConfig> {
  const col = await getCollection<AppConfigDoc>(COLLECTION)
  const doc = await col.findOne({ _id: SINGLETON_ID })
  if (!doc) return {}
  return {
    rootLibrarySlug:
      typeof doc.rootLibrarySlug === 'string' && doc.rootLibrarySlug.trim().length > 0
        ? doc.rootLibrarySlug.trim()
        : undefined,
  }
}

/** Setzt (oder loescht mit `null`) die Root-Library-Slug-Einstellung. */
export async function setRootLibrarySlug(slug: string | null): Promise<void> {
  const col = await getCollection<AppConfigDoc>(COLLECTION)
  await col.updateOne(
    { _id: SINGLETON_ID },
    { $set: { rootLibrarySlug: slug && slug.trim().length > 0 ? slug.trim() : null } },
    { upsert: true },
  )
}
