import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/pending-all
 * Setzt alle nicht archivierten Batches auf Pending
 * @param request - Request mit confirm: true und optional targetLanguage: string
 */
export async function POST(request: NextRequest) {
  try {
    // Aktion bestätigen, falls ein Bestätigungsparameter erwartet wird
    const { confirm, targetLanguage } = await request.json() || {};
    
    if (confirm !== true) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Aktion erfordert Bestätigung. Fügen Sie "confirm": true dem Anfragekörper hinzu.'
        },
        { status: 400 }
      );
    }
    
    // Alle Batches auf Pending setzen mit optionaler Zielsprache
    const result = await repository.pendingAllBatches(targetLanguage);
    
    // Nachricht anpassen abhängig davon, ob eine Zielsprache gesetzt wurde
    let message = `${result.batchesUpdated} Batches und ${result.jobsUpdated} Jobs auf 'pending' gesetzt.`;
    if (targetLanguage) {
      message += ` Zielsprache wurde auf "${targetLanguage}" gesetzt.`;
    }
    
    return NextResponse.json({
      status: 'success',
      message,
      data: result
    });
  } catch (error) {
    console.error('Fehler beim Setzen aller Batches auf Pending:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Setzen aller Batches auf Pending: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 