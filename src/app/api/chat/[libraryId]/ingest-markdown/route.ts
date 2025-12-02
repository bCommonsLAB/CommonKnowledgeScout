import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import { IngestionService } from '@/lib/chat/ingestion-service'

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

    FileLogger.info('ingest-markdown', 'Request', { libraryId, fileId, hasDocMeta: !!docMeta })

    const provider = await getServerProvider(userEmail, libraryId)
    const item = await provider.getItemById(fileId)
    const bin = await provider.getBinary(fileId)
    const markdown = await bin.blob.text()

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


