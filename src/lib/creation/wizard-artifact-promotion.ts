/**
 * @fileoverview Wizard Artefakte "promoten" (Variante C)
 *
 * Ziel:
 * - Wizard arbeitet in `.wizard-sources` (Staging)
 * - Beim finalen Speichern werden Basisdatei + Artefakte in den Zielordner verschoben
 * - Optional: Staging kann danach leer sein (kein Löschen nötig, da move)
 *
 * DSGVO: Keine Inhalte loggen; nur IDs/Namen/Counts.
 */

import type { StorageProvider, StorageItem } from '@/lib/storage/types'

interface PromoteWizardArtifactsArgs {
  provider: StorageProvider
  /** Base PDF ID (liegt typischerweise in `.wizard-sources`) */
  baseFileId: string
  /** Zielordner (Inbox oder Container-Ordner) */
  destinationFolderId: string
}

function isFolderNamed(item: StorageItem, name: string): boolean {
  return item.type === 'folder' && item.metadata?.name === name
}

function isFileNamed(item: StorageItem, name: string): boolean {
  return item.type === 'file' && item.metadata?.name === name
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function ensureFolder(provider: StorageProvider, parentId: string, name: string): Promise<StorageItem> {
  const items = await provider.listItemsById(parentId)
  const existing = items.find((it) => isFolderNamed(it, name))
  if (existing) return existing
  return await provider.createFolder(parentId, name)
}

/**
 * Verschiebt eine Datei oder einen Ordner in den Zielordner, ohne zu duplizieren.
 * Wenn dort bereits ein Item mit dem selben Namen existiert: überspringen (best effort).
 */
async function moveIfNotExists(args: {
  provider: StorageProvider
  itemId: string
  itemName: string
  destinationFolderId: string
}): Promise<'moved' | 'skipped'> {
  const existing = await args.provider.listItemsById(args.destinationFolderId)
  const alreadyThere = existing.find((it) => it.metadata?.name === args.itemName && it.type)
  if (alreadyThere) return 'skipped'
  await args.provider.moveItem(args.itemId, args.destinationFolderId)
  return 'moved'
}

export async function promoteWizardArtifacts(args: PromoteWizardArtifactsArgs): Promise<{
  movedBase: 'moved' | 'skipped'
  movedArtifactFolder: 'moved' | 'skipped' | 'not_found'
  stagingFolderId?: string
  artifactFolderId?: string
  /** Base-File ID im Zielordner (best effort; kann sich durch move ändern, z.B. bei Filesystem-IDs) */
  destinationBaseFileId?: string
  /** Shadow‑Twin/Artefakt-Ordner ID im Zielordner (best effort; kann sich durch move ändern) */
  destinationArtifactFolderId?: string
  /** Namen zur Diagnose (kein Inhalt) */
  baseFileName?: string
  artifactFolderName?: string
}> {
  const { provider, baseFileId, destinationFolderId } = args

  const baseItem = await provider.getItemById(baseFileId)
  const stagingFolderId = baseItem.parentId || 'root'

  // Nur wenn wirklich `.wizard-sources` (sonst nichts tun)
  const stagingFolder = await provider.getItemById(stagingFolderId).catch(() => null)
  const isWizardSources = stagingFolder?.metadata?.name === '.wizard-sources'
  if (!isWizardSources) {
    return { movedBase: 'skipped', movedArtifactFolder: 'not_found' }
  }

  // Artefakt-Ordner: `.${baseFileName}` (z.B. ".176...pdf")
  const baseName = baseItem.metadata?.name || ''
  const artifactFolderName = baseName ? `.${baseName}` : ''

  let artifactFolderId: string | undefined
  if (artifactFolderName) {
    const stagingItems = await provider.listItemsById(stagingFolderId)
    const artifactFolder = stagingItems.find((it) => isFolderNamed(it, artifactFolderName))
    artifactFolderId = artifactFolder?.id
  }

  // Verschiebe Basis-PDF in Zielordner (Inbox/Container)
  const movedBase = baseName
    ? await moveIfNotExists({
        provider,
        itemId: baseItem.id,
        itemName: baseName,
        destinationFolderId,
      })
    : 'skipped'

  // Verschiebe Artefakt-Ordner in Zielordner (falls vorhanden)
  if (!artifactFolderId || !artifactFolderName) {
    // best effort: Ziel-ID des Base-Files ermitteln (IDs können sich nach move ändern)
    const destinationItems = await provider.listItemsById(destinationFolderId).catch(() => [])
    const destinationBase = destinationItems.find((it) => isFileNamed(it, baseName))
    return {
      movedBase,
      movedArtifactFolder: 'not_found',
      stagingFolderId,
      destinationBaseFileId: destinationBase?.id,
      baseFileName: baseName || undefined,
      artifactFolderName: artifactFolderName || undefined,
    }
  }

  // Wenn Zielordner bereits einen gleichnamigen Artefakt-Ordner hat, lassen wir den Staging-Ordner stehen
  const movedArtifactFolder = await moveIfNotExists({
    provider,
    itemId: artifactFolderId,
    itemName: artifactFolderName,
    destinationFolderId,
  })

  // best effort: Ziel-IDs ermitteln (IDs können sich nach move ändern)
  const destinationItems = await provider.listItemsById(destinationFolderId).catch(() => [])
  const destinationBase = destinationItems.find((it) => isFileNamed(it, baseName))
  const destinationArtifactFolder = destinationItems.find((it) => isFolderNamed(it, artifactFolderName))

  return {
    movedBase,
    movedArtifactFolder,
    stagingFolderId,
    artifactFolderId,
    destinationBaseFileId: destinationBase?.id,
    destinationArtifactFolderId: destinationArtifactFolder?.id,
    baseFileName: baseName || undefined,
    artifactFolderName: artifactFolderName || undefined,
  }
}


