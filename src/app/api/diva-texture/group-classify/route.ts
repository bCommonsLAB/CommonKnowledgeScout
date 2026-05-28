/**
 * @fileoverview API-Route: Stoffgruppen-Propagation (Stufe 4).
 *
 * @description
 * POST /api/diva-texture/group-classify
 * Body: { libraryId, groupName, templateName?, targetLanguage?, dryRun? }
 *
 * Propagiert die VORHANDENE Pass-1-Klassifikation eines Repraesentativen auf
 * alle nicht gelockten / nicht verworfenen Mitglieder einer Stoffgruppe.
 *
 * Vereinfachung (User-Entscheid 2026-05-28): die Galerie macht KEINEN
 * LLM-Call. Jeder LLM-Aufruf laeuft ueber `/api/external/jobs/*` aus dem
 * Archiv (Lea-Regel #10). Diese Route patcht ausschliesslich die Pass-1-
 * Klassen-Felder ins Mitglieder-Frontmatter (Shadow-Twin-Artefakt) und
 * aktualisiert das docMetaJson im vector-repo. Wenn die material_class
 * eines Mitglieds sich aendert, wird zusaetzlich `needs_visual_refresh=true`
 * gesetzt, damit Stufe 5 (Korrektur-Lauf) darauf reagieren kann.
 *
 * Clerk-Auth + Library-Access-Check (LibraryService).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getVectorCollectionName } from '@/lib/repositories/vector-repo'
import { runGroupClassification } from '@/lib/diva-texture/group-classify-runner'
import { FileLogger } from '@/lib/debug/logger'

interface GroupClassifyBody {
  libraryId?: string
  groupName?: string
  /** Template-Name (z.B. "Diva-Texture-Analysis"); Default kommt aus dem Mitglied selbst. */
  templateName?: string
  /** Zielsprache der Artefakte (Default "de"). */
  targetLanguage?: string
  /** Dry-Run liefert die Vorschau ohne sie auf die Mitglieder anzuwenden. */
  dryRun?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const body = (await request.json()) as GroupClassifyBody
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId.trim() : ''
    const groupName = typeof body.groupName === 'string' ? body.groupName.trim() : ''
    if (!libraryId) return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    if (!groupName) return NextResponse.json({ error: 'groupName ist erforderlich' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden oder kein Zugriff' }, { status: 404 })
    }
    const libraryKey = getVectorCollectionName(library)

    const targetLanguage =
      typeof body.targetLanguage === 'string' && body.targetLanguage.trim().length > 0
        ? body.targetLanguage.trim()
        : 'de'
    const templateName =
      typeof body.templateName === 'string' && body.templateName.trim().length > 0
        ? body.templateName.trim()
        : 'Diva-Texture-Analysis'

    const result = await runGroupClassification({
      library,
      libraryKey,
      libraryId,
      userEmail,
      groupName,
      targetLanguage,
      templateName,
      dryRun: body.dryRun === true,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler'
    FileLogger.error('diva-texture/group-classify', 'POST fehlgeschlagen', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
