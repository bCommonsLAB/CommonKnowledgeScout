'use client'

/**
 * src/hooks/library/session-detail/use-resolved-session-media.ts
 *
 * Hook fuer die Media-Resolution in `session-detail.tsx`.
 *
 * Aus `session-detail.tsx` ausgegliedert (Welle 3-III-c, Schritt 1/3).
 *
 * Verantwortlichkeiten:
 * - Aus Frontmatter-Daten Listen extrahieren (attachments_url, galleryImageUrls, coverImageUrl)
 * - URLs aufloesen via ShadowTwinService-Resolver (resolve-binary-url API)
 * - Fallback: Provider-Verzeichnis-Suche nach Dateinamen
 * - Request-Dedupe: gleiche Inputs → gleiche Promise
 * - Failed-URL-Tracking fuer Image-Render-Errors
 *
 * 1:1-portierte Logik aus Bestand — keine Verhaltensaenderung.
 */

import * as React from 'react'
import type { StorageProvider } from '@/lib/storage/types'

interface ResolvedMediaEntry {
  name: string
  url?: string
}

export interface UseResolvedSessionMediaArgs {
  libraryId: string | undefined
  /** Source-File-ID (Anker fuer ShadowTwin-Resolver) */
  fileId: string | undefined
  /** Source-File-Name */
  fileName: string | undefined
  /** Aktuelles Verzeichnis (fuer Fallback-Suche) */
  currentFolderId: string | undefined
  /** Storage-Provider (fuer Fallback-Suche) */
  provider: StorageProvider | null | undefined
  /** Roh-Werte aus Frontmatter */
  attachmentsUrl: unknown
  galleryImageUrls: unknown
  coverImageUrl: unknown
  /** Helper aus der Komponente: extrahiert Display-Filename aus URL */
  getDisplayFileName: (value: string) => string
}

export interface UseResolvedSessionMediaResult {
  /** Aus Frontmatter extrahierte Anhang-Dateinamen (vor Aufloesung) */
  attachmentNames: string[]
  /** Aus Frontmatter extrahierte Galerie-Bild-Dateinamen (vor Aufloesung) */
  galleryImageNames: string[]
  /** Aus Frontmatter extrahierter Cover-Image-Name (vor Aufloesung) */
  coverImageName: string
  /** Aufgeloeste Anhaenge mit URL (oder undefined bei Fehler) */
  resolvedAttachments: ResolvedMediaEntry[]
  /** Aufgeloeste Galerie-Bilder mit URL */
  resolvedGalleryImages: ResolvedMediaEntry[]
  /** Aufgeloeste Cover-Image-URL */
  resolvedCoverImageUrl: string | undefined
  /** Anhang-Namen, die nicht aufgeloest werden konnten (fuer Hinweis-Box) */
  unresolvedAttachmentNames: string[]
  /** Galerie-Namen, die nicht aufgeloest werden konnten */
  unresolvedGalleryImageNames: string[]
  /** Set von Galerie-URLs, die im Browser fehlschlugen (z.B. 404) */
  failedGalleryUrls: Set<string>
  /** Markiert eine Galerie-URL als fehlgeschlagen (Image-onError-Handler) */
  markGalleryUrlAsFailed: (url: string) => void
}

