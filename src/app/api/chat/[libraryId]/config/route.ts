import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.chat.public && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    return NextResponse.json({
      library: { id: ctx.library.id, label: ctx.library.label },
      config: {
        public: ctx.chat.public,
        titleAvatarSrc: ctx.chat.titleAvatarSrc,
        welcomeMessage: ctx.chat.welcomeMessage,
        errorMessage: ctx.chat.errorMessage,
        placeholder: ctx.chat.placeholder,
        maxChars: ctx.chat.maxChars,
        maxCharsWarningMessage: ctx.chat.maxCharsWarningMessage,
        footerText: ctx.chat.footerText,
        companyLink: ctx.chat.companyLink,
        features: ctx.chat.features,
      },
      vectorIndex: ctx.vectorIndex,
    })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


