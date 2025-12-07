/**
 * @fileoverview Event Job Management API Route - Individual Job Operations
 * 
 * @description
 * API endpoint for managing individual event jobs. Provides GET for job details,
 * DELETE for job deletion, and PATCH for job updates. Handles authentication
 * and job access control.
 * 
 * @module event-job
 * 
 * @exports
 * - GET: Retrieves job details
 * - DELETE: Deletes a job
 * - PATCH: Updates a job
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/event-job/jobs/[jobId]
 * - src/components/event-monitor: Event monitor components call this endpoint
 * 
 * @dependencies
 * - @/lib/event-job-repository: Event job repository for operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { JobStatus } from '@/types/event-job';

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
 * PATCH /api/event-job/jobs/[jobId]
 * Aktualisiert einen Job (Status, Results, Error)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    
    const { status, results, error, progress } = body;
    
    // Validierung: Status muss ein gültiger JobStatus sein
    if (status && !Object.values(JobStatus).includes(status as JobStatus)) {
      return NextResponse.json(
        { status: 'error', message: 'Ungültiger Status' },
        { status: 400 }
      );
    }
    
    // Status ist erforderlich
    if (!status) {
      return NextResponse.json(
        { status: 'error', message: 'Status ist erforderlich' },
        { status: 400 }
      );
    }
    
    // Job-Status aktualisieren
    const success = await repository.updateJobStatus(
      jobId,
      status as JobStatus,
      progress,
      results,
      error
    );
    
    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Job nicht gefunden oder konnte nicht aktualisiert werden' },
        { status: 404 }
      );
    }
    
    // Aktualisierten Job zurückgeben
    const updatedJob = await repository.getJob(jobId);
    
    return NextResponse.json({
      status: 'success',
      message: 'Job erfolgreich aktualisiert',
      data: { job: updatedJob }
    });
  } catch (error) {
    console.error(`Fehler beim Aktualisieren des Jobs:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Aktualisieren des Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
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