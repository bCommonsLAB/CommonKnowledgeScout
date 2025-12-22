/**
 * @fileoverview Secretary Service Adapter - Low-level API Call Functions
 * 
 * @description
 * Low-level adapter functions for calling Secretary Service API endpoints. Provides
 * wrapper functions for PDF processing and template transformation with timeout
 * handling, authentication, and error management. Used by SecretaryServiceClient
 * for actual HTTP requests.
 * 
 * @module secretary
 * 
 * @exports
 * - callPdfProcess: Calls PDF processing endpoint
 * - callTemplateTransform: Calls template transformation endpoint (text-based)
 * - callTextTranslate: Calls text translation endpoint
 * - callTransformerChat: Calls LLM broker chat endpoint
 * - callTemplateExtractFromUrl: Calls template transformation endpoint (URL-based extraction)
 * - PdfProcessParams: Parameters interface for PDF processing
 * - TemplateTransformParams: Parameters interface for template transformation
 * - TextTranslateParams: Parameters interface for text translation
 * - TransformerChatParams: Parameters interface for LLM broker chat
 * - TemplateExtractFromUrlParams: Parameters interface for URL-based template extraction
 * 
 * @usedIn
 * - src/lib/secretary/client.ts: Client uses adapter functions
 * - src/lib/external-jobs/template-run.ts: Template runner uses adapter
 * 
 * @dependencies
 * - @/lib/utils/fetch-with-timeout: Timeout-aware fetch utility with error types
 */

import { fetchWithTimeout, HttpError, NetworkError, TimeoutError } from '@/lib/utils/fetch-with-timeout';

export interface PdfProcessParams {
  url: string;
  formData: FormData;
  apiKey?: string;
  timeoutMs?: number;
}

export async function callPdfProcess(params: PdfProcessParams): Promise<Response> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (params.apiKey) { headers['Authorization'] = `Bearer ${params.apiKey}`; headers['X-Service-Token'] = params.apiKey; }
  try {
    const res = await fetchWithTimeout(params.url, { method: 'POST', body: params.formData as unknown as BodyInit, headers, timeoutMs: params.timeoutMs });
    if (!res.ok) throw new HttpError(res.status, res.statusText);
    return res;
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e;
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
}

