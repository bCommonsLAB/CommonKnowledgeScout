/**
 * @fileoverview Streaming-URL API Route - Provider-agnostische Binary-URL
 *
 * @description
 * Redirect-Route, die für beliebige Storage-Backends (Local, OneDrive, ...)
 * eine Binary-Streaming-URL auflöst. Caller brauchen nur libraryId + fileId;
 * die Route ermittelt über getServerProvider den richtigen Provider und leitet
 * per 302 auf dessen getStreamingUrl() weiter.
 *
 * @module storage
 *
 * @exports
 * - GET: Redirect auf die aufgelöste Streaming-URL
 *
 * @usedIn
 * - UI-Komponenten (markdown-preview, markdown-metadata, event-slides)
 *   als provider-agnostische Binary-URL für <img>, <audio>, etc.
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/storage/server-provider: getServerProvider
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getRequestPublicOrigin } from '@/lib/http/request-public-origin'
import { getServerProvider } from '@/lib/storage/server-provider'
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

    // Provider auflösen und Streaming-URL ermitteln
    const provider = await getServerProvider(userEmail, libraryId)
    const streamingUrl = await provider.getStreamingUrl(fileId)

    // Relative URLs (z.B. Nextcloud-Proxy: /api/storage/nextcloud?...) muessen
    // zu absoluten URLs aufgeloest werden, da NextResponse.redirect() das erfordert.
    // Origin aus X-Forwarded-* wählen, damit der Client nicht auf internes localhost zeigt.
    const redirectOrigin = getRequestPublicOrigin(request)
    const absoluteUrl = streamingUrl.startsWith('/')
      ? new URL(streamingUrl, redirectOrigin).toString()
      : streamingUrl

    if (process.env.MEDIA_TAB_RESOLUTION_TRACE === '1') {
      FileLogger.info('storage/streaming-url/trace', '302: Binärdaten — physische Quelle = Storage-Backend hinter Proxy', {
        libraryId,
        fileId,
        providerName: provider.name,
        providerRelativeStreamingPath: streamingUrl,
        redirectOriginUsed: redirectOrigin,
        locationHeader: absoluteUrl,
        browserFlow:
          '<img src=/api/storage/streaming-url…> → dieser Handler → 302 → Binary-Route → WebDAV/Graph/lokal',
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
