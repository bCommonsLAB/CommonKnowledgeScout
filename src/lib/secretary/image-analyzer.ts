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

/**
 * Ein einzelnes Bild fuer Multi-Image-Calls.
 * Im Multi-Pfad wird pro Bild ein `files`-Form-Feld gesetzt — die Reihenfolge
 * im Array ist semantisch relevant (Teil des Secretary-Cache-Keys).
 */
export interface ImageAnalyzerFile {
  file: Buffer | Blob
  fileName: string
  mimeType: string
}

export interface ImageAnalyzerTemplateParams {
  /** Basis-URL des Secretary Service (z.B. 'https://secretary.example.com') */
  baseUrl: string
  /** API-Key fuer Authentifizierung */
  apiKey: string
  /**
   * Single-Image-Pfad (Backwards-Compat): Wird als `file`-Form-Feld gesendet.
   * Entweder `file`+`fileName`+`mimeType` ODER `files` setzen.
   */
  file?: Buffer | Blob
  /** Dateiname des Single-Image-Pfads (z.B. '9106_1_basecolor.jpg') */
  fileName?: string
  /** MIME-Type des Single-Image-Pfads (z.B. 'image/jpeg') */
  mimeType?: string
  /**
   * Multi-Image-Pfad: Array von Bildern, jedes wird als separates `files`-Form-Feld
   * angehaengt. Der Secretary-Endpoint analysiert alle Bilder gemeinsam in EINEM
   * LLM-Call. Reihenfolge ist semantisch relevant und Teil des Cache-Keys.
   * Limit: 10 Bilder pro Request (siehe Secretary-Spec).
   * Multi-Image wird nur vom Provider `openrouter` unterstuetzt.
   */
  files?: ImageAnalyzerFile[]
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
  /**
   * Optionale Korrelations-Header fuer die Diagnose im Secretary-Service.
   *
   * Typischer Inhalt (vom Aufrufer gesetzt):
   *   - `X-Job-Id`           — eindeutige External-Job-ID (CKS)
   *   - `X-Source-Item-Id`   — itemId der Quelldatei (Composite-MD oder Bild)
   *   - `X-Worker-Pool-Id`   — App-/Worker-Pool (siehe `JOBS_WORKER_POOL_ID`)
   *   - `X-Start-Request-Id` — Request-ID des Worker→Start-Aufrufs
   *
   * Pflicht-Header (`Authorization`, `X-Secretary-Api-Key`, `Accept`) werden
   * danach gesetzt und ueberschreiben hier uebergebene gleichnamige Werte —
   * der Caller kann also die Auth-Header nicht versehentlich zerstoeren.
   */
  correlationHeaders?: Record<string, string>
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

  // Validierung: Genau einer der beiden Pfade muss gewaehlt sein.
  const hasSingle = p.file != null
  const hasMulti = Array.isArray(p.files) && p.files.length > 0
  if (!hasSingle && !hasMulti) {
    throw new Error('callImageAnalyzerTemplate: Weder file noch files gesetzt')
  }

  // Single-Image-Pfad (Backwards-Compat): genau ein `file`-Feld.
  if (hasSingle) {
    if (!p.fileName || !p.mimeType) {
      throw new Error('callImageAnalyzerTemplate: file ohne fileName/mimeType')
    }
    const blob = p.file instanceof Blob
      ? p.file
      : new Blob([p.file as Buffer], { type: p.mimeType })
    formData.append('file', blob, p.fileName)
  }

  // Multi-Image-Pfad: pro Bild ein `files`-Feld (repeatable, siehe
  // docs/_secretary-service-docu/image-analyzer.md). Reihenfolge des Arrays
  // wird 1:1 in die Reihenfolge der Form-Felder uebernommen.
  if (hasMulti) {
    for (const img of p.files!) {
      const blob = img.file instanceof Blob
        ? img.file
        : new Blob([img.file as Buffer], { type: img.mimeType })
      formData.append('files', blob, img.fileName)
    }
  }

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

  // Headers (kein Content-Type – wird von FormData automatisch mit boundary gesetzt).
  //
  // Reihenfolge ist sicherheitsrelevant:
  //   1. `correlationHeaders` zuerst (vom Caller, rein optional, fuer Diagnose),
  //   2. Pflicht-Header danach (Accept + Authorization), damit der Caller die
  //      Auth-Header NICHT versehentlich oder absichtlich ueberschreiben kann.
  const headers: Record<string, string> = {
    ...(p.correlationHeaders ?? {}),
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
