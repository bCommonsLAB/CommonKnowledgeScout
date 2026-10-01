/**
 * Doc-Meta der Detailansicht laden (D6b aus `detail-overlay.tsx` gezogen,
 * Verhalten 1:1): Beim Oeffnen und bei Doc- oder Locale-Wechsel wird
 * `/doc-meta` ueber die Instanz geholt und `docMetaJson` VOR dem Mapping
 * des Renderers mit der aktiven Locale veredelt (`localizeDocMetaJson`,
 * Fallback `<fallbackLocale>` und Original). So bleiben die Mapper
 * sprachneutral.
 */

import { useEffect, useState } from 'react'
import type { DetailViewType } from '@ks/contracts'
import type { InstanceApi } from '@ks/api-client'
import { localizeDocMetaJson } from '../../../doc-meta/get-localized'

export interface UseDocMetaParams {
  open: boolean
  libraryId: string
  fileId: string
  viewType: DetailViewType
  locale: string
  fallbackLocale?: string
  instanz: InstanceApi
}

export interface UseDocMetaResult {
  docMeta: Record<string, unknown> | null
  isDocMetaReady: boolean
  /** URL fuer Sessions („Original"-Link oben rechts); sonst `null`. */
  sessionUrl: string | null
  /** Lokalisiertes `docMetaJson` fuer das generische SDG-Profil. */
  sdgDocMeta: Record<string, unknown> | null
}

export function useDocMeta({ open, libraryId, fileId, viewType, locale, fallbackLocale, instanz }: UseDocMetaParams): UseDocMetaResult {
  const [docMeta, setDocMeta] = useState<Record<string, unknown> | null>(null)
  const [isDocMetaReady, setIsDocMetaReady] = useState(false)
  const [sessionUrl, setSessionUrl] = useState<string | null>(null)
  const [sdgDocMeta, setSdgDocMeta] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!open) {
      setDocMeta(null)
      setIsDocMetaReady(false)
      setSessionUrl(null)
      setSdgDocMeta(null)
      return
    }

    setDocMeta(null)
    setIsDocMetaReady(false)
    setSdgDocMeta(null)

    const loadDocMeta = async () => {
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        // Keine eigene `x-locale`-Kopfzeile: Die Middleware setzt sie aus Cookie
        // bzw. `Accept-Language` selbst und ueberschreibt, was der Client schickt.
        // Von einer fremden Seite (Embed) kostete sie nur einen Preflight (Audit 03).
        const res = await instanz.fetch(url, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.docMetaJson) return

        const docMetaJson = json.docMetaJson as Record<string, unknown>
        const localized = localizeDocMetaJson(docMetaJson, locale, fallbackLocale)
        setDocMeta({ ...(json as Record<string, unknown>), docMetaJson: localized })
        setSdgDocMeta(localized as Record<string, unknown>)

        if (viewType === 'session' && typeof docMetaJson.url === 'string') {
          setSessionUrl(docMetaJson.url)
        }
      } catch (err) {
        console.error('[DetailOverlay] Fehler beim Laden der Doc-Meta:', err)
      } finally {
        setIsDocMetaReady(true)
      }
    }

    void loadDocMeta()
  }, [open, libraryId, fileId, viewType, locale, fallbackLocale, instanz])

  return { docMeta, isDocMetaReady, sessionUrl, sdgDocMeta }
}
