/**
 * @fileoverview Streaming-URL API Route - Provider-agnostische Binary-URL
 *
 * @description
 * Redirect-Route, die fuer beliebige Storage-Backends (Local, OneDrive, Azure, ...)
 * eine Binary-Streaming-URL aufloest.
 *
 * Phase 4 (media-storage-determinismus):
 * Die Route prueft ZUERST in MongoDB (`binaryFragments`), ob das gesuchte Bild bereits
 * mit einer absoluten Azure-URL hinterlegt ist. Trifft das zu -> 302 direkt auf die Azure-URL,
 * ohne den Storage-Provider zu fragen. Damit verschwindet der Filesystem-Lookup-Spam, der
 * bei `azure-only`-Konfiguration entstand, und der Browser laedt deterministisch direkt aus Azure.
 *
 * Erst wenn:
 *  - kein Mongo-Match existiert UND
 *  - die Library-Strategie einen Filesystem-Fallback erlaubt,
 * wird der Provider als Fallback befragt.
 *
 * @module storage
 *
 * @exports
 * - GET: Redirect auf die aufgeloeste Streaming-URL
 *
 * @usedIn
 * - UI-Komponenten (markdown-preview, markdown-metadata, event-slides)
 *   als provider-agnostische Binary-URL fuer <img>, <audio>, etc.
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/storage/server-provider: getServerProvider
 * - @/lib/repositories/shadow-twin-repo: Mongo-Lookup-First
 * - @/lib/services/library-service + media-storage-strategy: Strategie-Auswertung
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getRequestPublicOrigin } from '@/lib/http/request-public-origin'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findBinaryFragmentInLibraryByLookupName } from '@/lib/repositories/shadow-twin-repo'
import { LibraryService } from '@/lib/services/library-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { getMediaStorageStrategy } from '@/lib/shadow-twin/media-storage-strategy'
import { FileLogger } from '@/lib/debug/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const libraryId = searchParams.get('libraryId')
  const fileId = searchParams.get('fileId')

  if (!libraryId || !fileId) {
    return NextResponse.json(
      { error: 'libraryId und fileId sind erforderlich' },
      { status: 400 }
    )
  }

  try {
    // Authentifizierung
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 })
    }
    const userEmail = user.emailAddresses[0].emailAddress

    // ─── Phase 4: Mongo-Lookup-First fuer Bilder ────────────────────────────────
    // Die fileId ist (in Bild-Pfaden aus dem MarkdownPreview) eine base64-kodierte
    // Pfad-Repraesentation, deren letztes Segment dem Bilddateinamen entspricht.
    // Wir versuchen, daraus einen Lookup-Namen zu extrahieren und in den binaryFragments
    // der Library zu suchen, BEVOR wir den Storage-Provider bemuehen.
    const lookupName = extractLookupNameFromFileId(fileId)
    if (lookupName && looksLikeImage(lookupName)) {
      const fragment = await findBinaryFragmentInLibraryByLookupName(libraryId, lookupName)
      if (fragment?.url) {
        if (process.env.MEDIA_TAB_RESOLUTION_TRACE === '1') {
          FileLogger.info('storage/streaming-url/trace', '302 (Mongo-Hit): Bild via binaryFragments aufgeloest', {
            libraryId,
            lookupName,
            url: fragment.url,
          })
        }
        return NextResponse.redirect(fragment.url, 302)
      }
    }

    // ─── Strategie pruefen: ist Filesystem-Fallback ueberhaupt erlaubt? ────────
    const library = await LibraryService.getInstance().getLibraryById(libraryId)
    const azureConfigured = resolveAzureStorageConfig(library?.config) !== null
    const strategy = getMediaStorageStrategy(library, azureConfigured)

    if (lookupName && looksLikeImage(lookupName) && !strategy.allowFilesystemFallbackOnRead) {
      FileLogger.warn('storage/streaming-url', 'Bild nicht in Mongo gefunden und Filesystem-Fallback deaktiviert', {
        libraryId,
        lookupName,
        mode: strategy.mode,
      })
      return NextResponse.json(
        {
          error: 'Bild nicht gefunden',
          detail: `Strategie ${strategy.mode}: kein Mongo-Fragment fuer "${lookupName}" und Filesystem-Fallback ist deaktiviert.`,
        },
        { status: 404 }
      )
    }

    // ─── Fallback: Storage-Provider (Legacy-Pfad) ───────────────────────────────
    // Provider aufloesen und Streaming-URL ermitteln.
    const provider = await getServerProvider(userEmail, libraryId)
    const streamingUrl = await provider.getStreamingUrl(fileId)

    // Relative URLs (z.B. Nextcloud-Proxy: /api/storage/nextcloud?...) muessen
    // zu absoluten URLs aufgeloest werden, da NextResponse.redirect() das erfordert.
    // Origin aus X-Forwarded-* waehlen, damit der Client nicht auf internes localhost zeigt.
    const redirectOrigin = getRequestPublicOrigin(request)
    const absoluteUrl = streamingUrl.startsWith('/')
      ? new URL(streamingUrl, redirectOrigin).toString()
      : streamingUrl

    if (process.env.MEDIA_TAB_RESOLUTION_TRACE === '1') {
      FileLogger.info('storage/streaming-url/trace', '302 (Provider-Fallback): Binaerdaten via Storage-Backend', {
        libraryId,
        fileId,
        providerName: provider.name,
        providerRelativeStreamingPath: streamingUrl,
        redirectOriginUsed: redirectOrigin,
        locationHeader: absoluteUrl,
      })
    }

    return NextResponse.redirect(absoluteUrl, 302)
  } catch (error) {
    console.error('[streaming-url] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * Extrahiert aus der base64-kodierten fileId, wie sie der MarkdownPreview baut, das
 * letzte Pfad-Segment (z.B. "img-0.jpeg"). Wenn die Dekodierung fehlschlaegt oder
 * das Ergebnis kein Pfad ist, wird die fileId selbst als Fallback genutzt.
 */
function extractLookupNameFromFileId(fileId: string): string | null {
  try {
    // base64 -> string
    const decoded = Buffer.from(fileId, 'base64').toString('utf-8')
    // Heuristik: ist das Ergebnis ein lesbarer Pfad? (mind. ein Slash oder eine Endung)
    if (decoded && (decoded.includes('/') || /\.[a-z0-9]{2,5}$/i.test(decoded))) {
      const norm = decoded.replace(/\\/g, '/')
      const slash = norm.lastIndexOf('/')
      return slash >= 0 ? norm.slice(slash + 1) : norm
    }
  } catch {
    // Fallthrough auf den Roh-Wert
  }
  // Fallback: fileId direkt als Lookup-Name probieren (z.B. "img-0.jpeg")
  return fileId
}

function looksLikeImage(name: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(name)
}