export function useResolvedSessionMedia(
  args: UseResolvedSessionMediaArgs,
): UseResolvedSessionMediaResult {
  const {
    libraryId,
    fileId,
    fileName,
    currentFolderId,
    provider,
    attachmentsUrl,
    galleryImageUrls,
    coverImageUrl,
    getDisplayFileName,
  } = args

  const attachmentNames = React.useMemo(() => {
    return Array.isArray(attachmentsUrl)
      ? attachmentsUrl.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : (typeof attachmentsUrl === 'string' && attachmentsUrl.trim().length > 0
        ? [attachmentsUrl.trim()]
        : [])
  }, [attachmentsUrl])

  const galleryImageNames = React.useMemo(() => {
    return Array.isArray(galleryImageUrls)
      ? galleryImageUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : []
  }, [galleryImageUrls])

  const coverImageName = React.useMemo(
    () => (typeof coverImageUrl === 'string' ? coverImageUrl.trim() : ''),
    [coverImageUrl],
  )

  const [resolvedAttachments, setResolvedAttachments] = React.useState<ResolvedMediaEntry[]>([])
  const [resolvedGalleryImages, setResolvedGalleryImages] = React.useState<ResolvedMediaEntry[]>([])
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = React.useState<string | undefined>(undefined)
  const [failedGalleryUrls, setFailedGalleryUrls] = React.useState<Set<string>>(new Set())

  // Request-Dedupe: verhindert doppelte resolve-binary-url Aufrufe bei
  // identischem Input.
  const mediaResolveInFlightRef = React.useRef<Map<string, Promise<string | undefined>>>(new Map())
  const mediaResolvedUrlCacheRef = React.useRef<Map<string, string | undefined>>(new Map())
  const lastResolvedSignatureRef = React.useRef<string>('')

  const unresolvedAttachmentNames = React.useMemo(
    () => resolvedAttachments.filter((entry) => !entry.url).map((entry) => getDisplayFileName(entry.name)),
    [resolvedAttachments, getDisplayFileName],
  )

  const unresolvedGalleryImageNames = React.useMemo(
    () => resolvedGalleryImages.filter((entry) => !entry.url).map((entry) => entry.name),
    [resolvedGalleryImages],
  )

  const mediaResolveSignature = React.useMemo(() => {
    return JSON.stringify({
      libraryId: libraryId || '',
      fileId: fileId || '',
      fileName: fileName || '',
      currentFolderId: currentFolderId || '',
      providerAvailable: !!provider,
      attachmentNames,
      galleryImageNames,
      coverImageName,
    })
  }, [attachmentNames, coverImageName, currentFolderId, fileId, fileName, galleryImageNames, libraryId, provider])

  const markGalleryUrlAsFailed = React.useCallback((url: string) => {
    setFailedGalleryUrls((prev) => {
      if (prev.has(url)) return prev
      const next = new Set(prev)
      next.add(url)
      return next
    })
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const folderItemsCache = new Map<string, Awaited<ReturnType<NonNullable<typeof provider>['listItemsById']>>>()
    const folderItemsInFlight = new Map<string, Promise<Awaited<ReturnType<NonNullable<typeof provider>['listItemsById']>>>>()

    const isAbsoluteOrApiUrl = (value: string): boolean =>
      value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/api/storage/')

    async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await fetch(input, { ...init, signal: controller.signal })
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    function isSameEntries(a: ResolvedMediaEntry[], b: ResolvedMediaEntry[]): boolean {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i += 1) {
        if (a[i]?.name !== b[i]?.name) return false
        if ((a[i]?.url || '') !== (b[i]?.url || '')) return false
      }
      return true
    }

    async function resolveMediaName(name: string, candidateFolderIds: string[]): Promise<string | undefined> {
      if (isAbsoluteOrApiUrl(name)) return name
      if (!libraryId || !fileId) return undefined
      const dedupeKey = `${libraryId}|${fileId}|${currentFolderId || ''}|${candidateFolderIds.join(',')}|${name.toLowerCase()}`

      if (mediaResolvedUrlCacheRef.current.has(dedupeKey)) {
        return mediaResolvedUrlCacheRef.current.get(dedupeKey)
      }
      const existingInFlight = mediaResolveInFlightRef.current.get(dedupeKey)
      if (existingInFlight) {
        return await existingInFlight
      }

      const resolvePromise = (async (): Promise<string | undefined> => {
        // Primaer: ShadowTwinService-Resolver (storage-agnostisch)
        try {
          const res = await fetchWithTimeout(
            `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/resolve-binary-url`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({
                sourceId: fileId,
                sourceName: fileName || '',
                parentId: currentFolderId || '',
                fragmentName: name,
              }),
            },
            8000,
          )
          if (res.ok) {
            const json = await res.json() as { resolvedUrl?: string }
            if (json.resolvedUrl) return json.resolvedUrl
          }
        } catch {
          // Fallback unten
        }

        // Fallback: direkt im aktuellen Verzeichnis nach Dateiname suchen
        if (provider && candidateFolderIds.length > 0) {
          const loadFolderItems = async (folderId: string) => {
            if (folderItemsCache.has(folderId)) {
              return folderItemsCache.get(folderId) || []
            }
            const existingInFlight = folderItemsInFlight.get(folderId)
            if (existingInFlight) {
              return await existingInFlight
            }
            const loadPromise = provider.listItemsById(folderId)
            folderItemsInFlight.set(folderId, loadPromise)
            try {
              const items = await loadPromise
              folderItemsCache.set(folderId, items)
              return items
            } finally {
              folderItemsInFlight.delete(folderId)
            }
          }

          for (const folderId of candidateFolderIds) {
            try {
              const siblings = await loadFolderItems(folderId)
              const match = siblings.find((item) =>
                item.type === 'file' && item.metadata.name.toLowerCase() === name.toLowerCase(),
              )
              if (match) {
                return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(match.id)}`
              }
            } catch {
              // naechster Kandidat
            }
          }
        }
        return undefined
      })()

      mediaResolveInFlightRef.current.set(dedupeKey, resolvePromise)
      try {
        const resolved = await resolvePromise
        mediaResolvedUrlCacheRef.current.set(dedupeKey, resolved)
        return resolved
      } finally {
        mediaResolveInFlightRef.current.delete(dedupeKey)
      }
    }

    async function resolveAll() {
      if (lastResolvedSignatureRef.current === mediaResolveSignature) {
        return
      }
      const candidateFolderIds: string[] = []
      if (currentFolderId) candidateFolderIds.push(currentFolderId)
      if (provider && fileId) {
        try {
          const sourceItem = await provider.getItemById(fileId)
          if (sourceItem?.parentId && !candidateFolderIds.includes(sourceItem.parentId)) {
            candidateFolderIds.push(sourceItem.parentId)
          }
        } catch {
          // Fallback bleibt currentFolderId
        }
      }

      const attachmentEntries = await Promise.all(
        attachmentNames.map(async (name) => ({ name, url: await resolveMediaName(name, candidateFolderIds) })),
      )
      const galleryEntries = await Promise.all(
        galleryImageNames.map(async (name) => ({ name, url: await resolveMediaName(name, candidateFolderIds) })),
      )
      const coverImageUrlResolved = coverImageName ? await resolveMediaName(coverImageName, candidateFolderIds) : undefined
      if (cancelled) return
      setResolvedAttachments((prev) => (isSameEntries(prev, attachmentEntries) ? prev : attachmentEntries))
      setResolvedGalleryImages((prev) => (isSameEntries(prev, galleryEntries) ? prev : galleryEntries))
      setResolvedCoverImageUrl((prev) => (prev === coverImageUrlResolved ? prev : coverImageUrlResolved))
      lastResolvedSignatureRef.current = mediaResolveSignature
    }

    void resolveAll()
    return () => { cancelled = true }
    // attachmentNames, galleryImageNames, coverImageName + Sub-Felder sind
    // alle in mediaResolveSignature kodiert. Trotzdem muessen wir die
    // einzelnen Werte als Deps angeben, weil sie im Closure verwendet werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentNames, coverImageName, currentFolderId, fileId, fileName, galleryImageNames, libraryId, mediaResolveSignature, provider])

  return {
    attachmentNames,
    galleryImageNames,
    coverImageName,
    resolvedAttachments,
    resolvedGalleryImages,
    resolvedCoverImageUrl,
    unresolvedAttachmentNames,
    unresolvedGalleryImageNames,
    failedGalleryUrls,
    markGalleryUrlAsFailed,
  }
}
