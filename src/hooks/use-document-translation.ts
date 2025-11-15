/**
 * Hook für Dokumentübersetzung
 * 
 * Verwaltet das Laden von übersetzten Dokumentdaten (BookDetailData oder SessionDetailData).
 * Nutzt den API-Endpunkt für Übersetzung mit serverseitigem Caching.
 * 
 * Pattern analog zu useStoryTopicsCache: Hook ruft nur API auf, keine eigene Cache-Logik.
 */

import { useState, useCallback } from 'react'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { TargetLanguage } from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useSessionHeaders } from './use-session-headers'

interface TranslateDocumentParams {
  libraryId: string
  fileId: string
  viewType: 'book' | 'session'
  targetLanguage?: TargetLanguage
}

interface TranslationResult {
  translatedData: BookDetailData | SessionDetailData
  cached: boolean
}

/**
 * Hook für Dokumentübersetzung
 * 
 * @returns Funktion zum Übersetzen eines Dokuments
 */
export function useDocumentTranslation() {
  const { locale } = useTranslation()
  const sessionHeaders = useSessionHeaders()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translateDocument = useCallback(
    async (params: TranslateDocumentParams): Promise<TranslationResult | null> => {
      const { libraryId, fileId, viewType, targetLanguage } = params

      console.log('[useDocumentTranslation] Starte Übersetzung:', {
        libraryId,
        fileId,
        viewType,
        targetLanguage,
        locale,
        sessionHeadersKeys: Object.keys(sessionHeaders),
      })

      setLoading(true)
      setError(null)

      try {
        // Bestimme Zielsprache: Parameter > UI-Sprache > Default
        const localeToTargetMap: Record<string, TargetLanguage> = {
          de: 'de',
          en: 'en',
          it: 'it',
          fr: 'fr',
          es: 'es',
          ar: 'ar',
        }
        const effectiveTargetLanguage = targetLanguage || localeToTargetMap[locale] || 'de'
        
        console.log('[useDocumentTranslation] Zielsprache bestimmt:', {
          requested: targetLanguage,
          locale,
          effective: effectiveTargetLanguage,
        })

        const requestBody = {
          fileId,
          viewType,
          targetLanguage: effectiveTargetLanguage,
        }
        console.log('[useDocumentTranslation] Request Body:', requestBody)

        const response = await fetch(
          `/api/chat/${encodeURIComponent(libraryId)}/translate-document`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...sessionHeaders,
            },
            body: JSON.stringify(requestBody),
          }
        )

        console.log('[useDocumentTranslation] Response Status:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        })

        if (!response.ok) {
          let errorText = ''
          let errorData: { error?: string } = {}
          
          try {
            // Prüfe ob Body bereits konsumiert wurde
            const bodyUsed = response.bodyUsed
            console.log('[useDocumentTranslation] Response Body Status:', {
              bodyUsed,
              contentType: response.headers.get('content-type'),
            })
            
            if (!bodyUsed) {
              errorText = await response.text()
              console.log('[useDocumentTranslation] Error Response Text:', {
                length: errorText.length,
                isEmpty: errorText.trim().length === 0,
                preview: errorText.substring(0, 500),
              })
            } else {
              console.warn('[useDocumentTranslation] Response Body bereits konsumiert!')
              errorText = ''
            }
            
            if (errorText && errorText.trim()) {
              try {
                errorData = JSON.parse(errorText)
                console.log('[useDocumentTranslation] Error Data geparst:', errorData)
              } catch (parseError) {
                console.warn('[useDocumentTranslation] Fehler beim JSON-Parsen:', parseError)
                // Wenn kein JSON, verwende Text als Fehlermeldung
                errorData = { error: errorText }
              }
            } else {
              errorData = { error: `HTTP ${response.status} ${response.statusText || 'Unknown Error'}` }
            }
          } catch (readError) {
            console.error('[useDocumentTranslation] Fehler beim Lesen der Error-Response:', {
              error: readError,
              message: readError instanceof Error ? readError.message : String(readError),
            })
            errorData = { error: `HTTP ${response.status} ${response.statusText || 'Unknown Error'}` }
          }
          
          const errorMessage = errorData.error || `HTTP ${response.status}: ${errorText || response.statusText || 'Unknown Error'}`
          
          console.error('[useDocumentTranslation] API Fehler:', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500),
            errorData,
            errorMessage,
            errorDataStringified: JSON.stringify(errorData, null, 2),
          })
          
          throw new Error(errorMessage)
        }

        // Prüfe Content-Type
        const contentType = response.headers.get('content-type') || ''
        console.log('[useDocumentTranslation] Response Content-Type:', contentType)
        
        // Parse JSON-Response
        let data: TranslationResult
        try {
          data = (await response.json()) as TranslationResult
        } catch (parseError) {
          // Falls JSON-Parsing fehlschlägt, versuche Text zu lesen für besseres Error-Logging
          const responseText = await response.text().catch(() => '')
          console.error('[useDocumentTranslation] JSON Parse Fehler:', {
            error: parseError,
            responseText: responseText.substring(0, 500),
            contentType,
          })
          throw new Error(`Ungültige JSON-Response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
        }
        
        console.log('[useDocumentTranslation] ✅ Übersetzung erfolgreich:', {
          cached: data.cached,
          hasTranslatedData: !!data.translatedData,
          translatedDataKeys: data.translatedData && typeof data.translatedData === 'object' 
            ? Object.keys(data.translatedData).slice(0, 10) 
            : [],
          translatedDataType: typeof data.translatedData,
        })
        
        // Validiere Response-Struktur
        if (!data.translatedData) {
          console.error('[useDocumentTranslation] ⚠️ Response enthält kein translatedData:', {
            data,
            dataKeys: Object.keys(data),
          })
          throw new Error('Response enthält kein translatedData')
        }
        
        return data
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'
        const errorStack = err instanceof Error ? err.stack : undefined
        setError(errorMessage)
        console.error('[useDocumentTranslation] ❌ Fehler:', {
          errorMessage,
          errorStack: errorStack?.substring(0, 500),
          errorType: err?.constructor?.name,
          errorString: String(err),
          errorObject: err,
        })
        return null
      } finally {
        setLoading(false)
      }
    },
    [locale, sessionHeaders]
  )

  return { translateDocument, loading, error }
}

