/**
 * @fileoverview API Route: Artefakte einer bestimmten Sprache loeschen
 *
 * POST /api/library/[libraryId]/shadow-twins/delete-by-language
 * Body: { targetLanguage: "en", dryRun: boolean }
 *
 * Loescht alle Artefakte (Transcripts + Transformations) einer Sprache
 * aus MongoDB und optional aus dem Storage.
 * Mit dryRun=true wird nur analysiert, was geloescht wuerde.
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { deleteArtifactsByLanguage } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { FileLogger } from '@/lib/debug/logger'
import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ libraryId: string }>
}

/**
 * Loescht eine einzelne Artefakt-Datei im Storage (best-effort).
 */
async function deleteFromStorage(args: {
  provider: Awaited<ReturnType<typeof getServerProvider>>
  parentId: string
  sourceName: string
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
}): Promise<boolean> {
  try {
    const folder = await findShadowTwinFolder(args.parentId, args.sourceName, args.provider)
    if (!folder) return false

    const fileName = buildArtifactName(
      { sourceId: '', kind: args.kind, targetLanguage: args.targetLanguage, templateName: args.templateName },
      args.sourceName
    )

    const items = await args.provider.listItemsById(folder.id)
    const file = items.find((i) => i.type === 'file' && i.metadata.name === fileName)
    if (!file) return false

    await args.provider.deleteItem(file.id)
    return true
  } catch {
    return false
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { libraryId } = await context.params
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    }

    const body = await request.json() as { targetLanguage?: string; dryRun?: boolean }
    const targetLanguage = body.targetLanguage?.trim().toLowerCase()
    const dryRun = body.dryRun !== false

    if (!targetLanguage || targetLanguage.length < 2 || targetLanguage.length > 5) {
      return NextResponse.json({ error: 'targetLanguage ist erforderlich (2-5 Zeichen)' }, { status: 400 })
    }

    // 1. MongoDB: Artefakte finden/loeschen
    const result = await deleteArtifactsByLanguage({ libraryId, targetLanguage, dryRun })

    // 2. Storage: Dateien loeschen (nur wenn kein Dry-Run)
    let storageDeleted = 0
    if (!dryRun && result.affectedFiles.length > 0) {
      try {
        const provider = await getServerProvider(userEmail, libraryId)

        // Lade parentIds aus MongoDB (getShadowTwinsBySourceIds)
        const { getShadowTwinsBySourceIds } = await import('@/lib/repositories/shadow-twin-repo')
        const sourceIds = result.affectedFiles.map((f) => f.sourceId)
        const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

        for (const file of result.affectedFiles) {
          const doc = docs.get(file.sourceId)
          if (!doc?.parentId) continue

          for (const artifact of file.artifacts) {
            const deleted = await deleteFromStorage({
              provider,
              parentId: doc.parentId,
              sourceName: file.sourceName,
              kind: artifact.kind,
              targetLanguage,
              templateName: artifact.templateName,
            })
            if (deleted) storageDeleted++
          }
        }
      } catch (error) {
        FileLogger.warn('delete-by-language', 'Storage-Loeschung teilweise fehlgeschlagen', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      dryRun,
      targetLanguage,
      totalArtifacts: result.totalArtifacts,
      totalFiles: result.affectedFiles.length,
      storageDeleted: dryRun ? null : storageDeleted,
      affectedFiles: result.affectedFiles.map((f) => ({
        sourceName: f.sourceName,
        artifacts: f.artifacts.map((a) => ({
          kind: a.kind,
          templateName: a.templateName || null,
        })),
      })),
    })
  } catch (error) {
    console.error('Fehler beim Loeschen nach Sprache:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
