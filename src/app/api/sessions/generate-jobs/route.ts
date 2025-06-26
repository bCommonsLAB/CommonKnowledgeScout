import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/session-repository';
import { EventJobRepository } from '@/lib/event-job-repository';
import { Job, BatchStatus, AccessVisibility } from '@/types/event-job';

const sessionRepository = new SessionRepository();
const jobRepository = new EventJobRepository();

/**
 * POST /api/sessions/generate-jobs
 * Generiert Event-Jobs aus ausgewählten Sessions
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      sessionIds, 
      targetLanguage = 'de', 
      batchName 
    } = await request.json() as { 
      sessionIds: string[]; 
      targetLanguage?: string; 
      batchName?: string; 
    };
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine Session-IDs angegeben' },
        { status: 400 }
      );
    }
    
    // Sessions laden
    const sessions = await Promise.all(
      sessionIds.map(id => sessionRepository.getSession(id))
    );
    
    // Null-Sessions filtern
    const validSessions = sessions.filter(s => s !== null);
    
    if (validSessions.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine gültigen Sessions gefunden' },
        { status: 404 }
      );
    }
    
    // Event-Namen aus den Sessions extrahieren
    const events = Array.from(new Set(validSessions.map(s => s.event)));
    const eventName = events.length === 1 ? events[0] : 'Gemischte Events';
    
    // Batch-Namen generieren falls nicht angegeben
    const generatedBatchName = batchName || 
      `${eventName} - ${validSessions.length} Sessions (${new Date().toLocaleDateString('de-DE')})`;
    
    // Batch erstellen
    const batchId = await jobRepository.createBatch({
      batch_name: generatedBatchName,
      event_name: eventName, // Nutze das neue event_name Feld
      status: BatchStatus.PENDING,
      user_id: 'session-generator',
      total_jobs: validSessions.length,
      completed_jobs: 0,
      failed_jobs: 0,
      archived: false,
      isActive: true,
      access_control: {
        visibility: AccessVisibility.PRIVATE,
        read_access: ['session-generator'],
        write_access: ['session-generator'],
        admin_access: ['session-generator']
      }
    });
    
    // Jobs aus Sessions erstellen
    const jobPromises = validSessions.map(session => {
      const jobData: Omit<Job, 'job_id' | 'created_at' | 'updated_at' | 'status'> = {
        job_type: 'event',
        job_name: `${session.event} - ${session.session}`,
        event_name: session.event, // Nutze das neue event_name Feld
        batch_id: batchId,
        user_id: 'session-generator',
        archived: false,
        parameters: {
          event: session.event,
          session: session.session,
          url: session.url,
          filename: session.filename,
          track: session.track,
          day: session.day,
          starttime: session.starttime,
          endtime: session.endtime,
          speakers: session.speakers || null,
          video_url: session.video_url,
          attachments_url: session.attachments_url || undefined,
          source_language: session.source_language,
          target_language: targetLanguage
        },
        access_control: {
          visibility: AccessVisibility.PRIVATE,
          read_access: ['session-generator'],
          write_access: ['session-generator'],
          admin_access: ['session-generator']
        }
      };
      
      return jobRepository.createJob(jobData);
    });
    
    const jobIds = await Promise.all(jobPromises);
    
    // Batch mit aktuellen Informationen zurückgeben
    const batch = await jobRepository.getBatch(batchId);
    
    return NextResponse.json({
      status: 'success',
      message: `Erfolgreich ${jobIds.length} Jobs aus ${validSessions.length} Sessions generiert`,
      data: {
        batchId,
        batch,
        jobIds,
        sessionsProcessed: validSessions.length
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Fehler beim Generieren der Event-Jobs:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Generieren der Event-Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 