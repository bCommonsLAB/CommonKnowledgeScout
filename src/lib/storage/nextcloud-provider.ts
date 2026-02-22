/**
 * @fileoverview Nextcloud Provider - WebDAV-basierte Storage-Implementierung
 *
 * @description
 * Implementiert das StorageProvider Interface fuer Nextcloud via WebDAV.
 * Verwendet das `webdav` npm-Paket fuer alle Dateioperationen.
 * IDs sind base64-kodierte relative Pfade (wie beim Filesystem-Provider).
 *
 * @module storage
 *
 * @exports
 * - NextcloudProvider: Nextcloud/WebDAV storage provider
 *
 * @usedIn
 * - src/lib/storage/storage-factory.ts: Erstellt durch Factory fuer nextcloud-Libraries
 * - src/app/api/storage/nextcloud/route.ts: Server-seitige Operationen
 *
 * @dependencies
 * - webdav: WebDAV-Client-Bibliothek
 * - @/lib/storage/types: StorageProvider Interface
 */

import { createClient, type WebDAVClient, type FileStat, type ResponseDataDetailed } from 'webdav'
import { StorageProvider, StorageItem, StorageValidationResult } from './types'

/**
 * Kodiert einen relativen Pfad als base64-ID (kompatibel zum Filesystem-Provider).
 */
function pathToId(relativePath: string): string {
  if (!relativePath || relativePath === '/' || relativePath === '.') return 'root'
  const normalized = relativePath.replace(/^\/+|\/+$/g, '')
  if (!normalized) return 'root'
  return Buffer.from(normalized, 'utf-8').toString('base64')
}

/**
 * Dekodiert eine base64-ID zurueck zum relativen Pfad.
 */
function idToPath(id: string): string {
  if (id === 'root') return '/'
  const decoded = Buffer.from(id, 'base64').toString('utf-8')
  return '/' + decoded.replace(/^\/+|\/+$/g, '')
}

/**
 * Ermittelt den MIME-Type anhand des Dateinamens.
 */
function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    md: 'text/markdown',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    zip: 'application/zip',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

/**
 * Konvertiert ein WebDAV FileStat-Objekt in ein StorageItem.
 */
function fileStatToStorageItem(stat: FileStat, parentPath: string): StorageItem {
  const isDir = stat.type === 'directory'
  const name = stat.basename
  // Relativer Pfad innerhalb der Library (ohne fuehrenden Slash)
  const relPath = parentPath === '/'
    ? name
    : parentPath.replace(/^\/+/, '') + '/' + name
  const parentRelPath = parentPath.replace(/^\/+|\/+$/g, '')

  return {
    id: pathToId(relPath),
    parentId: parentRelPath ? pathToId(parentRelPath) : 'root',
    type: isDir ? 'folder' : 'file',
    metadata: {
      name,
      size: stat.size || 0,
      modifiedAt: new Date(stat.lastmod),
      mimeType: isDir ? 'application/folder' : (stat.mime || guessMimeType(name)),
    },
  }
}

/**
 * Maximale Retry-Versuche bei Rate-Limiting (429) oder temporaeren Server-Fehlern (503).
 */
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

