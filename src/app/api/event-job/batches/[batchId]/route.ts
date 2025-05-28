import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/batches/[batchId]
 * Gibt Details zu einem Batch zurück
 */
export async function GET(
  request: NextRequest,
  // @ts-expect-error - Next.js 15 App Router params typing issue
  { params }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const batchId = params.batchId;
    
    // Batch abrufen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: { batch }
    });
  } catch (error) {
    console.error(`Fehler beim Abrufen des Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen des Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/event-job/batches/[batchId]
 * Löscht einen Batch und alle zugehörigen Jobs
 */
export async function DELETE(
  request: NextRequest,
  // @ts-expect-error - Next.js 15 App Router params typing issue
  { params }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const batchId = params.batchId;
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Batch und zugehörige Jobs löschen
    const deleted = await repository.deleteBatch(batchId);
    
    if (!deleted) {
      return NextResponse.json(
        { status: 'error', message: 'Batch konnte nicht gelöscht werden' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Batch und zugehörige Jobs erfolgreich gelöscht'
    });
  } catch (error) {
    console.error(`Fehler beim Löschen des Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Löschen des Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 