/**
 * @fileoverview Sidecar-Loader fuer Liefersystem-Stammdaten (Stufe 1).
 *
 * @description
 * Laedt `api2_GetJsonOptionValues.json` aus dem Verzeichnis der Textur
 * (gleiche Ebene) ueber den StorageProvider — KEIN direkter Backend-Zugriff
 * (siehe storage-abstraction.mdc). Filtert IsTexture === "True"
 * (Plan Edge-Case #3). Kein stiller Fallback: fehlt das Optionvalues-Objekt,
 * wird ein Fehler geworfen.
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { OptionvalueEntry, SupplierData, SupplierEntry } from './types'

/** Dateiname der Liefersystem-Sidecar im Texturverzeichnis. */
export const SIDECAR_FILENAME = 'api2_GetJsonOptionValues.json'

interface SidecarShape {
  Optionvalues?: Record<string, unknown>
}

/** Type-Guard fuer einen Optionvalue-Eintrag aus den externen Stammdaten. */
function isOptionvalueEntry(value: unknown): value is OptionvalueEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.VCodex === 'string' && typeof v.IsTexture === 'string'
}

/**
 * Ermittelt die Ordner-ID des Texturverzeichnisses aus der geoeffneten Datei.
 * Die Sidecar liegt immer auf derselben Ebene wie die Textur — parentId der
 * Datei ist die verbindliche Quelle (nicht ein Pfad aus der Library-Root).
 */
export async function resolveTextureDirectoryId(
  provider: StorageProvider,
  textureFileId: string,
): Promise<string> {
  const item = await provider.getItemById(textureFileId)
  if (!item.parentId) {
    throw new Error(
      `Textur-Datei "${item.metadata.name}" hat kein parentId — Sidecar kann nicht im Texturverzeichnis gesucht werden`,
    )
  }
  return item.parentId
}

/**
 * Laedt die Sidecar-Datei aus dem Texturverzeichnis und gibt die
 * Textur-Eintraege zurueck.
 *
 * @param provider StorageProvider (server- oder client-seitig).
 * @param textureDirectoryId Ordner-ID, in dem die Textur liegt (parentId der Datei).
 * @returns SupplierData oder null, wenn keine Sidecar-Datei vorhanden ist.
 */
export async function loadSupplierData(
  provider: StorageProvider,
  textureDirectoryId: string,
): Promise<SupplierData | null> {
  const siblings = await provider.listItemsById(textureDirectoryId)
  const sidecar = siblings.find(
    (it) => it.type === 'file' && it.metadata.name.toLowerCase() === SIDECAR_FILENAME.toLowerCase(),
  )
  if (!sidecar) return null

  const { blob } = await provider.getBinary(sidecar.id)
  const text = await blob.text()
  const parsed = JSON.parse(text) as SidecarShape

  const optionvalues = parsed.Optionvalues
  if (!optionvalues || typeof optionvalues !== 'object') {
    throw new Error(
      `Sidecar "${sidecar.metadata.name}" enthaelt kein gueltiges Optionvalues-Objekt`,
    )
  }

  const entries: SupplierEntry[] = []
  let ignoredNonTextureCount = 0
  for (const [key, raw] of Object.entries(optionvalues)) {
    if (!isOptionvalueEntry(raw)) continue
    if (raw.IsTexture !== 'True') {
      ignoredNonTextureCount += 1
      continue
    }
    entries.push({ key, entry: raw })
  }

  return { sourceFileName: sidecar.metadata.name, entries, ignoredNonTextureCount }
}
