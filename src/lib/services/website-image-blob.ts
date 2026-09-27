/**
 * @fileoverview Website-Bilder im oeffentlichen Blob (B3).
 *
 * @description
 * Derselbe Weg wie `scripts/mirror-website-images-to-blob.ts`, als Dienst:
 * Blob-Konvention `<container>/<libraryId>/website/images/<dateiname>`,
 * Container-Default `knowledgescout` (bewusst getrennt von der
 * Ingest-Pipeline). Die URLs sind anonym lesbar — genau das braucht die
 * Landingpage (Contract website-landingpage §5).
 *
 * @module services
 */

import { BlobServiceClient } from '@azure/storage-blob'

export const BILD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

/** Content-Type nach Dateiendung — `null` = kein bekanntes Bildformat. */
export function bildContentType(dateiname: string): string | null {
  const ext = (dateiname.split('.').pop() || '').toLowerCase()
  return BILD_CONTENT_TYPES[ext] ?? null
}

export interface WebsiteBildZiel {
  container: ReturnType<BlobServiceClient['getContainerClient']>
  containerName: string
  accountName: string
  prefix: string
}

/**
 * Verbindung aus der Prozess-Umgebung. Fehlt der Schluessel, ist das ein
 * Fehler mit Namen der Variable — kein stiller Rueckfall auf lokale Pfade.
 */
export function websiteBildZiel(libraryId: string): WebsiteBildZiel {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING ist auf dem Server nicht gesetzt — Bilder koennen nicht veroeffentlicht werden')
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'knowledgescout'
  const svc = BlobServiceClient.fromConnectionString(conn)
  return {
    container: svc.getContainerClient(containerName),
    containerName,
    accountName: svc.accountName,
    prefix: `${libraryId}/website/images`,
  }
}

export function websiteBildUrl(ziel: WebsiteBildZiel, dateiname: string): string {
  return `https://${ziel.accountName}.blob.core.windows.net/${ziel.containerName}/${ziel.prefix}/${dateiname}`
}

export interface BildVeroeffentlichung {
  dateiname: string
  url: string
  bytes: number
  /** true = Blob existierte schon und wurde NICHT ueberschrieben. */
  vorhanden: boolean
}

/** Legt ein Bild im Blob ab; bei vorhandenem Namen nur mit `ueberschreiben`. */
export async function veroeffentlicheWebsiteBild(args: {
  ziel: WebsiteBildZiel
  dateiname: string
  buffer: Buffer
  ueberschreiben: boolean
}): Promise<BildVeroeffentlichung> {
  const { ziel, dateiname, buffer, ueberschreiben } = args
  const contentType = bildContentType(dateiname)
  if (!contentType) throw new Error(`"${dateiname}" hat kein bekanntes Bildformat (${Object.keys(BILD_CONTENT_TYPES).join(', ')})`)
  const blockBlob = ziel.container.getBlockBlobClient(`${ziel.prefix}/${dateiname}`)
  const url = websiteBildUrl(ziel, dateiname)
  if (!ueberschreiben && (await blockBlob.exists())) {
    return { dateiname, url, bytes: buffer.length, vorhanden: true }
  }
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'public, max-age=31536000' },
  })
  return { dateiname, url, bytes: buffer.length, vorhanden: false }
}

/** Alle Website-Bilder der Library im Blob, mit URL und Groesse. */
export async function listeWebsiteBilder(ziel: WebsiteBildZiel): Promise<Array<{ dateiname: string; url: string; bytes: number }>> {
  const bilder: Array<{ dateiname: string; url: string; bytes: number }> = []
  for await (const blob of ziel.container.listBlobsFlat({ prefix: `${ziel.prefix}/` })) {
    const dateiname = blob.name.slice(ziel.prefix.length + 1)
    if (!dateiname) continue
    bilder.push({ dateiname, url: websiteBildUrl(ziel, dateiname), bytes: blob.properties.contentLength ?? 0 })
  }
  return bilder
}
