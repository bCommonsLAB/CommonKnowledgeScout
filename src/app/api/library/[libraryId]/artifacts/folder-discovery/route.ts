/**
 * @fileoverview API-Route für Folder-Artifact-Discovery
 *
 * @description
 * Entdeckt transkribierte Artefakte in einem Verzeichnis.
 * Unterstützt sowohl MongoDB- als auch Filesystem-basierte Shadow-Twin-Speicherung.
 * Die client-seitige discoverFolderArtifacts nutzt nur den Provider und findet
 * daher keine MongoDB-Artefakte – diese Route löst das Problem.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getMediaKind } from '@/lib/media-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageItem } from '@/lib/storage/types'
import type { WizardSource } from '@/lib/creation/corpus'
import { FileLogger } from '@/lib/debug/logger'

/** Medientypen, die als Quellen verwendet werden können */
const SUPPORTED_MEDIA_KINDS = new Set<string>([
  'pdf',
  'audio',
  'video',
  'docx',
  'xlsx',
  'pptx',
  'markdown',
])

/**
 * Felder aus dem Shadow-Twin-Frontmatter, die in den Kontext für den Secretary übernommen werden.
 * Ermöglicht z. B. attachments_url, attachment_links für Event-Templates.
 * Siehe docs/analysis/shadow-twin-metadata-to-secretary-context.md
 */
const METADATA_KEYS_FOR_CONTEXT = new Set([
  'attachments_url',
  'attachment_links',
  'url',
  'video_url',
  'coverImageUrl',
  'title',
  'slug',
  'organisation',
  'event',
  'track',
])

/** Extrahiert relevante Metadaten aus dem Frontmatter für den Kontext. */
function extractSourceMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of METADATA_KEYS_FOR_CONTEXT) {
    const v = meta[key]
    if (v != null && v !== '') {
      out[key] = v
    }
  }
  return out
}

export interface FolderDiscoveryRequest {
  folderId: string
  targetLanguage?: string
}

export interface FolderDiscoveryResponse {
  sources: WizardSource[]
}

