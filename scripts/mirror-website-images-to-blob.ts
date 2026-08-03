/**
 * Spiegelt kuratierte Website-Bilder einer Library aus dem (auth-gegateten)
 * Storage-Ordner `web/images/` in den OEFFENTLICH lesbaren Azure-Blob-Container.
 * Danach sind die Bilder ueber direkte Blob-URLs anonym ladbar — genau wie die
 * Galerie-Karten.
 *
 * Blob-Konvention: `<container>/<libraryId>/website/images/<dateiname>`
 * (Container-Default `knowledgescout`, bewusst getrennt von der Ingest-Pipeline `books/`).
 *
 * Read (Library-Storage via StorageProvider) + Write (Blob). Idempotent:
 * ueberschreibt vorhandene Blobs. Es landen KEINE Library-Inhalte im Repo —
 * das Skript ist rein generisch, alle IDs kommen als Argumente.
 *
 * Aufruf:
 *   node --import tsx scripts/mirror-website-images-to-blob.ts \
 *     --user <owner-email> --library <library-id> [--files a.jpg,b.png]
 *
 * Ohne --files werden ALLE Bilddateien aus `web/images/` gespiegelt.
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { BlobServiceClient } from '@azure/storage-blob'
import { getServerProvider } from '../src/lib/storage/server-provider'

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER_NAME || 'knowledgescout'

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

interface CliArgs {
  user: string
  library: string
  files: string[] | null
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const user = get('--user')
  const library = get('--library')
  if (!user || !library) {
    throw new Error(
      'Pflicht-Argumente fehlen. Aufruf: --user <owner-email> --library <library-id> [--files a.jpg,b.png]',
    )
  }
  const filesRaw = get('--files')
  const files = filesRaw ? filesRaw.split(',').map((f) => f.trim()).filter(Boolean) : null
  return { user, library, files }
}

function contentTypeFor(name: string): string | null {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return IMAGE_CONTENT_TYPES[ext] ?? null
}

async function main(): Promise<void> {
  const { user, library, files } = parseArgs(process.argv.slice(2))

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING fehlt')

  const provider = await getServerProvider(user, library)

  // `web/images`-Ordner-ID ueber Namens-Traversal ermitteln.
  const root = await provider.listItemsById('root')
  const webFolder = root.find((i) => i.type === 'folder' && i.metadata.name.toLowerCase() === 'web')
  if (!webFolder) throw new Error('Ordner "web" nicht gefunden — bitte im Library-Storage anlegen')
  const webItems = await provider.listItemsById(webFolder.id)
  const imagesFolder = webItems.find(
    (i) => i.type === 'folder' && i.metadata.name.toLowerCase() === 'images',
  )
  if (!imagesFolder) throw new Error('Ordner "web/images" nicht gefunden — bitte im Library-Storage anlegen')
  const imageItems = await provider.listItemsById(imagesFolder.id)

  // Auswahl: explizite Liste oder alle Bilddateien des Ordners.
  const candidates = files
    ? files.map((name) => {
        const item = imageItems.find((i) => i.type === 'file' && i.metadata.name === name)
        if (!item) throw new Error(`Datei fehlt im Storage unter web/images/: ${name}`)
        return item
      })
    : imageItems.filter((i) => i.type === 'file')

  const svc = BlobServiceClient.fromConnectionString(conn)
  const container = svc.getContainerClient(CONTAINER)
  const account = svc.accountName
  const blobPrefix = `${library}/website/images`

  let uploaded = 0
  for (const item of candidates) {
    const fileName = item.metadata.name
    const contentType = contentTypeFor(fileName)
    if (!contentType) {
      // Kein stiller Skip: nicht-Bild-Dateien werden laut gemeldet.
      console.warn(`  UEBERSPRUNGEN (kein bekanntes Bildformat): ${fileName}`)
      continue
    }
    const { blob } = await provider.getBinary(item.id)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const blobPath = `${blobPrefix}/${fileName}`
    const blockBlob = container.getBlockBlobClient(blobPath)
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    })
    uploaded++
    console.log(`  hochgeladen (${buffer.length} B): https://${account}.blob.core.windows.net/${CONTAINER}/${blobPath}`)
  }

  if (uploaded === 0) throw new Error('Keine Bilddatei gespiegelt — web/images/ ist leer oder enthaelt nur unbekannte Formate')

  console.log(`\n${uploaded} Bild(er) gespiegelt. Blob-Basis-URL:`)
  console.log(`https://${account}.blob.core.windows.net/${CONTAINER}/${blobPrefix}`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('[mirror] Fehler:', e instanceof Error ? e.message : e)
  process.exit(1)
})