/**
 * Fuehrt eine async Funktion mit Retry bei 429/503 aus.
 * Exponentielles Backoff: 1s → 2s → 4s. Respektiert Retry-After-Header falls vorhanden.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const status = (error as { status?: number }).status
      const isRetryable = status === 429 || status === 503

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error
      }

      // Retry-After-Header auswerten (Sekunden), sonst exponentielles Backoff
      const retryAfter = (error as { headers?: Record<string, string> }).headers?.['retry-after']
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_BACKOFF_MS * Math.pow(2, attempt)

      console.warn(
        `[NextcloudProvider] ${label}: ${status} – Retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`
      )
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }
  throw lastError
}

export class NextcloudProvider implements StorageProvider {
  name = 'Nextcloud (WebDAV)'
  id: string
  private client: WebDAVClient

  /**
   * @param webdavUrl  Vollstaendige WebDAV-URL (z.B. https://cloud.example.com/remote.php/dav/files/user)
   * @param username   Nextcloud-Benutzername
   * @param password   App-Passwort
   * @param libraryId  ID der Library (wird als Provider-ID verwendet)
   */
  constructor(
    webdavUrl: string,
    username: string,
    password: string,
    libraryId: string,
  ) {
    this.id = libraryId
    this.client = createClient(webdavUrl, {
      username,
      password,
    })
  }

  isAuthenticated(): boolean {
    // Credentials werden im Konstruktor gesetzt; wenn der Client existiert, ist er "authentifiziert"
    return true
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    try {
      // PROPFIND auf Root-Verzeichnis als Verbindungstest (mit Retry bei Rate-Limiting)
      await withRetry(() => this.client.getDirectoryContents('/'), 'validateConfiguration')
      return { isValid: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { isValid: false, error: `WebDAV-Verbindung fehlgeschlagen: ${msg}` }
    }
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const folderPath = idToPath(folderId)
    const contents = await withRetry(
      () => this.client.getDirectoryContents(folderPath, { deep: false }),
      `listItemsById(${folderId})`
    ) as FileStat[] | ResponseDataDetailed<FileStat[]>
    const stats = Array.isArray(contents) ? contents : contents.data

    // Erstes Element ist der Ordner selbst (bei manchen WebDAV-Servern) – herausfiltern
    return stats
      .filter(s => {
        const itemPath = s.filename.replace(/\/+$/, '')
        const parentPathNorm = folderPath.replace(/\/+$/, '') || ''
        return itemPath !== parentPathNorm
      })
      .map(s => fileStatToStorageItem(s, folderPath))
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    const itemPath = idToPath(itemId)
    const stat = await withRetry(
      () => this.client.stat(itemPath),
      `getItemById(${itemId})`
    ) as FileStat
    const parts = itemPath.split('/').filter(Boolean)
    parts.pop()
    const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/'

    return fileStatToStorageItem(stat, parentPath)
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const parentPath = idToPath(parentId)
    const newPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`
    await withRetry(() => this.client.createDirectory(newPath), `createFolder(${name})`)
    const stat = await withRetry(() => this.client.stat(newPath), `createFolder.stat(${name})`) as FileStat
    return fileStatToStorageItem(stat, parentPath)
  }

  async deleteItem(itemId: string): Promise<void> {
    const itemPath = idToPath(itemId)
    await withRetry(() => this.client.deleteFile(itemPath), `deleteItem(${itemId})`)
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    const sourcePath = idToPath(itemId)
    const fileName = sourcePath.split('/').pop() || ''
    const targetParent = idToPath(newParentId)
    const targetPath = targetParent === '/' ? `/${fileName}` : `${targetParent}/${fileName}`
    await withRetry(() => this.client.moveFile(sourcePath, targetPath), `moveItem(${itemId})`)
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    const sourcePath = idToPath(itemId)
    const parts = sourcePath.split('/')
    parts.pop()
    const parentPath = parts.join('/') || '/'
    const targetPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`
    await withRetry(() => this.client.moveFile(sourcePath, targetPath), `renameItem(${newName})`)
    const stat = await withRetry(() => this.client.stat(targetPath), `renameItem.stat(${newName})`) as FileStat
    return fileStatToStorageItem(stat, parentPath)
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    const parentPath = idToPath(parentId)
    const targetPath = parentPath === '/' ? `/${file.name}` : `${parentPath}/${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await withRetry(
      () => this.client.putFileContents(targetPath, buffer, { overwrite: true, contentLength: buffer.length }),
      `uploadFile(${file.name})`
    )
    const stat = await withRetry(() => this.client.stat(targetPath), `uploadFile.stat(${file.name})`) as FileStat
    return fileStatToStorageItem(stat, parentPath)
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const filePath = idToPath(fileId)
    const buffer = await withRetry(
      () => this.client.getFileContents(filePath),
      `getBinary(${fileId})`
    ) as Buffer
    const fileName = filePath.split('/').pop() || ''
    const mimeType = guessMimeType(fileName)
    return {
      blob: new Blob([buffer], { type: mimeType }),
      mimeType,
    }
  }

  async getPathById(itemId: string): Promise<string> {
    if (itemId === 'root') return '/'
    return idToPath(itemId)
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    // Proxy ueber die Nextcloud-API-Route (Credentials duerfen nicht an den Client)
    return `/api/storage/nextcloud?action=binary&fileId=${encodeURIComponent(itemId)}&libraryId=${encodeURIComponent(this.id)}`
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    return this.getStreamingUrl(itemId)
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    const rootItem: StorageItem = {
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: { name: 'root', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' },
    }

    if (itemId === 'root') return [rootItem]

    const fullPath = idToPath(itemId)
    const segments = fullPath.split('/').filter(Boolean)
    const pathItems: StorageItem[] = [rootItem]
    let currentPath = ''

    for (const segment of segments) {
      currentPath += '/' + segment
      try {
        const stat = await withRetry(
          () => this.client.stat(currentPath),
          `getPathItemsById.stat(${currentPath})`
        ) as FileStat
        const parentOfCurrent = currentPath.split('/').slice(0, -1).join('/') || '/'
        const item = fileStatToStorageItem(stat, parentOfCurrent)
        if (item.type === 'folder') {
          pathItems.push(item)
        }
      } catch {
        break
      }
    }

    return pathItems
  }
}
