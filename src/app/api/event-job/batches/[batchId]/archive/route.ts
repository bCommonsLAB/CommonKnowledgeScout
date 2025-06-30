import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/[batchId]/archive
 * Archiviert einen Batch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    // params ist von Next.js korrekt injiziert
    const { batchId } = await params;
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Batch archivieren
    const success = await repository.archiveBatch(batchId);
    
    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Batch konnte nicht archiviert werden' },
        { status: 500 }
      );
    }
    
    // Aktualisierter Batch
    const updatedBatch = await repository.getBatch(batchId);
    
    return NextResponse.json({
      status: 'success',
      message: 'Batch wurde erfolgreich archiviert',
      data: { batch: updatedBatch }
    });
  } catch (error) {
    console.error(`Fehler beim Archivieren des Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Archivieren des Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 