/**
 * src/hooks/library/media-tab/use-gallery-items.ts
 *
 * Hook fuer die Gallery-Items-Aggregation in `media-tab.tsx`.
 *
 * Aus `media-tab.tsx` ausgegliedert (Welle 3-II-Hooks-a, Schritt 2/4).
 * Welle initial als "Welle 3-III-a" gestartet, am 2026-05-01 zu
 * "Welle 3-II-Hooks-a" umbenannt — siehe
 * .cursor/rules/refactor-naming-konvention.mdc
 *
 * Verantwortlichkeiten:
 * - Aggregierte Medien-API (sibling files + fragment gallery items) laden
 * - Ableiten der `galleryItems` (kombinierte Galerie mit Assignment-Filter)
 * - `previewUrlByFileName`-Map fuer Slot-Anzeige bereitstellen
 *
 * 1:1-portierte Logik aus Bestand — keine Verhaltensaenderung.
 */

import { useEffect, useMemo, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import { buildTwinRelativeMediaRef } from '@/lib/storage/shadow-twin-folder-name'
import type { ViewTypeMediaConfig } from '@/lib/detail-view-types/registry'
import type { SiblingFile } from '@/app/api/library/[libraryId]/sibling-files/route'
import {
  type AssignmentTarget,
  type GalleryItem,
  safeArray,
} from '@/components/library/media-tab/helpers'

interface FragmentGalleryItem {
  key: string
  displayName: string
  fragmentSourceId: string
  mediaKind: 'image' | 'document'
  previewUrl?: string
  sourceFileName?: string
}

export interface UseGalleryItemsArgs {
  libraryId: string
  fileId: string
  /** Multi-Source-Aggregation aktiviert (composite-Transcripts) */
  useMultiSourceAggregation: boolean
  /** Quell-Dateien fuer Multi-Source-Aggregation (composite-Transcripts) */
  compositeSourceNames: string[]
  /** Frontmatter-Metadaten zum Markieren bereits zugeordneter Items */
  frontmatterMeta: Record<string, unknown> | null
  /** Media-Konfig basierend auf DetailViewType (welche Felder gibt es?) */
  mediaConfig: ViewTypeMediaConfig
  /** Aktuell aktiver Assignment-Slot (filtert die Galerie) */
  activeAssignment: AssignmentTarget | null
}

export interface UseGalleryItemsResult {
  /** Sibling-Dateien aus der aggregierten API */
  siblingFiles: SiblingFile[]
  /** Fragment-Items (Bilder + PDFs) aus der aggregierten API */
  fragmentGalleryItems: FragmentGalleryItem[]
  /** Lade-Status fuer Galerie und Slots (zentral) */
  galleryLoading: boolean
  /** Fehler beim Aggregieren (oder null) */
  aggregatedError: string | null
  /** Map Dateiname → Vorschau-URL fuer Slot-Anzeige */
  previewUrlByFileName: Map<string, string>
  /** Kombinierte, gefilterte Galerie-Items zum Anzeigen */
  galleryItems: GalleryItem[]
}

export function useGalleryItems(args: UseGalleryItemsArgs): UseGalleryItemsResult {
  const {
    libraryId,
    fileId,
    useMultiSourceAggregation,
    compositeSourceNames,
    frontmatterMeta,
    mediaConfig,
    activeAssignment,
  } = args

  const [siblingFiles, setSiblingFiles] = useState<SiblingFile[]>([])
  const [fragmentGalleryItems, setFragmentGalleryItems] = useState<FragmentGalleryItem[]>([])
  const [aggregatedLoading, setAggregatedLoading] = useState(false)
  const [aggregatedError, setAggregatedError] = useState<string | null>(null)

  // Stabilisiere die compositeSourceNames-Abhaengigkeit fuer den useEffect
  // (Array-Identitaet aendert sich sonst bei jedem Render).
  const compositeSourceKey = useMemo(
    () => compositeSourceNames.join('\0'),
    [compositeSourceNames],
  )

  // Aggregierte-Medien-API aufrufen
  useEffect(() => {
    if (!libraryId || !fileId) return
    let cancelled = false
    setAggregatedLoading(true)
    setAggregatedError(null)

    void (async () => {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/aggregated-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anchorSourceId: fileId,
            targetLanguage: 'de',
            compositeSourceFileNames: useMultiSourceAggregation ? compositeSourceNames : [],
          }),
        })
        const json = await res.json().catch(() => ({})) as {
          files?: SiblingFile[]
          fragmentGalleryItems?: FragmentGalleryItem[]
          error?: string
        }
        if (cancelled) return
        if (res.ok && json.files && json.fragmentGalleryItems) {
          setSiblingFiles(json.files)
          setFragmentGalleryItems(json.fragmentGalleryItems)
        } else {
          setSiblingFiles([])
          setFragmentGalleryItems([])
          setAggregatedError(json.error || `aggregated-media: HTTP ${res.status}`)
          UILogger.warn('useGalleryItems', 'aggregated-media API nicht OK', { status: res.status, error: json.error })
        }
      } catch (error) {
        if (!cancelled) {
          setSiblingFiles([])
          setFragmentGalleryItems([])
          setAggregatedError(error instanceof Error ? error.message : String(error))
        }
        UILogger.warn('useGalleryItems', 'Fehler beim Laden der aggregierten Medien', { error })
      } finally {
        if (!cancelled) setAggregatedLoading(false)
      }
    })()

    return () => { cancelled = true }
    // compositeSourceNames bewusst NICHT in der Dep-Liste — der String
    // compositeSourceKey deckt Aenderungen ab. Die Array-Identitaet
    // aendert sich sonst bei jedem Parent-Render und triggert Effect-
    // Loops (siehe Test mit fetch-Mock).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, fileId, useMultiSourceAggregation, compositeSourceKey])

  const galleryLoading = aggregatedLoading

  // Dateiname → Vorschau-URL fuer Slots (Cover/Galerie) ohne Abhaengigkeit
  // vom Assignment-Filter.
  const previewUrlByFileName = useMemo(() => {
    const m = new Map<string, string>()
    for (const frag of fragmentGalleryItems) {
      if (frag.displayName && frag.previewUrl) {
        m.set(frag.displayName, frag.previewUrl)
        if (frag.sourceFileName) {
          m.set(buildTwinRelativeMediaRef(frag.sourceFileName, frag.displayName), frag.previewUrl)
        }
      }
    }
    for (const sib of siblingFiles) {
      if (!m.has(sib.name) && sib.mediaKind === 'image') {
        m.set(
          sib.name,
          `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(sib.id)}`,
        )
      }
    }
    return m
  }, [fragmentGalleryItems, siblingFiles, libraryId])

  // Kombinierte Galerie: Siblings + Fragments, dedupliziert nach Name.
  const galleryItems = useMemo((): GalleryItem[] => {
    const items = new Map<string, GalleryItem>()

    // Fragmente aus Aggregation (kanonische Namen, stabiler Key pro Quelle+Name)
    for (const frag of fragmentGalleryItems) {
      if (!frag.displayName) continue
      const kind = frag.mediaKind === 'image' ? 'image' as const : 'document' as const
      const frontmatterRef = frag.sourceFileName
        ? buildTwinRelativeMediaRef(frag.sourceFileName, frag.displayName)
        : frag.displayName
      items.set(frag.key, {
        id: frag.key,
        name: frag.displayName,
        source: 'fragment',
        mediaKind: kind,
        previewUrl: frag.previewUrl,
        fragmentSourceId: frag.fragmentSourceId,
        sourceFileName: frag.sourceFileName,
        frontmatterRef,
      })
    }

    // Siblings: eigener Map-Key (`sibling:id`), damit Fragmente mit gleichem
    // Dateinamen (anderes PDF) koexistieren.
    for (const sib of siblingFiles) {
      const previewUrl = sib.mediaKind === 'image'
        ? `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(sib.id)}`
        : undefined
      const kind = sib.mediaKind === 'pdf' ? 'pdf' as const
        : sib.mediaKind === 'link' ? 'link' as const
        : 'image' as const
      items.set(`sibling:${sib.id}`, {
        id: sib.id,
        name: sib.name,
        source: 'sibling',
        mediaKind: kind,
        previewUrl,
        size: sib.size,
      })
    }

    const findByAssignedFileName = (fileRef: string): GalleryItem | undefined => {
      const base = fileRef.split('/').pop() || fileRef
      const norm = fileRef.trim()
      for (const it of items.values()) {
        const ref = it.frontmatterRef ?? it.name
        if (ref === fileRef || ref === norm || it.name === fileRef || it.name === base) return it
      }
      return undefined
    }

    // Markiere zugeordnete Dateien
    if (frontmatterMeta) {
      const coverUrl = frontmatterMeta.coverImageUrl as string | undefined
      if (coverUrl) {
        const item = findByAssignedFileName(coverUrl)
        if (item) item.assignedTo = 'coverImageUrl'
      }
      if (mediaConfig.personField) {
        const imageUrls = frontmatterMeta[mediaConfig.personField.imageKey]
        if (Array.isArray(imageUrls)) {
          for (const url of imageUrls) {
            if (typeof url === 'string') {
              const item = findByAssignedFileName(url)
              if (item) item.assignedTo = mediaConfig.personField.imageKey
            }
          }
        }
      }
      if (mediaConfig.galleryField) {
        const galleryUrls = safeArray(frontmatterMeta[mediaConfig.galleryField.key])
        for (const url of galleryUrls) {
          const item = findByAssignedFileName(url)
          if (item) item.assignedTo = mediaConfig.galleryField.key
        }
      }
      const attachmentUrls = safeArray(frontmatterMeta.attachments_url)
      for (const url of attachmentUrls) {
        const item = findByAssignedFileName(url)
        if (item) item.assignedTo = 'attachments_url'
      }
    }

    // Filtern basierend auf aktivem Assignment
    const result = Array.from(items.values())
    if (activeAssignment) {
      if (activeAssignment.fieldKey === 'url') {
        return result.filter(item => item.mediaKind === 'link')
      }
      if (activeAssignment.fieldKey === 'attachments_url') {
        return result.filter(item => item.mediaKind !== 'link')
      }
      return result.filter(item => item.mediaKind === 'image')
    }
    return result
  }, [siblingFiles, fragmentGalleryItems, frontmatterMeta, mediaConfig, activeAssignment, libraryId])

  return {
    siblingFiles,
    fragmentGalleryItems,
    galleryLoading,
    aggregatedError,
    previewUrlByFileName,
    galleryItems,
  }
}
