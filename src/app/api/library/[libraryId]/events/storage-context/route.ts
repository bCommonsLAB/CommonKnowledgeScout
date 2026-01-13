import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getPreferredUserEmail } from '@/lib/auth/user-email'

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

/**
 * GET /api/library/[libraryId]/events/storage-context?eventFileId=...
 *
 * Returns storage folder ids for an event:
 * - eventFolderId (parent folder of the event markdown file)
 * - testimonialsFolderId (ensured)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = getPreferredUserEmail(user)
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const url = new URL(req.url)
    const eventFileId = nonEmptyString(url.searchParams.get('eventFileId'))
    if (!eventFileId) return NextResponse.json({ error: 'eventFileId ist erforderlich' }, { status: 400 })

    const provider = await getServerProvider(userEmail, libraryId)
    const eventItem = await provider.getItemById(eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      return NextResponse.json({ error: 'Event-Datei nicht gefunden' }, { status: 404 })
    }

    const eventFolderId = eventItem.parentId || 'root'
    const testimonialsFolderId = await ensureChildFolderId({ provider, parentId: eventFolderId, folderName: 'testimonials' })

    return NextResponse.json({ eventFolderId, testimonialsFolderId }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

