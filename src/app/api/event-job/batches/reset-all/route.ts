import { NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/batches/reset-all
 * Setzt alle Jobs in allen aktiven Batches auf "pending" zurück
 */
export async function POST() {
  try {
    // Nur aktive, nicht archivierte Batches abrufen
    const batches = await repository.getBatches({ 
      archived: false, 
      isActive: true,
      limit: 1000, 
      skip: 0 
    });
    
    let totalJobsReset = 0;
    const results = [];
    
    // Für jeden Batch alle Jobs zurücksetzen
    for (const batch of batches) {
      const result = await repository.restartBatchWithOptions(batch.batch_id, false);
      if (result) {
        totalJobsReset += batch.total_jobs || 0;
        results.push({
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          success: true,
          jobs_reset: batch.total_jobs
        });
      } else {
        results.push({
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          success: false,
          jobs_reset: 0
        });
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: `${totalJobsReset} Jobs in ${results.filter(r => r.success).length} Batches wurden erfolgreich auf PENDING zurückgesetzt`,
      data: { results }
    });
  } catch (error) {
    console.error(`Fehler beim Zurücksetzen aller Batches:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Zurücksetzen aller Batches: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 