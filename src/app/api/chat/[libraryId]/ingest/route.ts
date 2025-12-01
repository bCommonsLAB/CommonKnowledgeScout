import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Steuerung per Query-Flag: ?mode=test | ?mode=reset
    const mode = new URL(request.url).searchParams.get('mode')
    if (mode === 'test') {
      const res = await IngestionService.runMinimalTest(userEmail, libraryId)
      return NextResponse.json({ status: 'upserted', ...res })
    }
    if (mode === 'reset') {
      const ctx = await loadLibraryChatContext(userEmail, libraryId)
      if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
      const libraryKey = getCollectionNameForLibrary(ctx.library)
      const col = await getCollectionOnly(libraryKey)
      // Alle Vektoren der Library löschen
      await col.deleteMany({ libraryId })
      return NextResponse.json({ status: 'cleared', collection: libraryKey })
    }

    const { jobId } = await IngestionService.enqueueLibraryIngestion(userEmail, libraryId)
    return NextResponse.json({ status: 'enqueued', jobId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


