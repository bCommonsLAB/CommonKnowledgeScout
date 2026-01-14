import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { toEventRunId } from '@/lib/events/event-run-id'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nonEmptyString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

async function ensureChildFolderId(args: {
  provider: Awaited<ReturnType<typeof getServerProvider>>
  parentId: string
  folderName: string
}): Promise<string> {
  const items = await args.provider.listItemsById(args.parentId)
  const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === args.folderName)
  if (existing?.id) return existing.id
  const created = await args.provider.createFolder(args.parentId, args.folderName)
  return created.id
}


interface FinalizeRequest {
  eventFileId: string
}

/**
 * POST /api/library/[libraryId]/events/finalize
 *
 * Creates a versioned final draft run (filesystem-only; no ingestion).
 * The final markdown keeps the event slug (for later publish-swap) and references the original via originalFileId.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const json = (await req.json().catch(() => ({}))) as Partial<FinalizeRequest>
    const eventFileId = nonEmptyString(json.eventFileId)
    if (!eventFileId) return NextResponse.json({ error: 'eventFileId ist erforderlich' }, { status: 400 })

    const provider = await getServerProvider(userEmail, libraryId)
    const eventItem = await provider.getItemById(eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      return NextResponse.json({ error: 'Event-Datei nicht gefunden' }, { status: 404 })
    }
    const eventFolderId = eventItem.parentId || 'root'

    // Load original event markdown
    const { blob } = await provider.getBinary(eventFileId)
    const eventMarkdown = await blob.text()
    const parsed = parseFrontmatter(eventMarkdown)
    const originalMeta = parsed.meta || {}
    const originalBody = parsed.body || ''

    const slug =
      (typeof originalMeta.slug === 'string' && originalMeta.slug.trim())
        ? originalMeta.slug.trim()
        : (eventItem.metadata?.name || '').replace(/\.[^.]+$/, '')

    // Collect testimonials from filesystem (no ingestion)
    const testimonialsFolderId = await ensureChildFolderId({
      provider,
      parentId: eventFolderId,
      folderName: 'testimonials',
    })
    const testimonialFolders = (await provider.listItemsById(testimonialsFolderId)).filter((it) => it.type === 'folder')

    const testimonials = await Promise.all(
      testimonialFolders.map(async (folder) => {
        const testimonialId = folder.metadata?.name || folder.id
        const files = await provider.listItemsById(folder.id)
        const audio = files.find((f) => f.type === 'file' && /\.(mp3|m4a|wav|ogg|opus|flac|webm)$/.test(String(f.metadata?.name || '').toLowerCase()))
        const audioUrl = audio ? await provider.getStreamingUrl(audio.id).catch(() => null) : null
        const metaFile = files.find((f) => f.type === 'file' && String(f.metadata?.name || '').toLowerCase() === 'meta.json')
        const meta = await (async () => {
          if (!metaFile) return null
          try {
            const { blob } = await provider.getBinary(metaFile.id)
            return JSON.parse(await blob.text()) as unknown
          } catch {
            return null
          }
        })()
        return { testimonialId, audioUrl, meta }
      })
    )

    const now = new Date()
    const runId = toEventRunId(now)

    const finalsFolderId = await ensureChildFolderId({ provider, parentId: eventFolderId, folderName: 'finals' })
    const runFolderName = `run-${runId}`
    const runFolderId = await ensureChildFolderId({ provider, parentId: finalsFolderId, folderName: runFolderName })

    // Build final markdown (deterministic, minimal; can be upgraded to LLM later)
    const fm: Record<string, unknown> = {
      // Carry over selected fields (best effort)
      title: originalMeta.title ?? (eventItem.metadata?.name || slug),
      teaser: originalMeta.teaser ?? '',
      date: originalMeta.date ?? '',
      location: originalMeta.location ?? '',

      docType: 'event',
      detailViewType: 'session',
      slug,

      originalFileId: eventFileId,
      finalRunId: runId,
      eventStatus: 'finalDraft',

      generatedAt: now.toISOString(),
      testimonialCount: testimonials.length,
    }

    const frontmatter = Object.entries(fm)
      .map(([k, v]) => {
        if (v === null || v === undefined) return `${k}: ""`
        if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`
        if (typeof v === 'string' && v.includes('\n')) {
          return `${k}: |\n${v.split('\n').map((line) => `  ${line}`).join('\n')}`
        }
        return `${k}: ${v}`
      })
      .join('\n')

    const testimonialsMd =
      testimonials.length === 0
        ? '_Noch keine Testimonials gesammelt._'
        : testimonials
            .map((t) => {
              const name = (() => {
                const speaker = t.meta && typeof t.meta === 'object' && 'speakerName' in (t.meta as Record<string, unknown>)
                  ? (t.meta as Record<string, unknown>).speakerName
                  : null
                return typeof speaker === 'string' && speaker.trim() ? speaker.trim() : t.testimonialId
              })()
              const url = t.audioUrl ? t.audioUrl : null
              return url ? `- **${name}**: [Audio](${url})` : `- **${name}**: (kein Audio gefunden)`
            })
            .join('\n')

    const finalBody = `${originalBody.trim()}\n\n---\n\n## Testimonials\n\n${testimonialsMd}\n`
    const finalMarkdown = `---\n${frontmatter}\n---\n\n${finalBody}`.trimEnd() + '\n'

    const finalFile = new File([finalMarkdown], 'event-final.md', { type: 'text/markdown' })
    const uploaded = await provider.uploadFile(runFolderId, finalFile)

    return NextResponse.json(
      {
        status: 'ok',
        runId,
        finalFileId: uploaded.id,
        runFolderId,
      },
      { status: 200 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

