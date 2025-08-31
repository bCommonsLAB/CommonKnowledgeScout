import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { IngestionService } from '@/lib/chat/ingestion-service'

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

    // Minimaler Soforttest (synchron): optional per Query-Flag ?mode=test
    const mode = new URL(request.url).searchParams.get('mode')
    if (mode === 'test') {
      const res = await IngestionService.runMinimalTest(userEmail, libraryId)
      return NextResponse.json({ status: 'upserted', ...res })
    }

    const { jobId } = await IngestionService.enqueueLibraryIngestion(userEmail, libraryId)
    return NextResponse.json({ status: 'enqueued', jobId })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


