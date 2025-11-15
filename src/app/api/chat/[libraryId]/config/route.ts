import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getLocale } from '@/lib/i18n'

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
    
    // Lese Locale aus Accept-Language Header (für Client-Text-Generierung)
    const acceptLanguage = request.headers.get('accept-language') || undefined
    const cookieLocale = request.cookies.get('locale')?.value
    const locale = getLocale(undefined, cookieLocale, acceptLanguage)
    
    // Debug-Logging
    // eslint-disable-next-line no-console
    console.log('[chat/config] GET', { libraryId, hasUserId: !!userId, userEmail, locale })

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const response = {
      library: { id: ctx.library.id, label: ctx.library.label },
      config: {
        placeholder: ctx.chat.placeholder,
        maxChars: ctx.chat.maxChars,
        maxCharsWarningMessage: ctx.chat.maxCharsWarningMessage,
        footerText: ctx.chat.footerText,
        companyLink: ctx.chat.companyLink,
        gallery: ctx.chat.gallery, // Gallery-Config inkl. detailViewType hinzufügen
        targetLanguage: ctx.chat.targetLanguage,
        character: ctx.chat.character,
        accessPerspective: ctx.chat.accessPerspective,
        socialContext: ctx.chat.socialContext,
        genderInclusive: ctx.chat.genderInclusive,
        userPreferences: ctx.chat.userPreferences,
      },
      // Public-Publishing-Daten (inkl. Gallery- und Story-Texte, ohne API-Key)
      publicPublishing: ctx.library.config?.publicPublishing ? {
        slugName: ctx.library.config.publicPublishing.slugName,
        publicName: ctx.library.config.publicPublishing.publicName,
        description: ctx.library.config.publicPublishing.description,
        icon: ctx.library.config.publicPublishing.icon,
        isPublic: ctx.library.config.publicPublishing.isPublic,
        gallery: ctx.library.config.publicPublishing.gallery,
        story: ctx.library.config.publicPublishing.story,
        // API-Key nicht an Client senden
      } : undefined,
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


