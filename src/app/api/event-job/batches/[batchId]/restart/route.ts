/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/[batchId]/restart
 * Setzt alle Jobs eines Batches auf "pending" zurück
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Alle Jobs des Batches auf PENDING zurücksetzen
    const result = await repository.restartBatch(batchId);
    
    if (!result) {
      return NextResponse.json(
        { status: 'error', message: 'Batch konnte nicht neu gestartet werden' },
        { status: 500 }
      );
    }
    
    // Aktualisierte Jobs abrufen
    const jobs = await repository.getJobsForBatch(batchId, { limit: 1000, skip: 0 });
    
    return NextResponse.json({
      status: 'success',
      message: 'Alle Jobs wurden erfolgreich auf PENDING zurückgesetzt',
      data: { jobs }
    });
  } catch (error) {
    console.error(`Fehler beim Neustarten des Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Neustarten des Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 