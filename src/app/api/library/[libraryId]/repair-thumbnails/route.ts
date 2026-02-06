/**
 * @fileoverview API-Route für Thumbnail- und Variant-Reparatur
 * 
 * @description
 * GET: Statistik über fehlende Thumbnails/Variants abrufen
 *      - ?type=thumbnails (default): Thumbnail-Statistik
 *      - ?type=variants: Variant-Feld-Statistik
 * POST: Reparatur starten (mit SSE für Fortschritts-Updates)
 *      - ?type=thumbnails (default): Thumbnail-Reparatur
 *      - ?type=variants: Variant-Feld-Reparatur
 * 
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { 
  countMissingThumbnails, 
  repairThumbnailsForLibrary,
  regenerateAllThumbnails,
  countMissingVariants,
  repairBinaryFragmentVariants,
} from '@/lib/image/thumbnail-repair-service'
import { FileLogger } from '@/lib/debug/logger'

interface RouteParams {
  params: Promise<{ libraryId: string }>
}

/**
 * GET: Statistik über fehlende Thumbnails oder Variants
 * 
 * Query-Parameter:
 * - type=thumbnails (default): Thumbnail-Statistik
 * - type=variants: Variant-Feld-Statistik
 * 
 * @returns JSON mit Statistik-Daten
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const { libraryId } = await params
    if (!libraryId) {
      return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })
    }
    
    const repairType = request.nextUrl.searchParams.get('type') || 'thumbnails'
    
    if (repairType === 'variants') {
      // Variant-Statistik
      const stats = await countMissingVariants(libraryId)
      return NextResponse.json({
        ok: true,
        type: 'variants',
        ...stats,
      })
    }
    
    // Default: Thumbnail-Statistik
    const stats = await countMissingThumbnails(libraryId)
    
    return NextResponse.json({
      ok: true,
      type: 'thumbnails',
      ...stats,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    FileLogger.error('repair-thumbnails', 'Fehler beim Abrufen der Statistik', { error: errorMessage })
    
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Statistik', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST: Thumbnail- oder Variant-Reparatur starten
 * 
 * Query-Parameter:
 * - type=thumbnails (default): Thumbnail-Reparatur mit SSE
 * - type=variants: Variant-Feld-Reparatur (synchron, schnell)
 * - regenerate=true: Alle Thumbnails neu berechnen (nicht nur fehlende)
 * 
 * @returns SSE-Stream (thumbnails/regenerate) oder JSON-Response (variants)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const { libraryId } = await params
    if (!libraryId) {
      return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })
    }
    
    const repairType = request.nextUrl.searchParams.get('type') || 'thumbnails'
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true'
    const userEmail = user?.primaryEmailAddress?.emailAddress || userId
    
    // Variant-Reparatur: Synchron, kein SSE nötig (schnelle Bulk-Operation)
    if (repairType === 'variants') {
      FileLogger.info('repair-variants', 'Starte Variant-Reparatur via API', {
        libraryId,
        user: userEmail,
      })
      
      const result = await repairBinaryFragmentVariants(libraryId)
      
      return NextResponse.json({
        ok: true,
        type: 'variants',
        ...result,
      })
    }
    
    // Default: Thumbnail-Reparatur oder Regenerierung mit SSE
    const operationType = regenerate ? 'regenerate' : 'repair'
    FileLogger.info('repair-thumbnails', `Starte Thumbnail-${operationType} via API`, {
      libraryId,
      user: userEmail,
      regenerate,
    })
    
    // SSE-Stream erstellen
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Sende initiale Nachricht
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', libraryId, regenerate })}\n\n`))
          
          // Führe Reparatur oder Regenerierung durch und sende Fortschritts-Updates
          // Bei regenerate=true werden ALLE Thumbnails neu berechnet
          const generator = regenerate 
            ? regenerateAllThumbnails(libraryId) 
            : repairThumbnailsForLibrary(libraryId)
          
          for await (const progress of generator) {
            const event = {
              type: 'progress',
              ...progress,
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            
            // Bei completion auch end-Event senden
            if (progress.status === 'completed') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', success: true })}\n\n`))
            }
          }
          
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          FileLogger.error('repair-thumbnails', 'Fehler während Reparatur', {
            libraryId,
            error: errorMessage,
          })
          
          // Sende Fehler-Event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
          })}\n\n`))
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', success: false })}\n\n`))
          controller.close()
        }
      },
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    FileLogger.error('repair-thumbnails', 'Fehler beim Starten der Reparatur', { error: errorMessage })
    
    return NextResponse.json(
      { error: 'Fehler beim Starten der Reparatur', details: errorMessage },
      { status: 500 }
    )
  }
}
