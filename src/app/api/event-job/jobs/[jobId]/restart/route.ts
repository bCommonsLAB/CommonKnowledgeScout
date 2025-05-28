import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { JobStatus } from '@/types/event-job';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/jobs/[jobId]/restart
 * Startet einen fehlgeschlagenen Job neu
 */
export async function POST(
  request: NextRequest,
  // @ts-expect-error - Next.js 15 App Router params typing issue
  { params }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const jobId = params.jobId;
    
    // Zuerst den Job abrufen
    const job = await repository.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden' },
        { status: 404 }
      );
    }
    
 
    
    // Job-Status auf PENDING setzen, um ihn neu zu starten
    const result = await repository.updateJobStatus(jobId, JobStatus.PENDING);
    
    if (!result) {
      return NextResponse.json(
        { status: 'error', message: 'Job konnte nicht neu gestartet werden' },
        { status: 500 }
      );
    }
    
    // Aktualisierten Job abrufen
    const updatedJob = await repository.getJob(jobId);
    
    return NextResponse.json({
      status: 'success',
      message: 'Job erfolgreich neu gestartet',
      data: { job: updatedJob }
    });
  } catch (error) {
    console.error(`Fehler beim Neustarten des Jobs:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Neustarten des Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 