import { NextRequest, NextResponse } from 'next/server'
import { explorerGate } from '@ks/module-explorer'

// Kompatibilitäts-Endpoint: leitet auf ingestion-status um
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  // Site-Gate (Modul-Landkarte §3): Ist `explorer` fuer diese Site
  // nicht aktiv, antwortet die Route mit 404.
  const gated = explorerGate(request)
  if (gated) return gated

  try {
    const { libraryId } = await params
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    const target = new URL(`/api/chat/${encodeURIComponent(libraryId)}/ingestion-status${qs ? `?${qs}` : ''}`, url.origin)
    const res = await fetch(target.toString(), {
      // Auth/Cookies durchreichen
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({ error: 'upstream parse error' }))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


