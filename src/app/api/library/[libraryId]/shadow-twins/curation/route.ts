/**
 * @fileoverview API-Route: Kurations-Patch an einem Twin-Artefakt (Contract §4).
 *
 * @description
 * POST /api/library/[libraryId]/shadow-twins/curation
 * Body: `{ sourceId, artifact: { kind, targetLanguage, templateName? },
 *          set?: { twin_status }, verify?: boolean,
 *          markiere?: { notiz: string } }`
 * → `{ artifact, curation, mirror }`
 *
 * DIE Schreiboperation der Kuration (Agentensicht F4 ruft NUR diese Route):
 * - Feld-Patch statt Neuschreiben — unbekannte Frontmatter-Felder und der
 *   Body bleiben erhalten (§4.2).
 * - Verify stempelt der SERVER: `verified_by: human:<user>` + `verified_at`;
 *   Selbst-Verifikation wird verweigert (409, §3.2).
 * - Markieren (ADR 0006) stempelt der SERVER ebenso: `twin_status: flagged` +
 *   `flagged_by`/`flagged_at`; die Notiz ist Pflicht (400 ohne sie). Ein
 *   spaeteres Verifizieren loest die Markierung wieder auf.
 * - Spiegel-Drift-Guard: weicht der Filesystem-Spiegel von MongoDB ab,
 *   antwortet die Route 409 `mirror_drift` („erst importieren") und
 *   ueberschreibt NICHTS (§4.3).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import {
  CurationArtifactNotFoundError,
  CurationValidationError,
  MirrorDriftError,
  SelfVerificationError,
  parseCurationArtifactRef,
} from '@/lib/shadow-twin/curation-plan'
import { applyCurationPatch } from '@/lib/shadow-twin/curation-patch'

interface CurationBody {
  sourceId?: unknown
  artifact?: unknown
  set?: unknown
  verify?: unknown
  markiere?: unknown
}

/** `markiere` aus dem Body — Form hier, Inhalt in `buildCurationPatches`. */
function parseMarkiere(value: unknown): { notiz: string } | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new CurationValidationError('markiere muss ein Objekt { notiz } sein')
  }
  const notiz = (value as { notiz?: unknown }).notiz
  if (typeof notiz !== 'string') {
    throw new CurationValidationError('markiere.notiz muss ein String sein')
  }
  return { notiz }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    if (!libraryId) return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })

    let body: CurationBody
    try {
      body = (await request.json()) as CurationBody
    } catch {
      return NextResponse.json({ error: 'Ungueltiger JSON-Body' }, { status: 400 })
    }

    const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : ''
    if (sourceId === '') return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    if (body.set !== undefined && (body.set === null || typeof body.set !== 'object' || Array.isArray(body.set))) {
      return NextResponse.json({ error: 'set muss ein Objekt sein' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const result = await applyCurationPatch({
      library,
      userEmail,
      sourceId,
      artifact: parseCurationArtifactRef(body.artifact),
      set: body.set as Record<string, unknown> | undefined,
      verify: body.verify === true,
      markiere: parseMarkiere(body.markiere),
    })

    return NextResponse.json(result)
  } catch (error) {
    // Typisierte Contract-Fehler → sprechende Status-Codes; Rest ist 500.
    if (error instanceof CurationValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof CurationArtifactNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
    }
    if (error instanceof MirrorDriftError || error instanceof SelfVerificationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    FileLogger.error('shadow-twin-curation', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
