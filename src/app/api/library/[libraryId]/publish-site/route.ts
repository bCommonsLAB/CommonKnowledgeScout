import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageProvider } from '@/lib/storage/types'
import { AzureStorageService } from '@/lib/services/azure-storage-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function contentTypeForPath(relativePath: string): string {
  const ext = (relativePath.split('.').pop() || '').toLowerCase()
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    map: 'application/json',
  }
  return map[ext] || 'application/octet-stream'
}

async function findWebFolderId(provider: StorageProvider): Promise<string | null> {
  const root = await provider.listItemsById('root')
  const web = root.find(
    (item) => item.type === 'folder' && item.metadata.name.toLowerCase() === 'web'
  )
  return web?.id ?? null
}

async function collectWebFiles(
  provider: StorageProvider,
  folderId: string,
  pathPrefix: string
): Promise<Array<{ relativePath: string; fileId: string }>> {
  const items = await provider.listItemsById(folderId)
  const out: Array<{ relativePath: string; fileId: string }> = []
  for (const item of items) {
    if (item.type === 'folder') {
      const sub = await collectWebFiles(
        provider,
        item.id,
        `${pathPrefix}${item.metadata.name}/`
      )
      out.push(...sub)
    } else {
      out.push({
        relativePath: `${pathPrefix}${item.metadata.name}`,
        fileId: item.id,
      })
    }
  }
  return out
}

/**
 * POST /api/library/[libraryId]/publish-site
 * Liest `web/` aus dem Storage, lädt alle Dateien als Snapshot nach Azure hoch,
 * setzt publicPublishing.siteUrl / siteVersion / sitePublished.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const { libraryId } = await params
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 })
    }

    const libraryService = LibraryService.getInstance()
    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const fullLibrary = await libraryService.getLibraryById(libraryId)
    if (!fullLibrary) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    const azureConfig = resolveAzureStorageConfig(fullLibrary.config ?? undefined)
    if (!azureConfig) {
      return NextResponse.json(
        { error: 'Azure Storage ist nicht konfiguriert (ENV oder Library Binary Storage).' },
        { status: 400 }
      )
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const webFolderId = await findWebFolderId(provider)
    if (!webFolderId) {
      return NextResponse.json(
        { error: 'Kein Ordner "web" im Bibliotheks-Root gefunden.' },
        { status: 400 }
      )
    }

    const files = await collectWebFiles(provider, webFolderId, '')
    const hasIndex = files.some(
      (f) => f.relativePath.toLowerCase() === 'index.html' || f.relativePath.toLowerCase().endsWith('/index.html')
    )
    if (!hasIndex) {
      return NextResponse.json(
        { error: 'Im Ordner "web" fehlt index.html.' },
        { status: 400 }
      )
    }

    const prevVersion = fullLibrary.config?.publicPublishing?.siteVersion ?? 0
    const nextVersion = prevVersion + 1

    const azure = new AzureStorageService(fullLibrary.config ?? undefined)
    if (!azure.isConfigured()) {
      return NextResponse.json({ error: 'Azure Storage Service nicht bereit.' }, { status: 500 })
    }

    const containerName = azureConfig.containerName

    for (const f of files) {
      const { blob } = await provider.getBinary(f.fileId)
      const buf = Buffer.from(await blob.arrayBuffer())
      const ct = contentTypeForPath(f.relativePath)
      await azure.uploadPublicSiteFile(
        containerName,
        libraryId,
        nextVersion,
        f.relativePath,
        buf,
        ct
      )
    }

    const siteUrl = azure.getPublicSiteFileUrl(containerName, libraryId, nextVersion, 'index.html')
    const sitePublishedAt = new Date().toISOString()

    const updatedLibrary = {
      ...fullLibrary,
      config: {
        ...fullLibrary.config,
        publicPublishing: {
          ...fullLibrary.config?.publicPublishing,
          slugName: fullLibrary.config?.publicPublishing?.slugName || '',
          publicName:
            fullLibrary.config?.publicPublishing?.publicName || fullLibrary.label,
          description: fullLibrary.config?.publicPublishing?.description || '',
          isPublic: fullLibrary.config?.publicPublishing?.isPublic ?? false,
          sitePublished: true,
          siteUrl,
          siteVersion: nextVersion,
          sitePublishedAt,
        },
      },
    }

    // Persistenz immer im Owner-Dokument (Co-Creator hat die Library nicht in getUserLibraries)
    const ownerEmail = await libraryService.findOwnerEmailForLibraryId(libraryId)
    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Owner der Library konnte nicht ermittelt werden.' },
        { status: 500 },
      )
    }

    const ok = await libraryService.updateLibrary(ownerEmail, updatedLibrary)
    if (!ok) {
      return NextResponse.json({ error: 'Library konnte nicht aktualisiert werden.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      siteUrl,
      siteVersion: nextVersion,
      sitePublishedAt,
    })
  } catch (error) {
    console.error('[publish-site] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    )
  }
}
