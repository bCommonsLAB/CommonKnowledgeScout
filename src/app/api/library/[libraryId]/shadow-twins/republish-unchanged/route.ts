/**
 * @fileoverview Geaenderte Markdown-Quelle unveraendert neu uebernehmen (API-Route)
 *
 * @description
 * Der Ein-Klick-Weg hinter dem Hinweis „Quelldatei wurde geaendert" in der
 * Archivansicht. Gilt NUR fuer Quellen, die ohne Sprachmodell publiziert
 * wurden (Vorlage `markdown-page` / `website-page` am Twin): Die Datei wird neu
 * gelesen, als Transformation am Twin abgelegt und ingestiert — derselbe Weg
 * wie das Brueckenwerkzeug `dokument_publizieren`. Der Text bleibt wortgleich.
 *
 * Jede andere Quelle wird abgewiesen (409): Dort schreibt ein neuer Lauf den
 * Text neu, das entscheidet der Mensch im Verarbeitungsdialog.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { publiziereMarkdownQuelle } from '@/lib/mcp/website-publizieren'
import { isUnchangedTemplate } from '@/lib/shadow-twin/unchanged-templates'
import { FileLogger } from '@/lib/debug/logger'

export const maxDuration = 120

interface RepublishRequest {
  sourceId: string
  /** true = auch mit Warnungen der Dokumentpruefung uebernehmen. */
  acceptWarnings?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = (await request.json()) as RepublishRequest
    if (!body?.sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Nur Quellen, deren Transformationen ALLE unveraendert publiziert wurden.
    const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [body.sourceId] })
    const transformations = docs.get(body.sourceId)?.artifacts?.transformation ?? {}
    const templateNames = Object.keys(transformations)
    if (templateNames.length === 0 || !templateNames.every((name) => isUnchangedTemplate(name))) {
      return NextResponse.json(
        { error: 'Diese Quelle wurde mit einer Vorlage transformiert — bitte im Verarbeitungsdialog aktualisieren.' },
        { status: 409 },
      )
    }
    const languages = [...new Set(templateNames.flatMap((name) => Object.keys(transformations[name] ?? {})))]
    if (languages.length === 0) {
      return NextResponse.json({ error: 'Am Twin ist keine Sprache hinterlegt.' }, { status: 409 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const item = await provider.getItemById(body.sourceId)
    if (!item || item.type !== 'file') {
      return NextResponse.json({ error: 'Quelle ist keine Datei' }, { status: 400 })
    }
    const source = { itemId: item.id, parentId: item.parentId, name: item.metadata.name }

    const warnings: string[] = []
    let chunks = 0
    for (const language of languages) {
      const row = await publiziereMarkdownQuelle({
        library, userEmail, provider, source,
        zielsprache: language, trotzWarnungen: body.acceptWarnings === true,
      })
      if (row.uebersprungen) {
        // Nichts geschrieben: Grund und Warnungen zurueckgeben. Mit Warnungen
        // und ohne acceptWarnings darf die Oberflaeche die Bestaetigung anbieten.
        return NextResponse.json({
          updated: false,
          reason: row.uebersprungen,
          warnings: row.warnungen,
          canAcceptWarnings: body.acceptWarnings !== true && row.warnungen.length > 0,
        }, { status: 422 })
      }
      warnings.push(...row.warnungen)
      chunks += row.chunks ?? 0
    }

    return NextResponse.json({ updated: true, languages, chunks, warnings }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/republish-unchanged', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
