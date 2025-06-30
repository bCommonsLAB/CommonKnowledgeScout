import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/jobs/[jobId]
 * Gibt Details zu einem spezifischen Job zurück
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const { jobId } = await params;
    
    // Job Details abrufen - korrekte Methode verwenden
    const job = await repository.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: { job }
    });
  } catch (error) {
    console.error(`Fehler beim Abrufen des Jobs:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen des Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/event-job/jobs/[jobId]
 * Löscht einen spezifischen Job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const { jobId } = await params;
    
    // Job löschen
    const result = await repository.deleteJob(jobId);
    
    if (!result) {
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden oder konnte nicht gelöscht werden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Job erfolgreich gelöscht'
    });
  } catch (error) {
    console.error(`Fehler beim Löschen des Jobs:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Löschen des Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 