/**
 * Hook zum Laden der Library-Chat-Konfiguration
 * 
 * Lädt die Chat-Konfiguration für eine Bibliothek und behandelt Fehler.
 * Wird sowohl im Chat als auch in der Gallery verwendet.
 */

import { useEffect, useState } from 'react'

interface ChatConfigResponse {
  library: { id: string; label: string }
  config: {
    placeholder?: string
    maxChars: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    targetLanguage?: string
    character?: string
    socialContext?: string
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: string
      character?: string
      socialContext?: string
      genderInclusive?: boolean
    }
  }
  vectorIndex: string
}

interface UseLibraryConfigResult {
  cfg: ChatConfigResponse | null
  loading: boolean
  error: string | null
}

/**
 * Hook zum Laden der Chat-Konfiguration einer Bibliothek
 * 
 * @param libraryId - Die ID der Bibliothek
 * @returns Konfiguration, Loading-Status und Fehler
 */
export function useLibraryConfig(libraryId: string): UseLibraryConfigResult {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`Fehler beim Laden der Chat-Konfiguration: ${res.statusText}`)
        }
        const data = (await res.json()) as ChatConfigResponse
        if (!cancelled) {
          setCfg(data)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [libraryId])

  return { cfg, loading, error }
}


