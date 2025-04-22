import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { CreateBatchRequest, AccessVisibility, JobStatus, BatchStatus } from '@/types/event-job';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/batches
 * Gibt eine Liste von Batches zurück
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const archived = searchParams.get('archived') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    const isActive = searchParams.get('isActive') === 'true' ? true : 
                     searchParams.get('isActive') === 'false' ? false : undefined;
    
    let status: BatchStatus | undefined;
    const statusParam = searchParams.get('status');
    if (statusParam && Object.values(BatchStatus).includes(statusParam as BatchStatus)) {
      status = statusParam as BatchStatus;
    }
    
    // Batches abrufen
    const batches = await repository.getBatches({ 
      archived, 
      limit, 
      skip,
      status,
      isActive
    });
    
    // Gesamtanzahl der Batches zählen
    const total = await repository.countBatches({ archived, status, isActive });
    
    return NextResponse.json({
      status: 'success',
      data: {
        batches,
        total,
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Batches:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen der Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/event-job/batches
 * Erstellt einen neuen Batch mit Jobs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateBatchRequest;
    const userId = request.headers.get('X-User-ID') || 'system';
    
    // Validierung der Eingabedaten
    if (!body.jobs || !Array.isArray(body.jobs) || body.jobs.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine gültigen Jobs angegeben' },
        { status: 400 }
      );
    }
    
    // Batch erstellen
    const batchId = await repository.createBatch({
      batch_name: body.batch_name,
      status: BatchStatus.PENDING,
      user_id: body.user_id || userId,
      total_jobs: body.jobs.length,
      completed_jobs: 0,
      failed_jobs: 0,
      archived: false,
      isActive: true,
      access_control: {
        visibility: AccessVisibility.PRIVATE,
        read_access: [body.user_id || userId],
        write_access: [body.user_id || userId],
        admin_access: [body.user_id || userId]
      }
    });
    
    // Jobs erstellen
    const jobPromises = body.jobs.map(jobData => 
      repository.createJob({
        ...jobData,
        batch_id: batchId,
        user_id: body.user_id || userId,
        archived: false,
        job_type: jobData.job_type || 'event',
        access_control: {
          visibility: AccessVisibility.PRIVATE,
          read_access: [body.user_id || userId],
          write_access: [body.user_id || userId],
          admin_access: [body.user_id || userId]
        }
      })
    );
    
    await Promise.all(jobPromises);
    
    // Batch mit aktuellen Informationen zurückgeben
    const batch = await repository.getBatch(batchId);
    
    return NextResponse.json(
      { 
        status: 'success', 
        message: 'Batch erfolgreich erstellt',
        data: { batch_id: batchId, batch }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Erstellen des Batches:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Erstellen des Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 