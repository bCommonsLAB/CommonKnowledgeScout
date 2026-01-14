import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { deleteVectorsByFileId, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nonEmptyString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

interface PublishFinalRequest {
  finalFileId: string
}

/**
 * POST /api/library/[libraryId]/events/publish-final
 *
 * Implements the "index swap":
 * - ingest final markdown (same slug)
 * - delete original vectors by originalFileId (without deleting storage files)
 *
 * Safety:
 * - If ingestion fails, we do NOT delete the original index.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const json = (await req.json().catch(() => ({}))) as Partial<PublishFinalRequest>
    const finalFileId = nonEmptyString(json.finalFileId)
    if (!finalFileId) return NextResponse.json({ error: 'finalFileId ist erforderlich' }, { status: 400 })

    const provider = await getServerProvider(userEmail, libraryId)
    const finalItem = await provider.getItemById(finalFileId)
    if (!finalItem || finalItem.type !== 'file') {
      return NextResponse.json({ error: 'Final-Datei nicht gefunden' }, { status: 404 })
    }

    const { blob } = await provider.getBinary(finalFileId)
    const markdown = await blob.text()
    const { meta } = parseFrontmatter(markdown)

    const originalFileId = nonEmptyString(meta.originalFileId)
    if (!originalFileId) {
      return NextResponse.json({ error: 'Final-Frontmatter muss originalFileId enthalten' }, { status: 400 })
    }

    // 1) Ingest final (no delete yet)
    const ingestRes = await IngestionService.upsertMarkdown(
      userEmail,
      libraryId,
      finalFileId,
      finalItem.metadata?.name || 'event-final.md',
      markdown,
      undefined, // docMeta override
      undefined, // jobId
      provider // provider for image upload / url rewriting
    )

    // 2) Delete original from index (vectors only)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    await deleteVectorsByFileId(libraryKey, originalFileId)

    return NextResponse.json(
      {
        status: 'ok',
        ingested: {
          fileId: finalFileId,
          chunksUpserted: ingestRes.chunksUpserted,
        },
        deletedOriginal: {
          fileId: originalFileId,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

