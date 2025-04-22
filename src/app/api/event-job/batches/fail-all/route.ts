import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/fail-all
 * Setzt alle nicht archivierten Batches auf Failed
 */
export async function POST(request: NextRequest) {
  try {
    // Aktion bestätigen, falls ein Bestätigungsparameter erwartet wird
    const { confirm } = await request.json() || {};
    
    if (confirm !== true) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Aktion erfordert Bestätigung. Fügen Sie "confirm": true dem Anfragekörper hinzu.'
        },
        { status: 400 }
      );
    }
    
    // Alle Batches auf Failed setzen
    const result = await repository.failAllBatches();
    
    return NextResponse.json({
      status: 'success',
      message: `${result.batchesUpdated} Batches und ${result.jobsUpdated} Jobs auf 'failed' gesetzt.`,
      data: result
    });
  } catch (error) {
    console.error('Fehler beim Setzen aller Batches auf Failed:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Setzen aller Batches auf Failed: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 