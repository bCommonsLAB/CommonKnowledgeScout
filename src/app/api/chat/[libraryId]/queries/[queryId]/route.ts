import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getQueryLogById, deleteQueryLog } from '@/lib/db/queries-repo'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  try {
    const { libraryId, queryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const log = await getQueryLogById({ libraryId, queryId, userEmail })
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(log)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  try {
    const { queryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const deleted = await deleteQueryLog(queryId, userEmail)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}




