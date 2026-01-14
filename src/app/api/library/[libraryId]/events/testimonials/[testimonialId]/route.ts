import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveOwnerForTestimonials } from '@/lib/public/public-library-owner'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
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

async function readEventWriteKeyIfAny(args: {
  provider: Awaited<ReturnType<typeof getServerProvider>>
  eventFileId: string
}): Promise<string | null> {
  const { blob } = await args.provider.getBinary(args.eventFileId)
  const markdown = await blob.text()
  const { meta } = parseFrontmatter(markdown)
  const key = typeof meta.testimonialWriteKey === 'string' ? meta.testimonialWriteKey.trim() : ''
  return key || null
}

/**
 * DELETE /api/library/[libraryId]/events/testimonials/[testimonialId]?eventFileId=...&writeKey=...
 *
 * Security:
 * - erfordert Login (Clerk)
 * - erfordert Owner/Moderator in der Library (Mongo membership)
 * - wenn das Event einen `testimonialWriteKey` hat, muss er matchen (writeKey query param)
 *
 * Deletes the whole testimonial folder under:
 *   <eventFolder>/testimonials/<testimonialId>
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ libraryId: string; testimonialId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId, testimonialId } = await params
    const libraryIdTrimmed = nonEmptyString(libraryId)
    const testimonialIdTrimmed = nonEmptyString(testimonialId)
    if (!libraryIdTrimmed || !testimonialIdTrimmed) {
      return NextResponse.json({ error: 'libraryId und testimonialId sind erforderlich' }, { status: 400 })
    }

    const canDelete = await isModeratorOrOwner(libraryIdTrimmed, userEmail)
    if (!canDelete) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
    }

    const url = new URL(req.url)
    const eventFileId = nonEmptyString(url.searchParams.get('eventFileId'))
    const writeKey = nonEmptyString(url.searchParams.get('writeKey'))
    if (!eventFileId) {
      return NextResponse.json({ error: 'eventFileId ist erforderlich' }, { status: 400 })
    }

    // Für Storage-Operationen benötigen wir den Provider des Owners (nicht zwingend des Moderators).
    const { ownerEmail, isPublicLibrary } = await resolveOwnerForTestimonials({ libraryId: libraryIdTrimmed, writeKey })
    const provider = await getServerProvider(ownerEmail, libraryIdTrimmed)

    const eventItem = await provider.getItemById(eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      return NextResponse.json({ error: 'Event-Datei nicht gefunden' }, { status: 404 })
    }

    const requiredKey = await readEventWriteKeyIfAny({ provider, eventFileId })
    // Private Libraries: wenn das Event nicht freigegeben ist, darf auch nichts gelöscht werden.
    if (!isPublicLibrary && !requiredKey) {
      return NextResponse.json(
        { error: 'Event ist nicht für anonyme Testimonials freigegeben (testimonialWriteKey fehlt)' },
        { status: 403 }
      )
    }
    // Wenn ein Key existiert, muss er matchen (auch bei public libs).
    if (requiredKey && requiredKey !== writeKey) {
      return NextResponse.json({ error: 'Ungültiger writeKey' }, { status: 403 })
    }

    const eventFolderId = eventItem.parentId || 'root'
    const testimonialsFolderId = await ensureChildFolderId({ provider, parentId: eventFolderId, folderName: 'testimonials' })

    const children = await provider.listItemsById(testimonialsFolderId)
    const folder = children.find(
      (it) =>
        it.type === 'folder' &&
        (String(it.metadata?.name || '').trim() === testimonialIdTrimmed || it.id === testimonialIdTrimmed)
    )
    if (!folder) return NextResponse.json({ error: 'Testimonial nicht gefunden' }, { status: 404 })

    await provider.deleteItem(folder.id)

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