/**
 * POST /api/library/[libraryId]/artifacts/folder-discovery
 *
 * Entdeckt alle transkribierten Artefakte in einem Verzeichnis.
 * Nutzt MongoDB oder Filesystem je nach Library-Konfiguration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    }

    const { libraryId } = await params
    let body: FolderDiscoveryRequest

    try {
      body = (await request.json()) as FolderDiscoveryRequest
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    if (!body.folderId) {
      return NextResponse.json({ error: 'folderId ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const targetLanguage = body.targetLanguage || 'de'
    const shadowTwinConfig = getShadowTwinConfig(library)

    const items = await provider.listItemsById(body.folderId)
    const sources: WizardSource[] = []

    // Dateien filtern (keine Ordner)
    const files = items.filter((item): item is StorageItem => item.type === 'file')
    const supportedFiles = files.filter((item) => {
      const kind = getMediaKind(item)
      return SUPPORTED_MEDIA_KINDS.has(kind)
    })

    if (supportedFiles.length === 0) {
      return NextResponse.json({ sources: [] } as FolderDiscoveryResponse, { status: 200 })
    }

    // MongoDB-Pfad: Artefakte direkt aus Mongo laden
    if (shadowTwinConfig.primaryStore === 'mongo') {
      const sourceIds = supportedFiles.map((f) => f.id)
      const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

      for (const item of supportedFiles) {
        const doc = docs.get(item.id)
        if (!doc) continue

        // Bevorzuge Transcript, Fallback auf Transformation (falls nur Template-Output existiert)
        let selected = selectShadowTwinArtifact(doc, 'transcript', targetLanguage)
        if (!selected?.record?.markdown?.trim()) {
          selected = selectShadowTwinArtifact(doc, 'transformation', targetLanguage)
        }
        if (!selected?.record?.markdown?.trim()) continue

        const { meta, body } = parseFrontmatter(selected.record.markdown)
        const extractedText = body.trim()
        if (!extractedText) continue

        const sourceMetadata =
          meta && typeof meta === 'object' && !Array.isArray(meta)
            ? extractSourceMetadata(meta as Record<string, unknown>)
            : undefined

        if (sourceMetadata && Object.keys(sourceMetadata).length > 0) {
          FileLogger.debug('artifacts/folder-discovery', 'Shadow-Twin-Metadaten für Secretary-Kontext', {
            fileName: item.metadata?.name,
            sourceMetadata,
            keys: Object.keys(sourceMetadata),
          })
          // Console für lokales Debugging (Server-Log)
          console.debug('[folder-discovery] Shadow-Twin-Metadaten für', item.metadata?.name, ':', sourceMetadata)
        }

        const fileName = item.metadata?.name || 'unbekannt'
        const modifiedAt = item.metadata?.modifiedAt
        const createdAt =
          modifiedAt instanceof Date
            ? modifiedAt
            : typeof modifiedAt === 'string'
              ? new Date(modifiedAt)
              : new Date()

        sources.push({
          id: `file-${item.id}`,
          kind: 'file',
          fileName,
          extractedText,
          sourceMetadata: Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
          summary: extractedText.length > 150 ? `${extractedText.slice(0, 150)}...` : extractedText,
          createdAt,
        })
      }
    } else {
      // Filesystem-Pfad: resolveArtifact + getBinary
      for (const item of supportedFiles) {
        const fileName = item.metadata?.name || 'unbekannt'
        const parentId = item.parentId || body.folderId

        let extractedText = ''
        let summary = ''

        try {
          let sourceMetadata: Record<string, unknown> | undefined

          if (getMediaKind(item) === 'markdown') {
            const { blob } = await provider.getBinary(item.id)
            const raw = await blob.text()
            const { meta, body } = parseFrontmatter(raw)
            extractedText = body.trim()
            summary = extractedText.length > 150 ? `${extractedText.slice(0, 150)}...` : extractedText
            if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
              sourceMetadata = extractSourceMetadata(meta as Record<string, unknown>)
            }
          } else {
            // Bevorzuge Transcript, Fallback auf Transformation
            let resolved = await resolveArtifact(provider, {
              sourceItemId: item.id,
              sourceName: fileName,
              parentId,
              targetLanguage,
              preferredKind: 'transcript',
            })
            if (!resolved?.fileId) {
              resolved = await resolveArtifact(provider, {
                sourceItemId: item.id,
                sourceName: fileName,
                parentId,
                targetLanguage,
                preferredKind: 'transformation',
              })
            }

            if (resolved?.fileId) {
              const { blob } = await provider.getBinary(resolved.fileId)
              const raw = await blob.text()
              const { meta, body } = parseFrontmatter(raw)
              extractedText = body.trim()
              summary = extractedText.length > 150 ? `${extractedText.slice(0, 150)}...` : extractedText
              if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
                sourceMetadata = extractSourceMetadata(meta as Record<string, unknown>)
              }
            }
          }

          if (!extractedText.trim()) continue

          if (sourceMetadata && Object.keys(sourceMetadata).length > 0) {
            FileLogger.debug('artifacts/folder-discovery', 'Shadow-Twin-Metadaten für Secretary-Kontext (FS)', {
              fileName,
              sourceMetadata,
              keys: Object.keys(sourceMetadata),
            })
            console.debug('[folder-discovery] Shadow-Twin-Metadaten für', fileName, ':', sourceMetadata)
          }

          const modifiedAt = item.metadata?.modifiedAt
          const createdAt =
            modifiedAt instanceof Date
              ? modifiedAt
              : typeof modifiedAt === 'string'
                ? new Date(modifiedAt)
                : new Date()

          sources.push({
            id: `file-${item.id}`,
            kind: 'file',
            fileName,
            extractedText,
            sourceMetadata:
              sourceMetadata && Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
            summary: summary || fileName,
            createdAt,
          })
        } catch (err) {
          FileLogger.warn('artifacts/folder-discovery', `Überspringe ${fileName}`, {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    // Chronologisch sortieren (älteste zuerst). createdAt kann Date oder ISO-String sein.
    const toTs = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime()
    sources.sort((a, b) => toTs(a.createdAt) - toTs(b.createdAt))

    FileLogger.debug('artifacts/folder-discovery', 'Discovery abgeschlossen', {
      libraryId,
      folderId: body.folderId,
      totalFiles: supportedFiles.length,
      foundSources: sources.length,
      primaryStore: shadowTwinConfig.primaryStore,
    })

    return NextResponse.json({ sources } as FolderDiscoveryResponse, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('artifacts/folder-discovery', 'Fehler bei Folder-Discovery', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