export interface TemplateTransformParams {
  url: string;
  text: string;
  targetLanguage: string;
  templateContent: string;
  sourceLanguage?: string;
  context?: Record<string, unknown>;
  additionalFieldDescriptions?: Record<string, string>;
  useCache?: boolean;
  callbackUrl?: string | null;
  callbackToken?: string | null;
  jobId?: string;
  waitMs?: number;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Ruft den Template-Transform-Endpoint des Secretary Services auf.
 * 
 * WICHTIG: Verwendet JSON statt FormData für große Payloads.
 * 
 * @param p Template-Transform-Parameter
 * @returns Response vom Secretary Service
 */
export async function callTemplateTransform(p: TemplateTransformParams): Promise<Response> {
  // Entferne creation-Block aus template_content, falls vorhanden
  // (Secretary Service unterstützt nur flaches YAML)
  let templateContent = p.templateContent
  if (templateContent) {
    const { serializeTemplateWithoutCreation } = await import('@/lib/templates/template-service')
    templateContent = serializeTemplateWithoutCreation(templateContent)
  }
  
  // JSON-Body erstellen (statt FormData für große Payloads)
  const body = {
    text: p.text,
    template_content: templateContent,
    source_language: p.sourceLanguage || p.targetLanguage, // Fallback auf targetLanguage wenn nicht gesetzt
    target_language: p.targetLanguage,
    context: p.context || {},
    additional_field_descriptions: p.additionalFieldDescriptions || {},
    use_cache: p.useCache ?? false,
    callback_url: p.callbackUrl ?? null,
    callback_token: p.callbackToken ?? null,
    jobId: p.jobId || undefined,
    wait_ms: p.waitMs ?? 0
  }
  
  const headers: Record<string, string> = { 
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  if (p.apiKey) { 
    headers['Authorization'] = `Bearer ${p.apiKey}`
    headers['X-Service-Token'] = p.apiKey
  }
  
  try {
    const res = await fetchWithTimeout(
      p.url, 
      { 
        method: 'POST', 
        body: JSON.stringify(body), 
        headers, 
        timeoutMs: p.timeoutMs 
      }
    )
    // WICHTIG: Bei HTTP-Fehlern (z.B. 400) den Body lesen, bevor wir den Fehler werfen,
    // damit der Caller die detaillierte Fehlermeldung aus der Response extrahieren kann
    if (!res.ok) {
      // Versuche, Response-Body zu lesen (kann bei manchen Fehlern leer sein)
      let errorMessage: string | undefined
      let responseBody: unknown = undefined
      try {
        const errorData = await res.clone().json().catch(() => null)
        responseBody = errorData
        if (errorData && typeof errorData === 'object' && errorData !== null) {
          // Versuche verschiedene Fehlerfelder zu finden (Secretary Service Format)
          // Format: { status: "error", error: { message: "..." } }
          if ('error' in errorData && typeof errorData.error === 'object' && errorData.error !== null && 'message' in errorData.error) {
            errorMessage = String((errorData.error as { message?: unknown }).message)
          } else if ('error' in errorData) {
            errorMessage = String(errorData.error)
          } else if ('message' in errorData) {
            errorMessage = String(errorData.message)
          }
        }
      } catch {
        // Body konnte nicht gelesen werden, verwende Standard-Fehlermeldung
      }
      throw new HttpError(res.status, res.statusText, errorMessage, responseBody)
    }
    return res
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e
    throw new NetworkError(e instanceof Error ? e.message : String(e))
  }
}

export interface TextTranslateParams {
  url: string; // URL des Transformer-Endpoints (z.B. `${baseUrl}/transformer/text`)
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  useCache?: boolean;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Ruft den Text-Translate-Endpoint des Secretary Services auf.
 * 
 * @param p Text-Translate-Parameter
 * @returns Response vom Secretary Service
 */
export async function callTextTranslate(p: TextTranslateParams): Promise<Response> {
  const body = {
    text: p.text,
    source_language: p.sourceLanguage || p.targetLanguage, // Fallback auf targetLanguage wenn nicht gesetzt
    target_language: p.targetLanguage,
    use_cache: p.useCache ?? false,
  }
  
  const headers: Record<string, string> = { 
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  if (p.apiKey) { 
    headers['Authorization'] = `Bearer ${p.apiKey}`
    headers['X-Service-Token'] = p.apiKey
  }
  
  try {
    const res = await fetchWithTimeout(
      p.url, 
      { 
        method: 'POST', 
        body: JSON.stringify(body), 
        headers, 
        timeoutMs: p.timeoutMs 
      }
    )
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
        // Body konnte nicht gelesen werden
      }
      throw new HttpError(res.status, res.statusText, errorMessage, responseBody)
    }
    return res
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e
    throw new NetworkError(e instanceof Error ? e.message : String(e))
  }
}

export interface TransformerChatParams {
  url: string; // URL des Chat-Endpoints (z.B. `${baseUrl}/api/transformer/chat`)
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  schemaJson?: string; // JSON Schema as string (Draft-07)
  schemaId?: string; // Server-known schema identifier
  strict?: boolean; // Schema validation strictness (default: true when structured)
  useCache?: boolean;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Ruft den LLM Broker Chat-Endpoint des Secretary Services auf.
 * 
 * Verwendet application/x-www-form-urlencoded für Request-Body.
 * 
 * @param p Chat-Parameter
 * @returns Response vom Secretary Service
 */
export async function callTransformerChat(p: TransformerChatParams): Promise<Response> {
  const formData = new URLSearchParams()
  formData.append('messages', JSON.stringify(p.messages))
  
  if (p.model) formData.append('model', p.model)
  if (p.provider) formData.append('provider', p.provider)
  if (p.temperature !== undefined) formData.append('temperature', String(p.temperature))
  if (p.maxTokens !== undefined) formData.append('max_tokens', String(p.maxTokens))
  if (p.responseFormat) formData.append('response_format', p.responseFormat)
  if (p.schemaJson) formData.append('schema_json', p.schemaJson)
  if (p.schemaId) formData.append('schema_id', p.schemaId)
  if (p.strict !== undefined) formData.append('strict', String(p.strict))
  formData.append('use_cache', String(p.useCache ?? true))
  if (p.timeoutMs !== undefined) formData.append('timeout_ms', String(p.timeoutMs))
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  
  if (p.apiKey) {
    headers['Authorization'] = `Bearer ${p.apiKey}`
    headers['X-Secretary-Api-Key'] = p.apiKey
  }
  
  try {
    const res = await fetchWithTimeout(
      p.url,
      {
        method: 'POST',
        body: formData.toString(),
        headers,
        timeoutMs: p.timeoutMs
      }
    )
    
    // Bei HTTP-Fehlern Response-Body lesen für detaillierte Fehlermeldung
    if (!res.ok) {
      let errorMessage: string | undefined
      let responseBody: unknown = undefined
      try {
        const errorData = await res.clone().json().catch(() => null)
        responseBody = errorData
        if (errorData && typeof errorData === 'object' && errorData !== null) {
          if ('error' in errorData && typeof errorData.error === 'object' && errorData.error !== null) {
            const err = errorData.error as { code?: unknown; message?: unknown }
            if ('message' in err) {
              errorMessage = String(err.message)
            } else if ('code' in err) {
              errorMessage = String(err.code)
            }
          } else if ('error' in errorData) {
            errorMessage = String(errorData.error)
          } else if ('message' in errorData) {
            errorMessage = String(errorData.message)
          }
        }
      } catch {
        // Body konnte nicht gelesen werden - versuche als Text
        try {
          const errorText = await res.clone().text()
          if (errorText) {
            errorMessage = errorText.slice(0, 500)
          }
        } catch {
          // Kein Body verfügbar
        }
      }
      
      // Erweiterte Fehlermeldung mit URL-Info für Debugging
      const enhancedMessage = errorMessage 
        ? `${res.status} ${res.statusText}: ${errorMessage}`
        : `${res.status} ${res.statusText}`
      
      throw new HttpError(res.status, res.statusText, enhancedMessage, responseBody)
    }
    
    return res
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e
    throw new NetworkError(e instanceof Error ? e.message : String(e))
  }
}

export interface TemplateExtractFromUrlParams {
  url: string;
  templateUrl: string; // URL des Template-Endpoints (z.B. `${baseUrl}/transformer/template`)
  template?: string;
  /** Optional: komplettes Template als YAML/Markdown (MongoDB TemplateDocument serialisiert). */
  templateContent?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  useCache?: boolean;
  containerSelector?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Ruft den Template-Transform-Endpoint des Secretary Services auf, um Daten von einer URL zu extrahieren.
 * 
 * Verwendet FormData (URLSearchParams) für URL-basierte Extraktion.
 * 
 * @param p Template-Extract-Parameter
 * @returns Response vom Secretary Service
 */
export async function callTemplateExtractFromUrl(p: TemplateExtractFromUrlParams): Promise<Response> {
  // URL-Validierung
  try {
    new URL(p.url);
  } catch {
    throw new HttpError(400, 'Ungültiges URL-Format')
  }
  
  // Form-Data für den Secretary Service erstellen
  const formData = new URLSearchParams();
  formData.append('url', p.url);
  formData.append('source_language', p.sourceLanguage || 'en');
  formData.append('target_language', p.targetLanguage || 'en');
  if (p.templateContent && p.templateContent.trim()) {
    // Entferne creation-Block aus template_content, falls vorhanden
    // (Secretary Service unterstützt nur flaches YAML)
    let templateContent = p.templateContent
    if (templateContent) {
      const { serializeTemplateWithoutCreation } = await import('@/lib/templates/template-service')
      templateContent = serializeTemplateWithoutCreation(templateContent)
    }
    formData.append('template_content', templateContent);
  } else {
    formData.append('template', p.template || 'ExtractSessionDataFromWebsite');
  }
  formData.append('use_cache', String(p.useCache ?? false));
  
  // Container-Selector optional hinzufügen
  if (p.containerSelector && p.containerSelector.trim().length > 0) {
    formData.append('container_selector', p.containerSelector.trim());
  }
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  
  if (p.apiKey) {
    headers['Authorization'] = `Bearer ${p.apiKey}`;
    headers['X-Service-Token'] = p.apiKey;
  }
  
  try {
    const res = await fetchWithTimeout(
      p.templateUrl,
      {
        method: 'POST',
        body: formData.toString(),
        headers,
        timeoutMs: p.timeoutMs
      }
    );
    if (!res.ok) throw new HttpError(res.status, res.statusText);
    return res;
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e;
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
}


