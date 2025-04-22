import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { JobStatus } from '@/types/event-job';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/[batchId]/change-language
 * Ändert die Zielsprache für alle Jobs in einem Batch und setzt sie optional auf "pending" zurück
 */
export async function POST(
  request: NextRequest,
  context: { params: { batchId: string } }
) {
  try {
    // In Next.js 15 müssen wir das params-Objekt mit await behandeln
    const params = await context.params;
    const batchId = params.batchId;
    
    // Request-Body parsen
    const body = await request.json();
    const { targetLanguage, resetStatus = false } = body;
    
    if (!targetLanguage) {
      return NextResponse.json(
        { status: 'error', message: 'Zielsprache muss angegeben werden' },
        { status: 400 }
      );
    }
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Alle Jobs des Batches abrufen
    const jobs = await repository.getJobsForBatch(batchId, { limit: 1000, skip: 0 });
    
    // Jobs einzeln aktualisieren
    let updatedCount = 0;
    for (const job of jobs) {
      // Parameter aktualisieren
      if (job.parameters) {
        // Wir fügen eine Hilfsmethode zum Repository hinzu
        const result = resetStatus
          ? await repository.updateJobLanguageAndReset(job.job_id, targetLanguage)
          : await repository.updateJobLanguage(job.job_id, targetLanguage);
        
        if (result) {
          updatedCount++;
        }
      }
    }
    
    // Batch-Status aktualisieren, wenn Jobs zurückgesetzt wurden
    if (resetStatus && updatedCount > 0) {
      await repository.updateBatchProgress(batchId);
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Sprache für ${updatedCount} Jobs auf "${targetLanguage}" geändert${resetStatus ? ' und Status zurückgesetzt' : ''}`,
      data: { 
        updatedCount,
        targetLanguage,
        resetStatus
      }
    });
  } catch (error) {
    console.error(`Fehler beim Ändern der Sprache für Batch:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Ändern der Sprache: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 