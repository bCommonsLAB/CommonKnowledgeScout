/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/batches/[batchId]/jobs
 * Gibt alle Jobs für einen bestimmten Batch zurück
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const { batchId } = await params;
    
    const searchParams = request.nextUrl.searchParams;
    
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Jobs für den Batch abrufen
    const jobs = await repository.getJobsForBatch(batchId, { limit, skip });
    
    return NextResponse.json({
      status: 'success',
      data: { jobs }
    });
  } catch (error) {
    console.error(`Fehler beim Abrufen der Jobs für Batch:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen der Jobs: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}