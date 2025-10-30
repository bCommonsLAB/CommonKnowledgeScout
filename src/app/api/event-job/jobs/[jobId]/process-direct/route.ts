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
    
    // Job laden
    const job = await repository.getJob(jobId!);
    
    if (!job) {
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfen, ob Job bereits verarbeitet wird
    if (job.status === JobStatus.PROCESSING) {
      return NextResponse.json(
        { status: 'error', message: 'Job wird bereits verarbeitet' },
        { status: 400 }
      );
    }

    // Prüfen, ob alle erforderlichen Parameter vorhanden sind
    const params_required = job.parameters;
    if (!params_required?.event || !params_required?.session || !params_required?.url || 
        !params_required?.filename || !params_required?.track) {
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

    // Session-Payload erstellen - Video-Transcript wird vom Client mitgesendet (falls vorhanden)
    // Server-seitige Transcript-Extraktion ist nicht möglich (Auth-Probleme)
    const sessionProcessBody = await buildSessionPayload(params_required, job, requestBody?.videoTranscript);

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
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(sessionProcessBody),
    });

    const data: ProcessSessionSuccessData | ProcessSessionErrorData | unknown = await resp.json();

    // Ergebnisse verarbeiten
    if (!resp.ok || (data as ProcessSessionErrorData)?.status === 'error') {
      const errorData = data as ProcessSessionErrorData;
      const errorMessage = errorData?.error?.message || resp.statusText || 'Unbekannter Fehler';
      const errorCode = errorData?.error?.code || 'SECRETARY_ERROR';

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
    const successData = data as ProcessSessionSuccessData;
    const output = successData?.data?.output;

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
        const provider = await getServerProvider(userEmail, requestBody.libraryId);
        
        // ZIP-Archiv entpacken und Dateien hochladen (wie in Batch-Verarbeitung)
        const JSZip = await import('jszip');
        const binary = atob(output.archive_data);
        const buf = new Uint8Array(binary.length);
        for (let bi = 0; bi < binary.length; bi++) buf[bi] = binary.charCodeAt(bi);
        const zip = await JSZip.default.loadAsync(buf as unknown as ArrayBuffer);
        
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
        for (const [name, entry] of Object.entries(zip.files)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = entry as any;
          if (e.dir) continue;
          
          const fileData = await e.async('blob');
          const fileName = name.split('/').pop() || name;
          const file = new File([fileData], fileName, { type: fileData.type || undefined });
          const folderId = await ensureDirectoryPath(name);
          await provider.uploadFile(folderId, file);
          uploadedFiles++;
        }
      } catch (error) {
        uploadError = error instanceof Error ? error.message : 'Unbekannter Upload-Fehler';
        console.error('[process-direct] Fehler beim Hochladen in Library:', error);
      }
    }

    // Job als abgeschlossen markieren
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
    console.error(`[process-direct] Fehler beim direkten Verarbeiten des Jobs:`, error);
    
    // Wenn der Job existiert, versuchen wir ihn als fehlgeschlagen zu markieren
    if (jobId) {
      try {
        const jobError: JobError = {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unbekannter Fehler beim direkten Verarbeiten',
        };
        await repository.updateJobStatus(jobId, JobStatus.FAILED, undefined, undefined, jobError);
      } catch {
        // Fehler beim Aktualisieren des Job-Status ignorieren
      }
    }

    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim direkten Verarbeiten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

