import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { getShadowTwinArtifact, getShadowTwinsBySourceIds, toArtifactKey } from '@/lib/repositories/shadow-twin-repo'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  // Zusätzliche Meta-Felder, die in das Frontmatter-Meta gemerged werden (optional)
  docMeta: z.record(z.unknown()).optional(),
})

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
    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    }

    const { fileId, fileName, docMeta } = parsed.data

    FileLogger.info('ingest-markdown', 'Request', { libraryId, fileId, hasDocMeta: !!docMeta, isMongoId: isMongoShadowTwinId(fileId) })

    // WICHTIG: Prüfe, ob es sich um eine MongoDB Shadow-Twin ID handelt
    // Wenn ja, lade direkt aus MongoDB, anstatt über den Filesystem-Provider
    let markdown: string
    let item: { metadata: { name: string } }
    
    if (isMongoShadowTwinId(fileId)) {
      const parts = parseMongoShadowTwinId(fileId)
      if (!parts) {
        return NextResponse.json({ error: 'Ungültige MongoDB Shadow-Twin ID' }, { status: 400 })
      }
      
      // Prüfe, ob MongoDB als primärer Store aktiviert ist
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
      
      const shadowTwinConfig = getShadowTwinConfig(library)
      if (shadowTwinConfig.primaryStore !== 'mongo') {
        return NextResponse.json({ error: 'MongoDB ist nicht als primärer Store aktiviert' }, { status: 400 })
      }
      
      // Lade Artefakt direkt aus MongoDB
      const artifact = await getShadowTwinArtifact({
        libraryId,
        sourceId: parts.sourceId,
        artifactKey: toArtifactKey({
          sourceId: parts.sourceId,
          kind: parts.kind,
          targetLanguage: parts.targetLanguage,
          templateName: parts.templateName,
        }),
      })
      
      if (!artifact) {
        return NextResponse.json({ error: 'Artefakt nicht gefunden in MongoDB' }, { status: 404 })
      }
      
      markdown = artifact.markdown
      item = {
        metadata: {
          name: fileName || `${parts.sourceId}.${parts.kind}.${parts.targetLanguage}.md`
        }
      }
      
      FileLogger.info('ingest-markdown', 'Markdown aus MongoDB geladen', {
        fileId,
        sourceId: parts.sourceId,
        kind: parts.kind,
        markdownLength: markdown.length
      })
    } else {
      // Provider-ID: Prüfe ob Mongo-Mode aktiv – wenn ja, aus MongoDB laden statt Filesystem.
      // Siehe docs/rules/ingest-mongo-only.md: Alle ingestierten Artefakte MÜSSEN in MongoDB existieren.
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      const shadowTwinConfig = library ? getShadowTwinConfig(library) : null

      if (shadowTwinConfig?.primaryStore === 'mongo') {
        // Mongo-Mode: fileId ist sourceId – Transformation aus MongoDB laden
        const docsMap = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [fileId] })
        const doc = docsMap.get(fileId)
        if (!doc) {
          FileLogger.warn('ingest-markdown', 'Kein Shadow-Twin in MongoDB für sourceId', { fileId, libraryId })
          return NextResponse.json({ error: 'Kein Shadow-Twin-Artefakt in MongoDB für diese Datei. Bitte zuerst Transformation durchführen.' }, { status: 404 })
        }

        // Transformation auswählen (gleiche Logik wie batch-resolve)
        const selected = selectShadowTwinArtifact(doc, 'transformation', 'de')
        if (!selected || !selected.record.markdown) {
          FileLogger.warn('ingest-markdown', 'Kein Transformations-Artefakt mit Inhalt', { fileId, libraryId })
          return NextResponse.json({ error: 'Kein Transformations-Artefakt mit Inhalt in MongoDB gefunden.' }, { status: 404 })
        }

        markdown = selected.record.markdown
        item = { metadata: { name: fileName || `${fileId}.md` } }

        FileLogger.info('ingest-markdown', 'Markdown aus MongoDB geladen (Mongo-Mode, Provider-ID)', {
          fileId,
          kind: selected.kind,
          templateName: selected.templateName,
          markdownLength: markdown.length,
        })
      } else {
        // Filesystem-Mode: Lade über Provider (unveraendert)
        const provider = await getServerProvider(userEmail, libraryId)
        item = await provider.getItemById(fileId)
        const bin = await provider.getBinary(fileId)
        markdown = await bin.blob.text()

        FileLogger.info('ingest-markdown', 'Markdown aus Filesystem geladen', {
          fileId,
          markdownLength: markdown.length,
        })
      }
    }

    // DEBUG: Prüfe ob Frontmatter vorhanden ist
    const hasFrontmatter = markdown.trim().startsWith('---')
    FileLogger.info('ingest-markdown', 'Markdown geladen', { 
      fileId, 
      markdownLength: markdown.length,
      hasFrontmatter,
      firstChars: markdown.substring(0, 200)
    })

    // DEBUG: Parse Frontmatter manuell um zu sehen was rauskommt
    try {
      const fm = await import('@/lib/markdown/frontmatter')
      const secretaryParser = await import('@/lib/secretary/response-parser')
      
      // Teste extractFrontmatterBlock direkt
      const fmBlock = fm.extractFrontmatterBlock(markdown)
      FileLogger.info('ingest-markdown', 'Frontmatter-Block extrahiert', {
        fileId,
        hasBlock: !!fmBlock,
        blockLength: fmBlock?.length || 0,
        blockPreview: fmBlock?.substring(0, 200) || null
      })
      
      // Teste parseSecretaryMarkdownStrict direkt
      const secretaryParsed = secretaryParser.parseSecretaryMarkdownStrict(markdown)
      FileLogger.info('ingest-markdown', 'Secretary Parser Ergebnis', {
        fileId,
        hasFrontmatter: !!secretaryParsed.frontmatter,
        metaKeys: Object.keys(secretaryParsed.meta),
        metaCount: Object.keys(secretaryParsed.meta).length,
        errors: secretaryParsed.errors
      })
      
      // Teste parseFrontmatter
      const parsedFrontmatter = fm.parseFrontmatter(markdown)
      FileLogger.info('ingest-markdown', 'parseFrontmatter Ergebnis', {
        fileId,
        metaKeys: Object.keys(parsedFrontmatter.meta),
        metaCount: Object.keys(parsedFrontmatter.meta).length,
        bodyLength: parsedFrontmatter.body.length,
        hasDocMetaOverride: !!docMeta
      })
    } catch (err) {
      FileLogger.error('ingest-markdown', 'Fehler beim Parsen des Frontmatters', { fileId, error: err instanceof Error ? err.message : String(err) })
    }

    // Provider nur laden, wenn nicht bereits vorhanden (für MongoDB Shadow-Twin IDs)
    const provider = await getServerProvider(userEmail, libraryId)
    
    const res = await IngestionService.upsertMarkdown(
      userEmail,
      libraryId,
      fileId,
      fileName || item.metadata.name,
      markdown,
      docMeta,
      undefined, // jobId
      provider // Provider für Bild-Upload
    )

    FileLogger.info('ingest-markdown', 'Erfolg', { libraryId, fileId, chunks: res.chunksUpserted, imageErrors: res.imageErrors?.length ?? 0 })
    
    // Wenn Bild-Fehler vorhanden sind, aber Ingestion erfolgreich war: Warnung zurückgeben
    if (res.imageErrors && res.imageErrors.length > 0) {
      return NextResponse.json({
        status: 'ok',
        index: res.index,
        chunksUpserted: res.chunksUpserted,
        warnings: {
          imageErrors: res.imageErrors,
          message: `${res.imageErrors.length} Bild(er) konnten nicht verarbeitet werden`,
        },
      }, { status: 200 })
    }
    
    return NextResponse.json({ 
      status: 'ok', 
      index: res.index, 
      chunksUpserted: res.chunksUpserted
    }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    FileLogger.error('ingest-markdown', 'Fehler', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


