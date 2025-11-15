/**
 * Hook zum Laden der Library-Chat-Konfiguration
 * 
 * Lädt die Chat-Konfiguration für eine Bibliothek und behandelt Fehler.
 * Wird sowohl im Chat als auch in der Gallery verwendet.
 */

import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { librariesAtom } from '@/atoms/library-atom'
import { characterArrayToString } from '@/lib/chat/constants'

/**
 * Helper: Liest Locale aus Cookie (client-seitig)
 */
function getLocaleFromAtom(): string {
  if (typeof window === 'undefined') return 'en'
  try {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    return cookieValue || 'en'
  } catch {
    return 'en'
  }
}

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
 * Prüft zuerst den Jotai State, dann API-Call als Fallback
 * 
 * @param libraryId - Die ID der Bibliothek
 * @returns Konfiguration, Loading-Status und Fehler
 */
export function useLibraryConfig(libraryId: string): UseLibraryConfigResult {
  const libraries = useAtomValue(librariesAtom)
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      
      // Prüfe zuerst im State
      const libraryFromState = libraries.find(lib => lib.id === libraryId)
      if (libraryFromState?.config?.chat) {
        // Konvertiere zu ChatConfigResponse Format
        const configFromState: ChatConfigResponse = {
          library: { 
            id: libraryFromState.id, 
            label: libraryFromState.label 
          },
          config: {
            placeholder: libraryFromState.config.chat?.placeholder,
            maxChars: libraryFromState.config.chat?.maxChars || 2000,
            maxCharsWarningMessage: libraryFromState.config.chat?.maxCharsWarningMessage,
            footerText: libraryFromState.config.chat?.footerText,
            companyLink: libraryFromState.config.chat?.companyLink,
            targetLanguage: libraryFromState.config.chat?.targetLanguage,
            // Konvertiere character Array zu String (mit Komma verbunden)
            character: characterArrayToString(libraryFromState.config.chat?.character),
            socialContext: libraryFromState.config.chat?.socialContext,
            genderInclusive: libraryFromState.config.chat?.genderInclusive,
            // Konvertiere userPreferences.character Array zu String
            userPreferences: libraryFromState.config.chat?.userPreferences 
              ? {
                  ...libraryFromState.config.chat.userPreferences,
                  character: characterArrayToString(libraryFromState.config.chat.userPreferences.character),
                }
              : undefined,
          },
          vectorIndex: '', // Wird nicht benötigt für Client
        }
        if (!cancelled) {
          setCfg(configFromState)
          setLoading(false)
        }
        return
      }

      // Fallback: API-Call für nicht-öffentliche Libraries oder wenn nicht im State
      try {
        const locale = getLocaleFromAtom()
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, {
          cache: 'no-store',
          headers: {
            'Accept-Language': locale,
          },
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
  }, [libraryId, libraries])

  return { cfg, loading, error }
}




