import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { ExternalJob } from '@/types/external-job';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option
    if (formData.has('template')) {
      serviceFormData.append('template', formData.get('template') as string);
    }
    
    // Extraktionsmethode
    if (formData.has('extractionMethod')) {
      serviceFormData.append('extraction_method', formData.get('extractionMethod') as string);
    } else {
      serviceFormData.append('extraction_method', 'native'); // Standardwert
    }
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const extractionMethod = (formData.get('extractionMethod') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/webhook`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // Wichtig: jobId separat mitsenden (Secretary-Anforderung)
    serviceFormData.append('jobId', jobId);
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation als JSON mitgeben (inkl. jobId)
    serviceFormData.append('correlation', JSON.stringify(correlation));
    FileLogger.info('process-pdf', 'Korrelation an Secretary gesendet', {
      jobId,
      correlationKeys: Object.keys(correlation),
      correlationSize: JSON.stringify(correlation).length,
      correlation: correlation
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: formData.get('target_language'),
        extraction_method: formData.get('extraction_method'),
        useCache: formData.get('useCache'),
        includeImages: formData.get('includeImages'),
        force_refresh: formData.get('force_refresh'),
        jobId,
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/webhook`,
        callback_token: jobSecret,
        correlation: JSON.stringify(correlation)
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, {
      phase: 'request_sent',
      sourcePath: correlation.source?.itemId,
      targetParentId: correlation.source?.parentId,
      callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/webhook` : undefined
    });

    // Anfrage an den Secretary Service senden
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: {
        'Accept': 'application/json',
      },
    });

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 