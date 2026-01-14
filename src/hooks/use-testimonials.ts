"use client"

import * as React from "react"
import type { TestimonialItem } from "@/components/shared/testimonial-list"

/**
 * Hook zum Laden von Testimonials für ein Event.
 * 
 * Verwendet die `/api/public/testimonials` API und normalisiert die Daten
 * zu einer einheitlichen Struktur.
 */
export function useTestimonials(args: {
  libraryId: string | undefined
  eventFileId: string | undefined
  writeKey?: string
  enabled?: boolean
}) {
  const { libraryId, eventFileId, writeKey, enabled = true } = args
  
  const [items, setItems] = React.useState<TestimonialItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadTestimonials = React.useCallback(async () => {
    if (!enabled) return
    if (!libraryId || !eventFileId) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const qp = new URLSearchParams()
      qp.set('libraryId', libraryId)
      qp.set('eventFileId', eventFileId)
      if (writeKey) qp.set('writeKey', writeKey)

      const res = await fetch(`/api/public/testimonials?${qp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown })?.error === 'string'
            ? String((json as { error: string }).error)
            : `HTTP ${res.status}`
        throw new Error(msg)
      }

      const apiItems = Array.isArray((json as { items?: unknown }).items) 
        ? ((json as { items: unknown[] }).items as unknown[]) 
        : []
      
      const mapped: TestimonialItem[] = apiItems
        .map((it) => (it && typeof it === 'object') ? (it as Record<string, unknown>) : null)
        .filter((it): it is Record<string, unknown> => !!it)
        .map((it) => {
          const testimonialId = typeof it.testimonialId === 'string' ? it.testimonialId : 'unknown'
          const folderId = typeof it.folderId === 'string' ? it.folderId : undefined

          const metaObj = it.meta && typeof it.meta === 'object' 
            ? (it.meta as Record<string, unknown>) 
            : null
          
          const createdAt = typeof metaObj?.createdAt === 'string' ? metaObj.createdAt : null
          const speakerName = typeof metaObj?.speakerName === 'string' ? metaObj.speakerName : null
          const text = typeof metaObj?.text === 'string' ? metaObj.text : null

          const audioObj = it.audio && typeof it.audio === 'object' 
            ? (it.audio as Record<string, unknown>) 
            : null
          const audioFileName = typeof audioObj?.fileName === 'string' ? audioObj.fileName : null
          const hasAudio = !!audioObj

          return {
            testimonialId,
            folderId,
            createdAt,
            speakerName,
            text,
            hasAudio,
            audioFileName,
          }
        })

      setItems(mapped)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, libraryId, eventFileId, writeKey])

  React.useEffect(() => {
    void loadTestimonials()
  }, [loadTestimonials])

  return {
    items,
    isLoading,
    error,
    reload: loadTestimonials,
  }
}
