/**
 * @fileoverview POST /api/library/[libraryId]/web-source — Webseite als Quelle erschliessen.
 *
 * @description
 * Derselbe Weg wie das Bruecken-Werkzeug `webseite_erschliessen`
 * (`src/lib/web-source/webseite-erschliessen.ts`): Artikelseite ohne Modell
 * lesen, Medium und Cover laden, Sammeldatei im Zielordner anlegen,
 * Transkription des Mediums starten. Fuer die Oberflaeche (Wizard-Quelle
 * „Webseite" im Standard-Wizard). Die Transformation ist ein eigener Schritt.
 *
 * Body: { url, folderId, dateiname, zielsprache?, medienHolen?, medienEinbetten?, sprecherErkennung?, kontext?, begriffe? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { readAudioContextOptions } from '@/lib/external-jobs/audio-context'
import { webseiteErschliessen } from '@/lib/web-source/webseite-erschliessen'
import { FileLogger } from '@/lib/debug/logger'

// Medien-Download (bis 500 MB) und Seitenabruf koennen dauern.
export const maxDuration = 600

interface WebSourceRequest {
  url?: unknown
  folderId?: unknown
  dateiname?: unknown
  zielsprache?: unknown
  medienHolen?: unknown
  medienEinbetten?: unknown
  sprecherErkennung?: unknown
  kontext?: unknown
  begriffe?: unknown
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const body = (await request.json().catch(() => null)) as WebSourceRequest | null
    if (!body) return NextResponse.json({ error: 'JSON-Body erforderlich' }, { status: 400 })
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : ''
    const dateiname = typeof body.dateiname === 'string' ? body.dateiname.trim() : ''
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'url (http/https) ist erforderlich' }, { status: 400 })
    if (!folderId) return NextResponse.json({ error: 'folderId ist erforderlich' }, { status: 400 })
    if (!/\.md$/i.test(dateiname)) return NextResponse.json({ error: 'dateiname muss auf .md enden' }, { status: 400 })
    const zielsprache = typeof body.zielsprache === 'string' && body.zielsprache.trim() ? body.zielsprache.trim() : 'de'
    if (body.medienHolen !== undefined && typeof body.medienHolen !== 'boolean') {
      return NextResponse.json({ error: 'medienHolen muss boolean sein' }, { status: 400 })
    }
    if (body.medienEinbetten !== undefined && typeof body.medienEinbetten !== 'boolean') {
      return NextResponse.json({ error: 'medienEinbetten muss boolean sein' }, { status: 400 })
    }

    // Typen prueft readAudioContextOptions zur Laufzeit (falscher Typ = 400), daher die Zuweisung als Request-Felder.
    const audioFelder = {
      speakerMode: body.sprecherErkennung,
      audioPrompt: body.kontext,
      audioKeywords: body.begriffe,
    } as Parameters<typeof readAudioContextOptions>[0]
    const gelesen = readAudioContextOptions(audioFelder)
    if ('error' in gelesen) return NextResponse.json({ error: gelesen.error }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    const provider = await getServerProvider(userEmail, libraryId)
    // Modell aus der Library-Konfiguration, wie in der Bruecke (standardLlmModell).
    const llmModel = library.config?.secretaryService?.llmModel?.trim() || undefined

    const ergebnis = await webseiteErschliessen({
      libraryId, userEmail, provider, url, folderId, dateiname,
      targetLanguage: zielsprache, audioContext: gelesen.options, llmModel,
      medienHolen: body.medienHolen ?? true,
      medienEinbetten: body.medienEinbetten ?? true,
    })
    return NextResponse.json({ ok: true, ...ergebnis })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    FileLogger.error('web-source', 'Webseite erschliessen fehlgeschlagen', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
