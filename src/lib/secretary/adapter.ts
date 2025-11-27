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
 * - callTemplateTransform: Calls template transformation endpoint
 * - PdfProcessParams: Parameters interface for PDF processing
 * - TemplateTransformParams: Parameters interface for template transformation
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
  // JSON-Body erstellen (statt FormData für große Payloads)
  const body = {
    text: p.text,
    template_content: p.templateContent,
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
    if (!res.ok) throw new HttpError(res.status, res.statusText)
    return res
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e
    throw new NetworkError(e instanceof Error ? e.message : String(e))
  }
}


