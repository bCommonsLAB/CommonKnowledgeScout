"use client"

import * as React from 'react'
import { useSessionHeaders } from '@/hooks/use-session-headers'

export function useLibraryRole(libraryId?: string) {
  const sessionHeaders = useSessionHeaders()
  const [isOwnerOrModerator, setIsOwnerOrModerator] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}/me/role`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? (sessionHeaders as Record<string, string>) : undefined,
        })
        const json = await res.json().catch(() => ({} as Record<string, unknown>))
        if (!res.ok) {
          const msg = typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`
          throw new Error(msg)
        }
        const value = typeof (json as { isOwnerOrModerator?: unknown }).isOwnerOrModerator === 'boolean'
          ? (json as { isOwnerOrModerator: boolean }).isOwnerOrModerator
          : false
        if (!cancelled) setIsOwnerOrModerator(value)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setIsOwnerOrModerator(false)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [libraryId, sessionHeaders])

  return { isOwnerOrModerator, isLoading, error }
}

