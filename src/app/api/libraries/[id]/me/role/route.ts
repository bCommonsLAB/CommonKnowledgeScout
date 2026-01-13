import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { getPreferredUserEmail } from '@/lib/auth/user-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/libraries/[id]/me/role
 *
 * Returns whether the current signed-in user is owner or moderator of the library.
 * This is used for privileged UI elements (e.g. QR code / finalize buttons).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: libraryId } = await params

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const user = await currentUser()
  const userEmail = getPreferredUserEmail(user)
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

  const isOwnerOrModerator = await isModeratorOrOwner(libraryId, userEmail)
  
  // Debug-Logging für Rollen-Check (nur in Development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[API] /me/role:', { libraryId, userEmail, isOwnerOrModerator })
  }
  
  return NextResponse.json({ isOwnerOrModerator }, { status: 200 })
}

