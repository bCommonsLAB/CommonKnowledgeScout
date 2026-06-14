/**
 * @fileoverview API-Route fuer die Library-Verifikation (Welle A1)
 *
 * GET:  liefert den aktuellen Verifikations-Status (aus dem juengsten Lauf;
 *       kein Lauf ⇒ `unchecked`). Schlanke Lese-Operation fuer das Status-Abzeichen.
 * POST: startet einen Pruef- bzw. Reparatur-Lauf und streamt den Fortschritt per
 *       SSE (Vorbild: repair-thumbnails). `?mode=repair` repariert auto-fixbare
 *       Faelle, sonst nur pruefen.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { LibraryService } from '@/lib/services/library-service'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { createMongoDocumentSource } from '@/lib/library-verification/document-source'
import { runLibraryVerification } from '@/lib/library-verification/verify-engine'
import {
  saveLibraryVerificationRun,
  getLatestLibraryVerificationRun,
} from '@/lib/repositories/library-verification-repo'
import { LIBRARY_VERIFICATION_STATUS } from '@/lib/library-verification/types'
import type { VerificationMode } from '@/lib/library-verification/types'
import { FileLogger } from '@/lib/debug/logger'

interface RouteParams {
  params: Promise<{ libraryId: string }>
}

/** GET: aktuellen Status + Kennzahlen des juengsten Laufs liefern. */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const { libraryId } = await params
    if (!libraryId) return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })

    const userEmail = user?.primaryEmailAddress?.emailAddress || userId
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const latest = await getLatestLibraryVerificationRun(libraryId)
    if (!latest) {
      return NextResponse.json({
        ok: true,
        libraryId,
        status: LIBRARY_VERIFICATION_STATUS.unchecked,
        lastRun: null,
      })
    }

    return NextResponse.json({
      ok: true,
      libraryId,
      status: latest.status,
      summary: latest.summary,
      lastRun: {
        runId: latest.runId,
        mode: latest.mode,
        status: latest.status,
        createdAt: latest.createdAt,
        triggeredBy: latest.triggeredBy,
      },
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    FileLogger.error('library-verify', 'GET-Status fehlgeschlagen', { error: details })
    return NextResponse.json({ error: 'Status-Abruf fehlgeschlagen', details }, { status: 500 })
  }
}

/** POST: Pruef-/Reparatur-Lauf starten und Fortschritt per SSE streamen. */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const { libraryId } = await params
    if (!libraryId) return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })

    // Modus explizit validieren (no-silent-fallbacks): nur 'check' | 'repair'.
    const modeParam = request.nextUrl.searchParams.get('mode')
    if (modeParam !== null && modeParam !== 'check' && modeParam !== 'repair') {
      return NextResponse.json({ error: `Ungueltiger mode: „${modeParam}"` }, { status: 400 })
    }
    const mode: VerificationMode = modeParam === 'repair' ? 'repair' : 'check'

    const userEmail = user?.primaryEmailAddress?.emailAddress || userId
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const facetDefs = parseFacetDefs(library)
    const libraryDetailViewType = library.config?.chat?.gallery?.detailViewType

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const startedAt = Date.now()
        try {
          // Quelle erst hier erzeugen, damit Config-Fehler als SSE-Fehler ankommen.
          const source = createMongoDocumentSource(library)
          const gen = runLibraryVerification({
            libraryId,
            mode,
            libraryDetailViewType,
            facetDefs,
            source,
          })

          let next = await gen.next()
          while (!next.done) {
            const event = { type: 'progress', ...next.value }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            next = await gen.next()
          }
          const report = next.value

          await saveLibraryVerificationRun({
            runId: randomUUID(),
            libraryId,
            createdAt: new Date(),
            triggeredBy: userEmail,
            mode,
            status: report.status,
            summary: report.summary,
            documents: report.documents,
            durationMs: Date.now() - startedAt,
          })

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'end',
                success: true,
                status: report.status,
                summary: report.summary,
              })}\n\n`
            )
          )
          controller.close()
        } catch (error) {
          const details = error instanceof Error ? error.message : String(error)
          FileLogger.error('library-verify', 'Lauf fehlgeschlagen', { libraryId, error: details })
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: details })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', success: false })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    FileLogger.error('library-verify', 'Start fehlgeschlagen', { error: details })
    return NextResponse.json({ error: 'Start fehlgeschlagen', details }, { status: 500 })
  }
}
