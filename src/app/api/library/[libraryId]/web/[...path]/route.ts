import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function detectContentType(pathSegments: string[], mimeType?: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType
  const last = pathSegments[pathSegments.length - 1] || ''
  const ext = (last.split('.').pop() || '').toLowerCase()
  switch (ext) {
    case 'html':
      return 'text/html; charset=utf-8'
    case 'css':
      return 'text/css; charset=utf-8'
    case 'js':
      return 'application/javascript; charset=utf-8'
    case 'json':
      return 'application/json; charset=utf-8'
    case 'svg':
      return 'image/svg+xml'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'woff':
      return 'font/woff'
    case 'woff2':
      return 'font/woff2'
    case 'ttf':
      return 'font/ttf'
    case 'otf':
      return 'font/otf'
    default:
      return 'application/octet-stream'
  }
}

function stripScripts(html: string): string {
  const noScriptBlocks = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  return noScriptBlocks.replace(/<script\b[^>]*\/?>/gi, '')
}

function injectBaseHrefIfMissing(html: string, baseHref: string): string {
  if (/<base\s+href=/i.test(html)) return html
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
  }
  return `<base href="${baseHref}">${html}`
}

async function resolvePathToItem(
  provider: StorageProvider,
  rawSegments: string[]
): Promise<StorageItem | null> {
  const segments = rawSegments
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean)

  if (segments.length === 0) return null

  let currentFolderId = 'root'
  let currentItem: StorageItem | null = null

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const siblings = await provider.listItemsById(currentFolderId)
    const nextItem =
      siblings.find((item) => item.metadata.name === segment) ||
      siblings.find((item) => item.metadata.name.toLowerCase() === segment.toLowerCase())

    if (!nextItem) return null
    currentItem = nextItem

    const isLastSegment = i === segments.length - 1
    if (!isLastSegment) {
      if (nextItem.type !== 'folder') return null
      currentFolderId = nextItem.id
    }
  }

  return currentItem
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; path: string[] }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    }

    const { libraryId, path } = await params
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 })
    }
    if (!Array.isArray(path) || path.length === 0) {
      return NextResponse.json({ error: 'Pfad fehlt' }, { status: 400 })
    }

    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    let item = await resolvePathToItem(provider, path)

    // Falls ein Ordner aufgerufen wird, versuche index.html als Einstieg.
    if (item?.type === 'folder') {
      const children = await provider.listItemsById(item.id)
      const indexFile =
        children.find((child) => child.type === 'file' && child.metadata.name === 'index.html') ||
        children.find((child) => child.type === 'file' && child.metadata.name.toLowerCase() === 'index.html')
      item = indexFile || null
    }

    if (!item || item.type !== 'file') {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
    }

    const { blob, mimeType } = await provider.getBinary(item.id)
    const contentType = detectContentType(path, mimeType)

    if (contentType.startsWith('text/html')) {
      const html = await blob.text()
      const scriptFreeHtml = stripScripts(html)
      const basePath = path.slice(0, Math.max(0, path.length - 1)).map(encodeURIComponent).join('/')
      const baseHref = `/api/library/${encodeURIComponent(libraryId)}/web/${basePath ? `${basePath}/` : ''}`
      const normalizedHtml = injectBaseHrefIfMissing(scriptFreeHtml, baseHref)

      return new NextResponse(normalizedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
        },
      })
    }

    const buffer = await blob.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': blob.size.toString(),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[Library Web API] Fehler beim Laden der Web-Datei:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    )
  }
}
