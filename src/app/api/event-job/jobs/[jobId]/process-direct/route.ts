import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { JobStatus, JobResults, JobError } from '@/types/event-job';
import { getSecretaryConfig } from '@/lib/env';
import type { ProcessSessionSuccessData, ProcessSessionErrorData } from '@/lib/secretary/client';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { getServerProvider } from '@/lib/storage/server-provider';
import { buildSessionPayload } from '@/lib/session/session-processor';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/jobs/[jobId]/process-direct
 * Startet die Session-Verarbeitung direkt ohne Worker-Wartezeit.
 * Ruft den Secretary-Service direkt auf und speichert die Ergebnisse im Job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  let jobId: string | undefined;
  try {
    const resolvedParams = await params;
    jobId = resolvedParams.jobId;
    
    // Log: Job-Verarbeitung gestartet
    await repository.addLogEntry(jobId!, 'info', 'Job-Verarbeitung gestartet (process-direct)');
    
    // Job laden
    const job = await repository.getJob(jobId!);
    
    if (!job) {
      await repository.addLogEntry(jobId!, 'error', 'Job nicht gefunden');
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfen, ob Job bereits verarbeitet wird
    if (job.status === JobStatus.PROCESSING) {
      await repository.addLogEntry(jobId!, 'warning', 'Job wird bereits verarbeitet');
      return NextResponse.json(
        { status: 'error', message: 'Job wird bereits verarbeitet' },
        { status: 400 }
      );
    }

    // Prüfen, ob alle erforderlichen Parameter vorhanden sind
    const params_required = job.parameters;
    if (!params_required?.event || !params_required?.session || !params_required?.url || 
        !params_required?.filename || !params_required?.track) {
      await repository.addLogEntry(jobId!, 'error', 'Job-Parameter unvollständig');
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Job-Parameter unvollständig. Erforderliche Felder: event, session, url, filename, track',
          missing: {
            event: !params_required?.event,
            session: !params_required?.session,
            url: !params_required?.url,
            filename: !params_required?.filename,
            track: !params_required?.track
          }
        },
        { status: 400 }
      );
    }

    // Optional: Library-Informationen und Video-Transcript aus Request-Body lesen
    let requestBody: { libraryId?: string; uploadToLibrary?: boolean; videoTranscript?: string } | undefined;
    try {
      requestBody = await request.json().catch(() => undefined);
    } catch {
      // Request-Body ist optional - wenn nicht vorhanden, nur im Job speichern
    }

    // Status auf PROCESSING setzen
    await repository.updateJobStatus(jobId!, JobStatus.PROCESSING);
    await repository.addLogEntry(jobId!, 'info', `Status auf PROCESSING gesetzt`);

    // Session-Payload erstellen - Video-Transcript wird vom Client mitgesendet (falls vorhanden)
    // Server-seitige Transcript-Extraktion ist nicht möglich (Auth-Probleme)
    await repository.addLogEntry(jobId!, 'info', 'Erstelle Session-Payload für Secretary-Service');
    const sessionProcessBody = await buildSessionPayload(params_required, job, requestBody?.videoTranscript);
    await repository.addLogEntry(jobId!, 'info', `Session-Payload erstellt: Event=${params_required.event}, Session=${params_required.session}, Template=${params_required.template || 'Session_analyze'}, Video-Transcript=${requestBody?.videoTranscript ? 'vorhanden' : 'nicht vorhanden'}`);

    // Session-Verarbeitung direkt starten
    const { baseUrl, apiKey } = getSecretaryConfig();
    const apiUrl = `${baseUrl}/session/process`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Service-Token'] = apiKey;
      headers['X-Secretary-Api-Key'] = apiKey;
    }

    // Secretary-Service aufrufen
    await repository.addLogEntry(jobId!, 'info', `Rufe Secretary-Service auf: ${apiUrl}`);
    const requestStartTime = Date.now();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(sessionProcessBody),
    });
    const requestDuration = Date.now() - requestStartTime;
    
    await repository.addLogEntry(jobId!, 'info', `Secretary-Service-Antwort erhalten: Status=${resp.status}, Dauer=${requestDuration}ms`);

    const data: ProcessSessionSuccessData | ProcessSessionErrorData | unknown = await resp.json();

    // Ergebnisse verarbeiten
    if (!resp.ok || (data as ProcessSessionErrorData)?.status === 'error') {
      const errorData = data as ProcessSessionErrorData;
      const errorMessage = errorData?.error?.message || resp.statusText || 'Unbekannter Fehler';
      const errorCode = errorData?.error?.code || 'SECRETARY_ERROR';

      await repository.addLogEntry(jobId!, 'error', `Secretary-Service-Fehler: ${errorCode} - ${errorMessage}`);

      // Job als fehlgeschlagen markieren
      const jobError: JobError = {
        code: errorCode,
        message: errorMessage,
      };
      await repository.updateJobStatus(jobId!, JobStatus.FAILED, undefined, undefined, jobError);

      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Session-Verarbeitung fehlgeschlagen',
          error: {
            code: errorCode,
            message: errorMessage,
            details: errorData?.error
          }
        },
        { status: resp.status >= 400 && resp.status < 600 ? resp.status : 500 }
      );
    }

    // Erfolg: Ergebnisse speichern
    await repository.addLogEntry(jobId!, 'info', 'Secretary-Service-Verarbeitung erfolgreich abgeschlossen');
    const successData = data as ProcessSessionSuccessData;
    const output = successData?.data?.output;

    // Log: Ergebnisse analysieren
    const hasMarkdown = !!output?.markdown_content || !!output?.markdown_file;
    const hasArchive = !!output?.archive_data && !!output?.archive_filename;
    await repository.addLogEntry(jobId!, 'info', `Ergebnisse erhalten: Markdown=${hasMarkdown ? 'vorhanden' : 'nicht vorhanden'}, ZIP-Archiv=${hasArchive ? `vorhanden (${output.archive_filename})` : 'nicht vorhanden'}`);

    const jobResults: JobResults = {
      markdown_file: output?.markdown_file,
      markdown_content: output?.markdown_content,
      archive_data: output?.archive_data,
      archive_filename: output?.archive_filename,
      assets: output?.archive_data ? [] : undefined, // Assets werden aus Archive extrahiert
    };

    // Optional: Dateien in Library hochladen (wie in Batch-Verarbeitung)
    let uploadedFiles: number = 0;
    let uploadError: string | undefined;
    
    if (requestBody?.uploadToLibrary && requestBody?.libraryId && output?.archive_data && output?.archive_filename) {
      try {
        await repository.addLogEntry(jobId!, 'info', `Starte Upload in Library: LibraryId=${requestBody.libraryId}, Archiv=${output.archive_filename}`);
        
        // User-Email für Server-Provider benötigt
        const { userId } = getAuth(request);
        if (!userId) {
          throw new Error('Nicht authentifiziert');
        }
        const user = await currentUser();
        const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
        
        if (!userEmail) {
          throw new Error('Benutzer-E-Mail nicht verfügbar');
        }

        // Server-Provider abrufen
        await repository.addLogEntry(jobId!, 'info', `Lade Storage-Provider für Library: ${requestBody.libraryId}`);
        const provider = await getServerProvider(userEmail, requestBody.libraryId);
        await repository.addLogEntry(jobId!, 'info', 'Storage-Provider erfolgreich geladen');
        
        // ZIP-Archiv entpacken und Dateien hochladen (wie in Batch-Verarbeitung)
        await repository.addLogEntry(jobId!, 'info', `Entpacke ZIP-Archiv: ${output.archive_filename}, Größe=${Math.ceil(output.archive_data.length * 0.75)} Bytes`);
        const JSZip = await import('jszip');
        const binary = atob(output.archive_data);
        const buf = new Uint8Array(binary.length);
        for (let bi = 0; bi < binary.length; bi++) buf[bi] = binary.charCodeAt(bi);
        const zip = await JSZip.default.loadAsync(buf as unknown as ArrayBuffer);
        
        const totalEntries = Object.keys(zip.files).length;
        await repository.addLogEntry(jobId!, 'info', `ZIP-Archiv entpackt: ${totalEntries} Einträge gefunden`);
        
        // Hilfsfunktion: Verzeichnisstruktur erstellen
        const ensureDirectoryPath = async (targetPath: string): Promise<string> => {
          if (!targetPath || !targetPath.includes('/')) return 'root';
          const parts = targetPath.split('/').filter(Boolean);
          if (parts.length === 0) return 'root';
          const dirs = parts.slice(0, -1);
          let parent = 'root';
          for (const dir of dirs) {
            const items = await provider.listItemsById(parent);
            const existing = items.find(it => it.type === 'folder' && it.metadata.name === dir);
            if (existing) {
              parent = existing.id;
            } else {
              const created = await provider.createFolder(parent, dir);
              parent = created.id;
            }
          }
          return parent;
        };

        // Alle Dateien aus ZIP hochladen
        let imageCount = 0;
        let markdownCount = 0;
        let otherCount = 0;
        
        for (const [name, entry] of Object.entries(zip.files)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = entry as any;
          if (e.dir) continue;
          
          const fileData = await e.async('blob');
          const fileName = name.split('/').pop() || name;
          const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension);
          const isMarkdown = fileExtension === 'md';
          
          if (isImage) imageCount++;
          else if (isMarkdown) markdownCount++;
          else otherCount++;
          
          const file = new File([fileData], fileName, { type: fileData.type || undefined });
          const folderId = await ensureDirectoryPath(name);
          await provider.uploadFile(folderId, file);
          uploadedFiles++;
          
          // Log alle 10 Dateien oder bei wichtigen Dateien
          if (uploadedFiles % 10 === 0 || isImage || isMarkdown) {
            await repository.addLogEntry(jobId!, 'debug', `Datei hochgeladen: ${name} (${Math.round(fileData.size / 1024)} KB)`);
          }
        }
        
        await repository.addLogEntry(jobId!, 'info', `Upload abgeschlossen: ${uploadedFiles} Dateien hochgeladen (${imageCount} Bilder, ${markdownCount} Markdown, ${otherCount} andere)`);
      } catch (error) {
        uploadError = error instanceof Error ? error.message : 'Unbekannter Upload-Fehler';
        await repository.addLogEntry(jobId!, 'error', `Fehler beim Hochladen in Library: ${uploadError}`);
        console.error('[process-direct] Fehler beim Hochladen in Library:', error);
      }
    } else {
      await repository.addLogEntry(jobId!, 'info', 'Upload in Library übersprungen (nicht aktiviert oder keine Archiv-Daten)');
    }

    // Job als abgeschlossen markieren
    await repository.addLogEntry(jobId!, 'info', 'Job-Verarbeitung erfolgreich abgeschlossen');
    await repository.updateJobStatus(jobId!, JobStatus.COMPLETED, undefined, jobResults);

    // Aktualisierten Job zurückgeben
    const updatedJob = await repository.getJob(jobId!);

    return NextResponse.json({
      status: 'success',
      message: 'Session erfolgreich verarbeitet',
      data: { 
        job: updatedJob,
        results: jobResults,
        upload: requestBody?.uploadToLibrary ? {
          uploadedFiles,
          success: !uploadError,
          error: uploadError
        } : undefined
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler beim direkten Verarbeiten';
    console.error(`[process-direct] Fehler beim direkten Verarbeiten des Jobs:`, error);
    
    // Wenn der Job existiert, versuchen wir ihn als fehlgeschlagen zu markieren
    if (jobId) {
      try {
        await repository.addLogEntry(jobId!, 'error', `Interner Fehler: ${errorMessage}`);
        const jobError: JobError = {
          code: 'INTERNAL_ERROR',
          message: errorMessage,
        };
        await repository.updateJobStatus(jobId, JobStatus.FAILED, undefined, undefined, jobError);
      } catch {
        // Fehler beim Aktualisieren des Job-Status ignorieren
      }
    }

    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim direkten Verarbeiten: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}

