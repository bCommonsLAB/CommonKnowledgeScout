import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { buildNeighborsPayload, MAX_SCOPE } from '@/lib/graph/doc-neighbors-service'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import type { Library } from '@/types/library'

/**
 * GET/POST /api/chat/[libraryId]/doc-neighbors — Quelle C des Graph-Modus
 * ("semantische Nachbarn", Zielbild §5.3).
 *
 * Baut die Ähnlichkeits-Kanten zwischen den ÜBERGEBENEN, bereits gefilterten
 * Dokumenten (`fileIds`). Berechnung: `lib/graph/doc-neighbors-service.ts`
 * (Seeds-Cap, Zeitlimit pro Vector-Suche, Fehlertoleranz pro Seed).
 *
 * fileIds-Übergabe: GET nimmt sie als Query-Parameter (kleine Mengen), POST im
 * JSON-Body (`{ fileIds, topK, neighborScope? }`). Bei großen Bibliotheken
 * (Hunderte Knoten) überschreitet die GET-URL die Header-Grenze des Servers
 * (HTTP 431) — daher nutzt der Graph-Client POST.
 *
 * Chunking großer Bibliotheken: der Client schickt die Seeds in Portionen
 * (MAX_NODES pro Request) und übergibt in `neighborScope` den KOMPLETTEN
 * sichtbaren Bestand, damit Kanten auch zwischen den Chunks entstehen.
 */

/** Auth + Library-Kontext (öffentliche Libraries dürfen anonym lesen). */
async function resolveContext(
  libraryId: string,
): Promise<{ ok: true; library: Library } | { ok: false; res: NextResponse }> {
  let userId: string | null = null
  let userEmail = ''
  try {
    const authResult = await auth()
    userId = authResult.userId || null
    if (userId) {
      const user = await currentUser()
      userEmail = getPreferredUserEmail(user)
    }
  } catch (authError) {
    const isRateLimit = authError && typeof authError === 'object' && 'status' in authError && authError.status === 429
    if (isRateLimit) {
      console.warn('[API] Clerk Rate Limit bei doc-neighbors, versuche ohne Auth fortzufahren')
    } else {
      throw authError
    }
  }

  const ctx = await loadLibraryChatContext(userEmail, libraryId)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
    return { ok: false, res: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  }
  return { ok: true, library: ctx.library }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const resolved = await resolveContext(libraryId)
    if (!resolved.ok) return resolved.res

    const url = new URL(req.url)
    const fileIds = (url.searchParams.get('fileIds') || '').split(',')
    const cleaned = fileIds.map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) return NextResponse.json({ error: 'Parameter fileIds fehlt' }, { status: 400 })
    const topK = parseInt(url.searchParams.get('topK') || '', 10)

    const payload = await buildNeighborsPayload(resolved.library, cleaned, topK)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const resolved = await resolveContext(libraryId)
    if (!resolved.ok) return resolved.res

    const body = (await req.json().catch(() => ({}))) as {
      fileIds?: unknown
      topK?: unknown
      neighborScope?: unknown
    }
    const rawIds = Array.isArray(body.fileIds) ? body.fileIds : []
    const cleaned = rawIds.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) return NextResponse.json({ error: 'fileIds fehlt (Array im Body)' }, { status: 400 })
    const topK = typeof body.topK === 'number' ? body.topK : NaN

    // Optionaler Nachbar-Scope (Chunking): explizit validieren, hartes Cap.
    let neighborScope: string[] | undefined
    if (body.neighborScope !== undefined) {
      if (!Array.isArray(body.neighborScope)) {
        return NextResponse.json({ error: 'neighborScope muss ein String-Array sein' }, { status: 400 })
      }
      neighborScope = body.neighborScope
        .filter((v): v is string => typeof v === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
      if (neighborScope.length > MAX_SCOPE) {
        return NextResponse.json({ error: `Maximal ${MAX_SCOPE} fileIds in neighborScope` }, { status: 400 })
      }
    }

    const payload = await buildNeighborsPayload(resolved.library, cleaned, topK, neighborScope)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
