/**
 * @fileoverview Medien einer Sammeldatei (`_media_files`) als Binaerfragmente
 * an ihren Twin haengen.
 *
 * Die Karten-Markdowns der Commoning-Mustersprache verweisen auf Vorschau- und
 * Kartenbilder in anderen Ordnern (`pdfs-pngs/previews/k1.png`). Der
 * Medien-Vertrag (`docs/contracts/media-lifecycle.md`) erlaubt im Frontmatter
 * nur Dateinamen, die als Nachbar oder als Binaerfragment des Twins
 * auffindbar sind. Deshalb werden die Bilder aus `_media_files` beim
 * Transformieren aufgeloest (Pfad wie bei `_source_files`), in den
 * Blob-Speicher geladen und am Twin der Sammeldatei registriert. Danach
 * sieht das Modell sie in „Verfuegbare Medien“, die Ingestion findet das Cover,
 * der Medien-Reiter zeigt sie — ohne Kopie in der Nextcloud.
 *
 * Nur Bilder; alles andere wird gemeldet, nicht still uebersprungen.
 */

import { FileLogger } from '@/lib/debug/logger'
import { isImageMediaFromName } from '@/lib/media-types'
import { getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { StorageProvider } from '@/lib/storage/types'
import { parseCompositeSourceEntry } from './composite-source-entry'
import { findCompositeSourceItems } from './composite-source-path'

/** Liest `_media_files` aus dem Frontmatter — Array oder JSON-String, sonst leer. */
export function parseCompositeMediaFilesFromMeta(meta: Record<string, unknown>): string[] {
  const raw = meta['_media_files']
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
    } catch {
      FileLogger.warn('composite-media', '_media_files ist kein gueltiges JSON-Array', { raw })
    }
  }
  return []
}

export interface RegisterCompositeMediaOptions {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  /** Storage-Id, Name und Ordner der Sammeldatei — Ziel-Twin der Fragmente. */
  compositeSourceId: string
  compositeFileName: string
  parentId: string
  /** Eintraege aus `_media_files` (Pfade relativ zur Sammeldatei oder zur Wurzel). */
  mediaFiles: string[]
}

export interface RegisterCompositeMediaResult {
  /** Dateinamen, die jetzt als Fragment am Twin haengen (neu oder schon vorhanden). */
  registered: string[]
  /** Eintraege, die nicht gefunden wurden oder keine Bilder sind. */
  unresolved: string[]
}

/**
 * Loest die Medien-Eintraege auf und registriert Bilder als Fragmente am Twin
 * der Sammeldatei. Ein Fragment gleichen Namens und gleicher Groesse wird nicht
 * erneut hochgeladen.
 */
export async function registerCompositeMediaFragments(
  options: RegisterCompositeMediaOptions,
): Promise<RegisterCompositeMediaResult> {
  const { libraryId, userEmail, provider, compositeSourceId, compositeFileName, parentId, mediaFiles } = options
  const registered: string[] = []
  const unresolved: string[] = []
  if (mediaFiles.length === 0) return { registered, unresolved }

  const entries = mediaFiles.map(parseCompositeSourceEntry)
  const found = await findCompositeSourceItems(provider, parentId, entries)
  const existing = (await getShadowTwinBinaryFragments(libraryId, compositeSourceId)) ?? []

  let service: ShadowTwinService | null = null
  for (const entry of entries) {
    const item = found.get(entry.raw)
    if (!item || !isImageMediaFromName(item.name)) {
      unresolved.push(entry.raw)
      continue
    }
    const binary = await provider.getBinary(item.id)
    const buffer = Buffer.from(await binary.blob.arrayBuffer())
    const vorhanden = existing.find((f) => f.name === item.name && f.variant !== 'thumbnail')
    if (vorhanden && vorhanden.size === buffer.length && vorhanden.url) {
      registered.push(item.name)
      continue
    }
    if (!service) {
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      service = await ShadowTwinService.create({
        library,
        userEmail,
        sourceId: compositeSourceId,
        sourceName: compositeFileName,
        parentId,
      })
    }
    await service.uploadBinaryFragment({
      buffer,
      fileName: item.name,
      mimeType: binary.mimeType || 'image/png',
      kind: 'image',
      variant: 'original',
    })
    registered.push(item.name)
  }

  FileLogger.info('composite-media', 'Medien der Sammeldatei registriert', {
    libraryId,
    compositeSourceId,
    registered,
    unresolved,
  })
  return { registered, unresolved }
}
