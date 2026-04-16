/**
 * @fileoverview Secretary Service Adapter – Image Analyzer
 *
 * Low-level Funktion fuer den Bild+Template-Endpoint des Secretary Service (Vision).
 * Sendet ein Bild (FormData) zusammen mit Template-Inhalt und Kontext.
 * Endpoint laut Doku: POST /api/image-analyzer/process (multipart).
 * Pfad-Override: SECRETARY_IMAGE_ANALYZER_PATH (Default: image-analyzer/process).
 *
 * @module secretary/image-analyzer
 */

import { fetchWithTimeout, HttpError, NetworkError, TimeoutError } from '@/lib/utils/fetch-with-timeout'
import { buildSecretaryServiceApiUrl, getSecretaryImageAnalyzerRelativePath } from '@/lib/env'

export interface ImageAnalyzerTemplateParams {
  /** Basis-URL des Secretary Service (z.B. 'https://secretary.example.com') */
  baseUrl: string
  /** API-Key fuer Authentifizierung */
  apiKey: string
  /** Bild-Binary als Buffer oder Blob */
  file: Buffer | Blob
  /** Dateiname des Bildes (z.B. '9106_1_basecolor.jpg') */
  fileName: string
  /** MIME-Type des Bildes (z.B. 'image/jpeg') */
  mimeType: string
  /** Template-Inhalt als YAML/Markdown-String */
  templateContent: string
  /** Zielsprache fuer die Analyse (z.B. 'de', 'en') */
  targetLanguage: string
  /** Zusaetzlicher Kontext als JSON (Dateiname, Pfad, etc.) */
  context?: Record<string, unknown>
  /** Extra-Feldbeschreibungen fuer das Template */
  additionalFieldDescriptions?: Record<string, string>
  /** LLM-Modell-Override (z.B. 'google/gemini-2.5-flash') */
  model?: string
  /** Provider-Override (z.B. 'openrouter') */
  provider?: string
  /** Cache nutzen (Default: true) */
  useCache?: boolean
  /** Timeout in Millisekunden */
  timeoutMs?: number
}

/**
 * Response-Format des Image-Analyzer-Endpoints.
 * Identisch zur TransformerResponse des /transformer/template Endpoints.
 */
export interface ImageAnalyzerResponse {
  status: 'success' | 'error'
  request?: {
    processor: string
    timestamp: string
    parameters: Record<string, unknown>
  }
  process?: {
    id: string
    main_processor: string
    llm_info?: Record<string, unknown>
  }
  data?: {
    /** Frontmatter-Markdown mit extrahierten Metadaten */
    text: string
    language: string
    format: string
    structured_data?: Record<string, unknown>
  }
  error?: string | { message: string; code?: string } | null
}

/**
 * Ruft POST /api/image-analyzer/process auf (Secretary Image Analyzer).
 *
 * Sendet multipart/form-data: file, template_content, target_language, optional context/model/provider/useCache.
 *
 * @param p Parameter fuer den Image-Analyzer-Call
 * @returns Response vom Secretary Service
 */
export async function callImageAnalyzerTemplate(p: ImageAnalyzerTemplateParams): Promise<Response> {
  // Template-Content bereinigen (creation-Block entfernen)
  let templateContent = p.templateContent
  if (templateContent) {
    const { serializeTemplateWithoutCreation } = await import('@/lib/templates/template-service')
    templateContent = serializeTemplateWithoutCreation(templateContent)
  }

  const rel = getSecretaryImageAnalyzerRelativePath()
  const url = buildSecretaryServiceApiUrl(p.baseUrl, rel)

  // FormData aufbauen (multipart/form-data fuer Binary-Upload)
  const formData = new FormData()

  // Bild als File-Blob hinzufuegen
  const blob = p.file instanceof Blob
    ? p.file
    : new Blob([p.file], { type: p.mimeType })
  formData.append('file', blob, p.fileName)

  // Template und Sprache
  formData.append('template_content', templateContent)
  formData.append('target_language', p.targetLanguage)

  // Optionale Felder
  if (p.context) {
    formData.append('context', JSON.stringify(p.context))
  }
  if (p.additionalFieldDescriptions) {
    formData.append('additional_field_descriptions', JSON.stringify(p.additionalFieldDescriptions))
  }
  if (p.model) {
    formData.append('model', p.model)
  }
  if (p.provider) {
    formData.append('provider', p.provider)
  }
  formData.append('useCache', String(p.useCache ?? true))

  // Headers (kein Content-Type – wird von FormData automatisch mit boundary gesetzt)
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (p.apiKey) {
    headers['Authorization'] = `Bearer ${p.apiKey}`
    headers['X-Secretary-Api-Key'] = p.apiKey
  }

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      body: formData as unknown as BodyInit,
      headers,
      timeoutMs: p.timeoutMs,
    })

    if (!res.ok) {
      let errorMessage: string | undefined
      let responseBody: unknown = undefined
      try {
        const errorData = await res.clone().json().catch(() => null)
        responseBody = errorData
        if (errorData && typeof errorData === 'object' && errorData !== null) {
          if ('error' in errorData && typeof errorData.error === 'object' && errorData.error !== null && 'message' in errorData.error) {
            errorMessage = String((errorData.error as { message?: unknown }).message)
          } else if ('error' in errorData) {
            errorMessage = String(errorData.error)
          } else if ('message' in errorData) {
            errorMessage = String(errorData.message)
          }
        }
      } catch {
        // Body nicht lesbar
      }
      // URL in die Meldung, damit 404 sofort dem falschen Pfad/Deploy zugeordnet werden kann.
      const hint404 =
        res.status === 404
          ? ` Nicht gefunden. Prüfen Sie SECRETARY_IMAGE_ANALYZER_PATH und ob der Secretary diese Route anbietet.`
          : ''
      throw new HttpError(
        res.status,
        res.statusText,
        `${errorMessage || `${res.status} ${res.statusText}`} — ${url}${hint404}`,
        responseBody
      )
    }

    return res
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e
    throw new NetworkError(e instanceof Error ? e.message : String(e))
  }
}
