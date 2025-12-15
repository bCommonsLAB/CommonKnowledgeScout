import { getSecretaryConfig } from '@/lib/env'
import { NextRequest, NextResponse } from 'next/server';
import { callTemplateExtractFromUrl } from '@/lib/secretary/adapter';
import { HttpError, NetworkError, TimeoutError } from '@/lib/utils/fetch-with-timeout';
import { getAuth, currentUser } from '@clerk/nextjs/server'

/**
 * POST /api/secretary/import-from-url
 * Proxy-Endpunkt zum Secretary Service für Session-Import aus URLs
 * 
 * Verwendet die zentrale callTemplateExtractFromUrl-Funktion aus dem Adapter.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, source_language, target_language, template, use_cache, container_selector, templateId, libraryId } = body as {
      url?: string
      source_language?: string
      target_language?: string
      template?: string
      use_cache?: boolean
      container_selector?: string
      templateId?: string
      libraryId?: string
    };
    
    // Validierung der Eingabedaten
    if (!url) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: 'MISSING_URL', 
            message: 'URL ist erforderlich' 
          } 
        },
        { status: 400 }
      );
    }
    
    // Secretary Service URL strikt aus Env
    const { baseUrl, apiKey } = getSecretaryConfig();
    const apiUrl = `${baseUrl}/transformer/template`;

    // Optional: Template aus MongoDB laden und als template_content übergeben.
    // Dadurch ist der Endpoint generisch für alle Vorlagen im Wizard.
    let templateContent: string | undefined = undefined
    if (templateId && libraryId) {
      const { userId } = getAuth(request)
      if (!userId) {
        return NextResponse.json(
          { status: 'error', error: { code: 'UNAUTHENTICATED', message: 'Nicht authentifiziert' } },
          { status: 401 }
        )
      }

      const user = await currentUser()
      const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) {
        return NextResponse.json(
          { status: 'error', error: { code: 'UNAUTHENTICATED', message: 'Keine E-Mail-Adresse gefunden' } },
          { status: 401 }
        )
      }

      const { loadTemplateFromMongoDB, serializeTemplateToMarkdown } = await import('@/lib/templates/template-service-mongodb')
      // TODO: Admin-Check implementieren
      const isAdmin = false
      const tpl = await loadTemplateFromMongoDB(templateId, libraryId, userEmail, isAdmin)
      if (!tpl) {
        return NextResponse.json(
          { status: 'error', error: { code: 'TEMPLATE_NOT_FOUND', message: `Template "${templateId}" nicht gefunden` } },
          { status: 404 }
        )
      }

      // Serialisiere Template zu Markdown für Secretary (ohne creation-Block)
      templateContent = serializeTemplateToMarkdown(tpl, false)
    }
    
    // Zentrale Adapter-Funktion verwenden (enthält URL-Validierung, FormData-Erstellung, Auth-Header)
    const secretaryResponse = await callTemplateExtractFromUrl({
      url,
      templateUrl: apiUrl,
      template: template || 'ExtractSessionDataFromWebsite',
      templateContent,
      sourceLanguage: source_language || 'en',
      targetLanguage: target_language || 'en',
      useCache: use_cache ?? false,
      containerSelector: container_selector,
      apiKey,
      timeoutMs: 300000 // 5 Minuten Timeout
    });

    const secretaryData = await secretaryResponse.json();
    
    // Antwort-Format für den Client anpassen
    const responseData = {
      status: 'success',
      data: secretaryData.data || secretaryData,
      metadata: {
        url,
        extracted_at: new Date().toISOString(),
        template_used: templateContent ? `template_content(${templateId})` : (template || 'ExtractSessionDataFromWebsite')
      }
    };
    
    return NextResponse.json(responseData);
    
  } catch (error: unknown) {
    console.error('[api/secretary/import-from-url] Fehler:', error);
    
    // Spezifische Fehlerbehandlung für Adapter-Fehler
    if (error instanceof HttpError) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: error.status === 400 ? 'INVALID_URL' : 'SECRETARY_SERVICE_ERROR', 
            message: error.message || 'Fehler beim Secretary Service' 
          } 
        },
        { status: error.status }
      );
    }
    
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: 'NETWORK_ERROR', 
            message: error.message || 'Netzwerkfehler beim Session-Import' 
          } 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        status: 'error', 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Interner Server-Fehler beim Session-Import' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/secretary/import-from-url
 * Gibt Informationen über den Import-Endpunkt zurück
 */
export async function GET() {
  return NextResponse.json({
    status: 'info',
    message: 'Session Import API',
    description: 'Extrahiert Session-Daten aus Websites mithilfe des Secretary Services',
    supported_methods: ['POST'],
    parameters: {
      url: 'string (required) - URL der Website',
      source_language: 'string (optional) - Quellsprache (Standard: en)',
      target_language: 'string (optional) - Zielsprache (Standard: en)',
      template: 'string (optional) - Template-Name (Standard: ExtractSessionDataFromWebsite)',
      use_cache: 'boolean (optional) - Cache verwenden (Standard: false)',
      container_selector: 'string (optional) - XPath-Ausdruck für Container-Selektor'
    }
  });
} 