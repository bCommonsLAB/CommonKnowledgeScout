/**
 * @fileoverview API-Route: Basecolor-Crop als Bild-Binary (Stufe 3 Update 2 — UI).
 *
 * @description
 * GET /api/diva-texture/basecolor-crop?libraryId=X&fileId=Y
 *
 * Liefert das exakte Bild, das der Pass-1-Lauf ans LLM senden wuerde —
 * berechnet ueber denselben `buildBasecolorCrop`-Helper wie die Pipeline.
 * Antwort: `image/jpeg` Binary mit Metadaten in Custom-Headern, damit
 * ein `<img>` direkt das Bild zeigen kann und die UI die Maesse fuer
 * die Caption parallel lesen kann (siehe `basecolor-info` fuer den
 * JSON-Pfad, wenn man nur die Plan-Metadaten braucht).
 *
 * Response-Header:
 *  - `X-Crop-Px`       z.B. "360x360"
 *  - `X-Crop-Cm`       z.B. "3.0x3.0"
 *  - `X-Dpi-Used`      z.B. "300"
 *  - `X-Dpi-Fallback`  "true" | "false"
 *  - `X-Full-Image`    "true" | "false" (Edge-Case #20)
 *
 * Reine Lese-Route, kein LLM. Clerk-Auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildBasecolorCrop } from '@/lib/diva-texture/basecolor-crop'
import { FileLogger } from '@/lib/debug/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const libraryId = searchParams.get('libraryId')
    const fileId = searchParams.get('fileId')
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!fileId) return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 })

    const provider = await getServerProvider(userEmail, libraryId)
    const item = await provider.getItemById(fileId)
    if (!item) return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

    const bin = await provider.getBinary(fileId)
    const buffer = Buffer.from(await bin.blob.arrayBuffer())
    const result = await buildBasecolorCrop(buffer)

    // Maesse als Custom-Header — werden via fetch() von der UI gelesen und
    // sind exposed via 'Access-Control-Expose-Headers' (gleiche Origin: ok).
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Cache-Control': 'private, max-age=300',
        'X-Crop-Px': result.cropPx,
        'X-Crop-Cm': result.cropCm,
        'X-Dpi-Used': String(result.dpiUsed),
        'X-Dpi-Fallback': String(result.dpiFallback),
        'X-Full-Image': String(result.fullImage),
        'Access-Control-Expose-Headers':
          'X-Crop-Px, X-Crop-Cm, X-Dpi-Used, X-Dpi-Fallback, X-Full-Image',
      },
    })
  } catch (error) {
    FileLogger.error('diva-texture/basecolor-crop', 'Fehler beim Erzeugen des Basecolor-Crops', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
