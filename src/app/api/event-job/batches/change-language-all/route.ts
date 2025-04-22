import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/change-language-all
 * Ändert die Zielsprache für alle Jobs in allen aktiven Batches und setzt sie optional auf "pending" zurück
 */
export async function POST(request: NextRequest) {
  try {
    // Request-Body parsen
    const body = await request.json();
    const { 
      targetLanguage, 
      resetStatus = false, 
      includeArchived = false 
    } = body;
    
    if (!targetLanguage) {
      return NextResponse.json(
        { status: 'error', message: 'Zielsprache muss angegeben werden' },
        { status: 400 }
      );
    }
    
    // Batches abrufen
    const batches = await repository.getBatches({ 
      archived: includeArchived, 
      limit: 1000, 
      skip: 0 
    });
    
    let totalJobsUpdated = 0;
    const results = [];
    
    // Für jeden Batch alle Jobs aktualisieren
    for (const batch of batches) {
      // Alle Jobs des Batches abrufen
      const jobs = await repository.getJobsForBatch(batch.batch_id, { limit: 1000, skip: 0 });
      
      let batchJobsUpdated = 0;
      
      // Jobs einzeln aktualisieren
      for (const job of jobs) {
        if (job.parameters) {
          const result = resetStatus
            ? await repository.updateJobLanguageAndReset(job.job_id, targetLanguage)
            : await repository.updateJobLanguage(job.job_id, targetLanguage);
          
          if (result) {
            batchJobsUpdated++;
          }
        }
      }
      
      // Batch-Status aktualisieren, wenn Jobs zurückgesetzt wurden
      if (resetStatus && batchJobsUpdated > 0) {
        await repository.updateBatchProgress(batch.batch_id);
      }
      
      results.push({
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        jobs_updated: batchJobsUpdated
      });
      
      totalJobsUpdated += batchJobsUpdated;
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Sprache für ${totalJobsUpdated} Jobs in ${batches.length} Batches auf "${targetLanguage}" geändert${resetStatus ? ' und Status zurückgesetzt' : ''}`,
      data: { 
        totalJobsUpdated,
        targetLanguage,
        resetStatus,
        includeArchived,
        results
      }
    });
  } catch (error) {
    console.error(`Fehler beim Ändern der Sprache für alle Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Ändern der Sprache: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 