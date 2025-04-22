import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/[batchId]/toggle-active
 * Schaltet den isActive-Status eines Batches um
 */
export async function POST(
  request: NextRequest,
  context: { params: { batchId: string } }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const params = await context.params;
    const batchId = params.batchId;
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // isActive-Status umschalten
    const success = await repository.toggleBatchActive(batchId);
    
    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Batch-Status konnte nicht aktualisiert werden' },
        { status: 500 }
      );
    }
    
    // Aktualisierter Batch
    const updatedBatch = await repository.getBatch(batchId);
    
    return NextResponse.json({
      status: 'success',
      message: `Batch wurde ${updatedBatch?.isActive ? 'aktiviert' : 'deaktiviert'}`,
      data: { batch: updatedBatch }
    });
  } catch (error) {
    console.error(`Fehler beim Umschalten des Batch-Status:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Umschalten des Batch-Status: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 