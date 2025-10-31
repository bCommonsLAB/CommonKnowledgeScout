import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const t0 = Date.now()
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    // Debug-Logging
    // eslint-disable-next-line no-console
    console.log('[chat/config] GET', { libraryId, hasUserId: !!userId, userEmail })

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.chat.public && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const response = {
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
        gallery: ctx.chat.gallery, // Gallery-Config inkl. detailViewType hinzufügen
        targetLanguage: ctx.chat.targetLanguage,
        character: ctx.chat.character,
        socialContext: ctx.chat.socialContext,
      },
      vectorIndex: ctx.vectorIndex,
    }
    // eslint-disable-next-line no-console
    console.log('[chat/config] OK', { ms: Date.now() - t0, facets: Array.isArray((ctx.chat as { gallery?: { facets?: unknown[] } } | undefined)?.gallery?.facets) ? (ctx.chat as { gallery?: { facets?: unknown[] } }).gallery!.facets!.length : 0 })
    return NextResponse.json(response)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chat/config] ERROR', err)
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


