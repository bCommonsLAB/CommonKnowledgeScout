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
      batchName,
      groupByTrack = false
    } = await request.json() as { 
      sessionIds: string[]; 
      targetLanguage?: string; 
      batchName?: string; 
      groupByTrack?: boolean;
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

    if (groupByTrack) {
      // Sessions nach Track gruppieren
      const sessionsByTrack = validSessions.reduce((groups, session) => {
        const track = session.track;
        if (!groups[track]) {
          groups[track] = [];
        }
        groups[track].push(session);
        return groups;
      }, {} as Record<string, typeof validSessions>);

      // Für jeden Track einen Batch erstellen
      const batchResults = [];
      const allJobIds = [];
      
      for (const [trackName, trackSessions] of Object.entries(sessionsByTrack)) {
        // Event-Namen aus den Sessions dieses Tracks extrahieren
        const events = Array.from(new Set(trackSessions.map(s => s.event)));
        const eventName = events.length === 1 ? events[0] : 'Gemischte Events';
        
        // Batch-Name ist einfach der Track-Name
        const batchId = await jobRepository.createBatch({
          batch_name: trackName, // ✅ Batch-Name = Track-Name
          event_name: eventName,
          status: BatchStatus.PENDING,
          user_id: 'session-generator',
          total_jobs: trackSessions.length,
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

        // Jobs für diesen Track erstellen
        const trackJobPromises = trackSessions.map(session => {
          const jobData: Omit<Job, 'job_id' | 'created_at' | 'updated_at' | 'status'> = {
            job_type: 'event',
            job_name: `${session.event} - ${session.session}`,
            event_name: session.event,
            batch_id: batchId,
            user_id: 'session-generator',
            archived: false,
            parameters: {
              event: session.event,
              session: session.session,
              url: session.url || '', // Optional: leerer String wenn nicht vorhanden
              filename: session.filename,
              track: session.track,
              day: session.day || '', // Optional: leerer String wenn nicht vorhanden
              starttime: session.starttime || '', // Optional: leerer String wenn nicht vorhanden
              endtime: session.endtime || '', // Optional: leerer String wenn nicht vorhanden
              speakers: session.speakers || null, // Optional: null wenn nicht vorhanden
              image_url: session.image_url || undefined, // Optional: Bild-URL
              video_url: session.video_url || '', // Optional: leerer String wenn nicht vorhanden
              attachments_url: session.attachments_url || undefined,
              source_language: session.source_language || 'en', // Optional: 'en' als Default
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

        const trackJobIds = await Promise.all(trackJobPromises);
        allJobIds.push(...trackJobIds);
        
        // Batch-Info für die Antwort sammeln
        const batch = await jobRepository.getBatch(batchId);
        batchResults.push({
          batchId,
          batch,
          trackName,
          jobIds: trackJobIds,
          sessionsCount: trackSessions.length
        });
      }

      return NextResponse.json({
        status: 'success',
        message: `Erfolgreich ${allJobIds.length} Jobs in ${batchResults.length} Batches (nach Tracks gruppiert) generiert`,
        data: {
          totalJobs: allJobIds.length,
          batchCount: batchResults.length,
          batches: batchResults,
          sessionsProcessed: validSessions.length
        }
      }, { status: 201 });

    } else {
      // Ursprüngliche Single-Batch Logik
      // Event-Namen aus den Sessions extrahieren
      const events = Array.from(new Set(validSessions.map(s => s.event)));
      const eventName = events.length === 1 ? events[0] : 'Gemischte Events';
      
      // Batch-Namen generieren falls nicht angegeben
      const generatedBatchName = batchName || 
        `${eventName} - ${validSessions.length} Sessions (${new Date().toLocaleDateString('de-DE')})`;
      
      // Batch erstellen
      const batchId = await jobRepository.createBatch({
        batch_name: generatedBatchName,
        event_name: eventName,
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
          event_name: session.event,
          batch_id: batchId,
          user_id: 'session-generator',
          archived: false,
          parameters: {
            event: session.event,
            session: session.session,
            url: session.url || '', // Optional: leerer String wenn nicht vorhanden
            filename: session.filename,
            track: session.track,
            day: session.day || '', // Optional: leerer String wenn nicht vorhanden
            starttime: session.starttime || '', // Optional: leerer String wenn nicht vorhanden
            endtime: session.endtime || '', // Optional: leerer String wenn nicht vorhanden
            speakers: session.speakers || null, // Optional: null wenn nicht vorhanden
            image_url: session.image_url || undefined, // Optional: Bild-URL
            video_url: session.video_url || '', // Optional: leerer String wenn nicht vorhanden
            attachments_url: session.attachments_url || undefined,
            source_language: session.source_language || 'en', // Optional: 'en' als Default
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
    }
    
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