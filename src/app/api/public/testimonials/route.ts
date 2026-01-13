import { NextRequest, NextResponse } from 'next/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveOwnerEmailForPublicLibrary } from '@/lib/public/public-library-owner'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import crypto from 'crypto'
import type { Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

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
 * Für den anonymen Testimonial-Flow benötigen wir den Storage-Provider des Owners.
 *
 * Ursprünglich war der Public-Endpoint nur für "public libraries" gedacht und hat die Owner-Email
 * ausschließlich über `config.publicPublishing.isPublic=true` aufgelöst.
 *
 * In der Praxis wird der anonyme Flow aber auch für private Libraries verwendet – dann aber nur
 * mit einem per-Event `testimonialWriteKey` (QR-Link enthält writeKey).
 *
 * Diese Funktion:
 * - bevorzugt weiterhin die Public-Library-Auflösung (ohne writeKey-Zwang)
 * - fällt für private Libraries NUR mit vorhandenem writeKey auf eine allgemeine Owner-Suche zurück
 *
 * Sicherheitsprinzip:
 * - private Library => writeKey muss vorhanden sein, sonst keine Owner-Auflösung
 */
async function resolveOwnerForTestimonials(args: {
  libraryId: string
  writeKey?: string
}): Promise<{ ownerEmail: string; isPublicLibrary: boolean }> {
  const libraryId = String(args.libraryId || '').trim()
  const writeKey = typeof args.writeKey === 'string' ? args.writeKey.trim() : ''
  if (!libraryId) throw new Error('libraryId fehlt')

  // 1) Public libraries: weiterhin wie bisher.
  try {
    const ownerEmail = await resolveOwnerEmailForPublicLibrary(libraryId)
    return { ownerEmail, isPublicLibrary: true }
  } catch {
    // 2) Private libraries: Owner nur auflösen, wenn writeKey vorhanden ist.
    if (!writeKey) {
      throw new Error('Diese Library ist nicht public. writeKey ist erforderlich.')
    }

    const collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries'
    const col = await getCollection<Document>(collectionName)

    // Struktur in MongoDB: { email, libraries: [ { id, ... } ... ] }
    const row = await col.findOne(
      {
        libraries: {
          $elemMatch: { id: libraryId },
        },
      },
      { projection: { email: 1 } }
    )

    const ownerEmail = typeof row?.email === 'string' ? row.email.trim() : ''
    if (!ownerEmail) throw new Error('Owner-Email für library konnte nicht aufgelöst werden')
    return { ownerEmail, isPublicLibrary: false }
  }
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

    const children = await provider.listItemsById(testimonialsFolderId)
    const testimonialFolders = children.filter((it) => it.type === 'folder')

    const items = await Promise.all(
      testimonialFolders.map(async (folder) => {
        const folderId = folder.id
        const testimonialId = folder.metadata?.name || folderId
        const files = await provider.listItemsById(folderId)

        const audio = files.find((f) => f.type === 'file' && /\.(mp3|m4a|wav|ogg|opus|flac|webm)$/.test(String(f.metadata?.name || '').toLowerCase()))
        const metaFile = files.find((f) => f.type === 'file' && String(f.metadata?.name || '').toLowerCase() === 'meta.json')

        const meta = await (async () => {
          if (!metaFile) return null
          try {
            const { blob } = await provider.getBinary(metaFile.id)
            const txt = await blob.text()
            return JSON.parse(txt) as unknown
          } catch {
            return null
          }
        })()

        const audioUrl = audio ? await provider.getStreamingUrl(audio.id).catch(() => null) : null

        return {
          testimonialId,
          folderId,
          audio: audio
            ? {
                fileId: audio.id,
                fileName: audio.metadata?.name || null,
                url: audioUrl,
              }
            : null,
          meta,
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

    const audioUpload = file
      ? await (async () => {
          const ext = getFileExtensionFromName(file.name) || (file.type.includes('webm') ? 'webm' : 'dat')
          const audioName = `audio.${ext}`
          return await provider.uploadFile(
            testimonialFolderId,
            new File([file], audioName, { type: file.type || 'audio/*' })
          )
        })()
      : null

    const meta = {
      testimonialId,
      createdAt: new Date().toISOString(),
      eventFileId,
      speakerName: speakerName || null,
      consent: consent ?? null,
      /**
       * Text ist der "finale" Text – der Nutzer konnte ihn vor dem Speichern korrigieren.
       * Wenn Audio vorhanden ist, kann man später weiterhin serverseitig nachtranskribieren,
       * aber das ist bewusst nicht Teil dieses minimalen Flows.
       */
      text: text || null,
      audio: audioUpload
        ? {
            fileId: audioUpload.id,
            fileName: audioUpload.metadata?.name || null,
            mimeType: audioUpload.metadata?.mimeType || (file ? file.type : null) || null,
          }
        : null,
    }
    const metaFile = new File([JSON.stringify(meta, null, 2)], 'meta.json', { type: 'application/json' })
    await provider.uploadFile(testimonialFolderId, metaFile)

    return NextResponse.json(
      {
        status: 'ok',
        testimonialId,
        audioFileId: audioUpload?.id || null,
      },
      { status: 200 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

