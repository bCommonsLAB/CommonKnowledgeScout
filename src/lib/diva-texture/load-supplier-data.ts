/**
 * @fileoverview Sidecar-Loader fuer Liefersystem-Stammdaten (Stufe 1).
 *
 * @description
 * Laedt `optionvalues.json` aus dem Grosseltern-Ordner des Texturverzeichnisses
 * (zwei Ebenen hoeher, z.B. ILN/textures/_tex → Sidecar in ILN/) ueber den
 * StorageProvider — KEIN direkter Backend-Zugriff (siehe storage-abstraction.mdc).
 * Filtert IsTexture === "True" (Plan Edge-Case #3). Kein stiller Fallback: fehlt
 * das Optionvalues-Objekt, wird ein Fehler geworfen. Der Legacy-Dateiname
 * api2_GetJsonOptionValues.json wird bewusst ignoriert.
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { OptionvalueEntry, SupplierData, SupplierEntry } from './types'

/** Dateiname der Liefersystem-Sidecar im Grosseltern-Ordner des Texturverzeichnisses. */
export const SIDECAR_FILENAME = 'optionvalues.json'

interface SidecarShape {
  Optionvalues?: Record<string, unknown>
}

/** Type-Guard fuer einen Optionvalue-Eintrag aus den externen Stammdaten. */
function isOptionvalueEntry(value: unknown): value is OptionvalueEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.IsTexture === 'string'
}

/** True, wenn der Eintrag einen nutzbaren PFTFile-Schluessel hat. */
export function hasTexturePftKey(entry: OptionvalueEntry): boolean {
  return typeof entry.PFTFile === 'string' && entry.PFTFile.trim().length > 0
}

/**
 * Stabiler Item-Key einer Textur (= getrimmtes PFTFile).
 * Wirft, wenn PFTFile fehlt — kein stiller Fallback auf VCodex.
 */
export function resolveTextureItemKey(entry: OptionvalueEntry): string {
  const key = entry.PFTFile?.trim()
  if (!key) {
    throw new Error('Textur-Eintrag ohne PFTFile — kein stabiler Schluessel')
  }
  return key
}

/** parentId ist nutzbar, wenn gesetzt und nicht Library-Root. */
function isUsableParentId(parentId: string | undefined | null): parentId is string {
  return typeof parentId === 'string' && parentId.length > 0 && parentId !== 'root'
}

/**
 * Ermittelt die Ordner-ID des Texturverzeichnisses aus der geoeffneten Datei.
 * parentId der Datei ist die verbindliche Quelle (nicht ein Pfad aus der Library-Root).
 */
export async function resolveTextureDirectoryId(
  provider: StorageProvider,
  textureFileId: string,
): Promise<string> {
  const item = await provider.getItemById(textureFileId)
  if (!item.parentId) {
    throw new Error(
      `Textur-Datei "${item.metadata.name}" hat kein parentId — Sidecar kann nicht ueber den Texturordner aufgeloest werden`,
    )
  }
  return item.parentId
}

/**
 * Liefert die ID des Grosseltern-Ordners (zwei Ebenen ueber folderId).
 * Fehlt Eltern oder Grosseltern → null (kein stiller Fallback).
 */
export async function resolveGrandparentFolderId(
  provider: StorageProvider,
  folderId: string,
): Promise<string | null> {
  const folder = await provider.getItemById(folderId)
  if (!isUsableParentId(folder.parentId)) return null

  const parent = await provider.getItemById(folder.parentId)
  if (!isUsableParentId(parent.parentId)) return null

  return parent.parentId
}

/**
 * Laedt die Sidecar-Datei aus dem Grosseltern-Ordner des Texturverzeichnisses
 * und gibt die Textur-Eintraege zurueck.
 *
 * @param provider StorageProvider (server- oder client-seitig).
 * @param textureDirectoryId Ordner-ID, in dem die Textur liegt (parentId der Datei).
 * @returns SupplierData oder null, wenn keine Sidecar-Datei vorhanden ist.
 */
export async function loadSupplierData(
  provider: StorageProvider,
  textureDirectoryId: string,
): Promise<SupplierData | null> {
  const grandparentId = await resolveGrandparentFolderId(provider, textureDirectoryId)
  if (!grandparentId) return null

  const siblings = await provider.listItemsById(grandparentId)
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
    // Textur-Eintraege brauchen PFTFile als stabilen Schluessel (nicht VCodex).
    if (!hasTexturePftKey(raw)) continue
    entries.push({ key, entry: raw })
  }

  return {
    sourceFileName: sidecar.metadata.name,
    modifiedAt: sidecar.metadata.modifiedAt,
    entries,
    ignoredNonTextureCount,
  }
}
