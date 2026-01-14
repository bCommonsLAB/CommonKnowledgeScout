import { NextRequest, NextResponse } from 'next/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveOwnerForTestimonials } from '@/lib/public/public-library-owner'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { writeTestimonialArtifacts } from '@/lib/testimonials/testimonial-writer'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getFileExtensionFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || null
}

async function ensureChildFolderId(args: {
  provider: Awaited<ReturnType<typeof getServerProvider>>
  parentId: string
  folderName: string
}): Promise<string> {
  const items = await args.provider.listItemsById(args.parentId)
  const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === args.folderName)
  if (existing?.id) return existing.id
  const created = await args.provider.createFolder(args.parentId, args.folderName)
  return created.id
}

async function readEventWriteKeyIfAny(args: {
  provider: Awaited<ReturnType<typeof getServerProvider>>
  eventFileId: string
}): Promise<string | null> {
  const { blob } = await args.provider.getBinary(args.eventFileId)
  const markdown = await blob.text()
  const { meta } = parseFrontmatter(markdown)
  const key = typeof meta.testimonialWriteKey === 'string' ? meta.testimonialWriteKey.trim() : ''
  return key || null
}

/**
 * GET /api/public/testimonials?libraryId=...&eventFileId=...&writeKey=...
 *
 * Lists testimonials stored under the event folder:
 * - <eventFolder>/testimonials/<testimonialId>/audio.*
 * - <eventFolder>/testimonials/<testimonialId>/meta.json
 *
 * Security:
 * - If the event has `testimonialWriteKey` in its frontmatter, requests must provide the same key.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const libraryId = nonEmptyString(url.searchParams.get('libraryId'))
    const eventFileId = nonEmptyString(url.searchParams.get('eventFileId'))
    const writeKey = nonEmptyString(url.searchParams.get('writeKey'))
    // writeKey is intentionally NOT required for listing.
    // We want testimonials to be readable (public) while writes can still be restricted.

    if (!libraryId || !eventFileId) {
      return NextResponse.json({ error: 'libraryId und eventFileId sind erforderlich' }, { status: 400 })
    }

    const { ownerEmail, isPublicLibrary } = await resolveOwnerForTestimonials({ libraryId, writeKey })
    const provider = await getServerProvider(ownerEmail, libraryId)

    const eventItem = await provider.getItemById(eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      return NextResponse.json({ error: 'Event-Datei nicht gefunden' }, { status: 404 })
    }
    const eventFolderId = eventItem.parentId || 'root'

    // Private libraries: listing nur mit gültigem writeKey (sonst wäre es ein Leck).
    if (!isPublicLibrary) {
      const requiredKey = await readEventWriteKeyIfAny({ provider, eventFileId })
      if (!requiredKey) {
        return NextResponse.json(
          { error: 'Event ist nicht für anonyme Testimonials freigegeben (testimonialWriteKey fehlt)' },
          { status: 403 }
        )
      }
      if (requiredKey !== writeKey) {
        return NextResponse.json({ error: 'Ungültiger writeKey' }, { status: 403 })
      }
    }

    const testimonialsFolderId = await ensureChildFolderId({
      provider,
      parentId: eventFolderId,
      folderName: 'testimonials',
    })

    // Verwende gemeinsame Discovery-Funktion
    const { discoverTestimonials } = await import('@/lib/testimonials/testimonial-discovery')
    const discovered = await discoverTestimonials({
      provider,
      eventFileId,
    })

    // Konvertiere zu API-Format
    const items = await Promise.all(
      discovered.map(async (t) => {
        const audioUrl = t.audioFileId 
          ? await provider.getStreamingUrl(t.audioFileId).catch(() => null) 
          : null

        // Status: 'ready' wenn Text vorhanden, 'pending' wenn nur Audio
        const status = t.text && t.text.trim().length > 0 ? 'ready' : 'pending'

        return {
          testimonialId: t.testimonialId,
          folderId: t.folderId,
          status,
          audio: t.hasAudio && t.audioFileId
            ? {
                fileId: t.audioFileId,
                fileName: t.audioFileName,
                url: audioUrl,
              }
            : null,
          meta: {
            testimonialId: t.testimonialId,
            createdAt: t.createdAt,
            speakerName: t.speakerName,
            text: t.text,
          },
        }
      })
    )

    return NextResponse.json({ items }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/public/testimonials
 *
 * FormData:
 * - libraryId: string
 * - eventFileId: string
 * - writeKey?: string
 * - file: File (audio/*)
 * - speakerName?: string
 * - consent?: string|boolean
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    const libraryId = nonEmptyString(form.get('libraryId'))
    const eventFileId = nonEmptyString(form.get('eventFileId'))
    const writeKey = nonEmptyString(form.get('writeKey'))
    const speakerName = nonEmptyString(form.get('speakerName'))
    const text = nonEmptyString(form.get('text'))
    const consentRaw = form.get('consent')
    const consent =
      typeof consentRaw === 'boolean'
        ? consentRaw
        : typeof consentRaw === 'string'
          ? ['true', '1', 'yes', 'y'].includes(consentRaw.toLowerCase().trim())
          : undefined

    if (!libraryId || !eventFileId) {
      return NextResponse.json({ error: 'libraryId und eventFileId sind erforderlich' }, { status: 400 })
    }
    const fileRaw = form.get('file')
    const file = fileRaw instanceof File ? fileRaw : null
    if (!file && !text) {
      return NextResponse.json({ error: 'Entweder Text oder Audio ist erforderlich' }, { status: 400 })
    }
    if (file) {
      if (file.size <= 0) {
        return NextResponse.json({ error: 'Leere Datei' }, { status: 400 })
      }
      // Sehr konservatives Limit (kann später konfiguriert werden)
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'Audio-Datei zu groß (max 25MB)' }, { status: 413 })
      }
    }

    const { ownerEmail, isPublicLibrary } = await resolveOwnerForTestimonials({ libraryId, writeKey })
    const provider = await getServerProvider(ownerEmail, libraryId)

    const eventItem = await provider.getItemById(eventFileId)
    if (!eventItem || eventItem.type !== 'file') {
      return NextResponse.json({ error: 'Event-Datei nicht gefunden' }, { status: 404 })
    }
    const eventFolderId = eventItem.parentId || 'root'

    const requiredKey = await readEventWriteKeyIfAny({ provider, eventFileId })
    // Private libraries: ohne per-Event writeKey keine anonyme Aufnahme.
    // (Bei public libraries darf das Event weiterhin "offen" sein.)
    if (!isPublicLibrary && !requiredKey) {
      return NextResponse.json(
        { error: 'Event ist nicht für anonyme Testimonials freigegeben (testimonialWriteKey fehlt)' },
        { status: 403 }
      )
    }
    if (requiredKey && requiredKey !== writeKey) {
      return NextResponse.json({ error: 'Ungültiger writeKey' }, { status: 403 })
    }

    const testimonialsFolderId = await ensureChildFolderId({
      provider,
      parentId: eventFolderId,
      folderName: 'testimonials',
    })

    const testimonialId = crypto.randomUUID()
    const testimonialFolderId = await ensureChildFolderId({
      provider,
      parentId: testimonialsFolderId,
      folderName: testimonialId,
    })

    // 1. Schreibe Source-File (Audio oder Text)
    let sourceFile: Awaited<ReturnType<typeof provider.uploadFile>>
    
    if (file) {
      // Audio-Datei hochladen
      const ext = getFileExtensionFromName(file.name) || (file.type.includes('webm') ? 'webm' : 'dat')
      const audioName = `audio.${ext}`
      sourceFile = await provider.uploadFile(
        testimonialFolderId,
        new File([file], audioName, { type: file.type || 'audio/*' })
      )
    } else if (text && text.trim().length > 0) {
      // Text-Datei hochladen (wenn nur Text, kein Audio)
      const textName = 'source.txt'
      sourceFile = await provider.uploadFile(
        testimonialFolderId,
        new File([text], textName, { type: 'text/plain' })
      )
    } else {
      return NextResponse.json({ error: 'Entweder Text oder Audio ist erforderlich' }, { status: 400 })
    }

    // 2. Wenn Text vorhanden: synchron Shadow-Twin-Artefakte schreiben
    const createdAt = new Date().toISOString()
    const targetLanguage = 'de' // TODO: könnte aus Event-Frontmatter kommen
    const templateName = 'event-testimonial-creation-de' // TODO: könnte aus Event-Frontmatter kommen

    if (text && text.trim().length > 0) {
      // Schreibe synchron nur Transcript-Artefakt
      // Transformation-Artefakt wird später im Finalisieren-Wizard erstellt
      const artifacts = await writeTestimonialArtifacts({
        provider,
        eventFileId,
        testimonialFolderId,
        sourceFile,
        text: text.trim(),
        targetLanguage,
        templateName,
        libraryId,
        userEmail: ownerEmail,
        metadata: {
          testimonialId,
          createdAt,
          eventFileId,
          speakerName: speakerName || null,
          consent: consent ?? null,
        },
      })

      return NextResponse.json(
        {
          status: 'ok',
          testimonialId,
          audioFileId: file ? sourceFile.id : null,
          transcriptFileId: artifacts.transcript?.file.id || null,
          // Transformation wird später im Finalisieren-Wizard erstellt
        },
        { status: 200 }
      )
    } else {
      // Audio-only: Job starten (TODO: wird später implementiert)
      // Für jetzt: nur Source-File speichern, kein meta.json mehr
      return NextResponse.json(
        {
          status: 'ok',
          testimonialId,
          audioFileId: sourceFile.id,
          pending: true, // Transformation fehlt noch
        },
        { status: 200 }
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

