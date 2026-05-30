/**
 * @fileoverview API-Route: Basecolor-Metadaten + Crop-Plan (Stufe 3 Update 2 — UI).
 *
 * @description
 * GET /api/diva-texture/basecolor-info?libraryId=X&fileId=Y
 *
 * Liefert die technischen Bild-Metadaten der Basecolor-Bitmap (Pixel-Masse,
 * DPI, Realgroesse in cm) UND den geplanten Crop, der vom Pass-1-Lauf
 * berechnet WUERDE (gleiche `planBasecolorCrop`-Funktion wie die LLM-
 * Pipeline). Antwort: JSON, kein Bild-Buffer — der Crop wird vom
 * separaten Endpoint `/api/diva-texture/basecolor-crop` ausgeliefert.
 *
 * Wozu: Der DIVA-Info-Tab zeigt die Originalmasse als kleine Overlay-
 * Caption auf dem Basecolor; das Modal mit dem tatsaechlichen Crop-Bild
 * zeigt zusaetzlich `cropPx`, `cropCm`, `dpiUsed`, `dpiFallback`.
 *
 * Reine Lese-Route, kein LLM, kein Schreibzugriff. Clerk-Auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { extractImageMetadata } from '@/lib/image/exif-metadata'
import { planBasecolorCrop, type BasecolorCropPlan } from '@/lib/diva-texture/basecolor-crop'
import type { ImageTechnicalMetadata } from '@/lib/image/exif-metadata'
import { FileLogger } from '@/lib/debug/logger'

export interface BasecolorInfoResponse {
  source: ImageTechnicalMetadata
  crop: BasecolorCropPlan
}

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
    const source = await extractImageMetadata(buffer)
    const crop = planBasecolorCrop(source)

    const body: BasecolorInfoResponse = { source, crop }
    return NextResponse.json(body)
  } catch (error) {
    FileLogger.error('diva-texture/basecolor-info', 'Fehler beim Lesen der Bild-Metadaten', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
