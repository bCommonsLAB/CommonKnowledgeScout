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
  apiKey?: string;
  timeoutMs?: number;
}

export async function callTemplateTransform(p: TemplateTransformParams): Promise<Response> {
  const fd = new FormData();
  fd.append('text', p.text);
  fd.append('target_language', p.targetLanguage);
  fd.append('template_content', p.templateContent);
  fd.append('use_cache', 'false');
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (p.apiKey) { headers['Authorization'] = `Bearer ${p.apiKey}`; headers['X-Service-Token'] = p.apiKey; }
  try {
    const res = await fetchWithTimeout(p.url, { method: 'POST', body: fd as unknown as BodyInit, headers, timeoutMs: p.timeoutMs });
    if (!res.ok) throw new HttpError(res.status, res.statusText);
    return res;
  } catch (e) {
    if (e instanceof HttpError || e instanceof TimeoutError || e instanceof NetworkError) throw e;
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
}


