'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLibraryRole } from './use-library-role'
import type {
  SourceComment,
  SourceCommentThreadResponse,
} from '@/types/source-comment'

interface UseSourceCommentsResult {
  comments: SourceComment[]
  /** true wenn der Server den Thread auf "nur eigene" Kommentare reduziert hat. */
  filteredToOwn: boolean
  isLoading: boolean
  error: string | null
  /** Laedt den Thread vom Server neu. */
  refresh: () => Promise<void>
  /** Erstellt einen Kommentar und ergaenzt ihn lokal. */
  addComment: (body: string) => Promise<void>
  /** Editiert einen Kommentar (Author-only; Server prueft). */
  editComment: (commentId: string, body: string) => Promise<void>
  /** Soft-Loescht einen Kommentar (Author oder Member; Server prueft). */
  removeComment: (commentId: string) => Promise<void>
}

/**
 * Lade- und Mutations-Hook fuer den Kommentar-Thread einer Quelle.
 * Sichtbarkeitsfilter wird serverseitig durchgesetzt; der Hook reicht
 * lediglich `filteredToOwn` ans UI weiter, damit ein Hinweis-Banner
 * fuer Gaeste angezeigt werden kann.
 */
export function useSourceComments(
  libraryId: string | undefined,
  fileId: string | undefined,
  options: { enabled?: boolean } = {},
): UseSourceCommentsResult {
  const { isSignedIn, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  const enabled = options.enabled !== false
  const [comments, setComments] = useState<SourceComment[]>([])
  const [filteredToOwn, setFilteredToOwn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!libraryId || !fileId || !isSignedIn) {
      setComments([])
      setFilteredToOwn(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const url = `/api/library/${encodeURIComponent(libraryId)}/source-comments?fileId=${encodeURIComponent(fileId)}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Kommentare konnten nicht geladen werden (HTTP ${res.status})`)
      }
      const json = (await res.json()) as SourceCommentThreadResponse
      setComments(json.comments ?? [])
      setFilteredToOwn(Boolean(json.filteredToOwn))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
      console.warn('[useSourceComments] Laden fehlgeschlagen:', message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [libraryId, fileId, isSignedIn])

  useEffect(() => {
    if (isRoleLoading) return
    if (!enabled) return
    void refresh()
  }, [refresh, enabled, isRoleLoading])

  const addComment = useCallback(
    async (body: string) => {
      if (!libraryId || !fileId || !isSignedIn) return
      const trimmed = body.trim()
      if (!trimmed) return

      setError(null)
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-comments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, body: trimmed }),
          },
        )
        if (!res.ok) {
          throw new Error(`Kommentar konnte nicht gespeichert werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as { comment: SourceComment }
        setComments((prev) => [...prev, json.comment])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceComments] Erstellen fehlgeschlagen:', message)
        setError(message)
        throw err
      }
    },
    [libraryId, fileId, isSignedIn],
  )

  const editComment = useCallback(
    async (commentId: string, body: string) => {
      if (!libraryId || !commentId) return
      const trimmed = body.trim()
      if (!trimmed) return

      setError(null)
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-comments/${encodeURIComponent(commentId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: trimmed }),
          },
        )
        if (!res.ok) {
          throw new Error(`Edit fehlgeschlagen (HTTP ${res.status})`)
        }
        const json = (await res.json()) as { comment: SourceComment }
        setComments((prev) =>
          prev.map((c) => (c.id === json.comment.id ? json.comment : c)),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceComments] Edit fehlgeschlagen:', message)
        setError(message)
        throw err
      }
    },
    [libraryId],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!libraryId || !commentId) return

      setError(null)
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-comments/${encodeURIComponent(commentId)}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          throw new Error(`Loeschen fehlgeschlagen (HTTP ${res.status})`)
        }
        const json = (await res.json()) as { comment: SourceComment }
        setComments((prev) =>
          prev.map((c) => (c.id === json.comment.id ? json.comment : c)),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceComments] Loeschen fehlgeschlagen:', message)
        setError(message)
        throw err
      }
    },
    [libraryId],
  )

  return {
    comments,
    filteredToOwn,
    isLoading,
    error,
    refresh,
    addComment,
    editComment,
    removeComment,
  }
}
