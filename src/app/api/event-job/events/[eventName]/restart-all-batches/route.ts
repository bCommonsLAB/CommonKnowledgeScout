/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * POST /api/event-job/events/[eventName]/restart-all-batches
 * Startet alle Batches eines Events neu mit optional useCache-Konfiguration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventName: string }> }
) {
  try {
    const { eventName } = await params;
    const decodedEventName = decodeURIComponent(eventName);
    
    console.log(`[Event Restart] Starting restart for all batches in event: ${decodedEventName}`);
    
    // Request-Body parsen für useCache-Option
    let useCache: boolean | undefined = undefined;
    let confirm = false;
    
    try {
      const body = await request.json();
      if (typeof body.useCache === 'boolean') useCache = body.useCache;
      if (typeof body.confirm === 'boolean') confirm = body.confirm;
    } catch {
      console.log('[Event Restart] No valid JSON body provided, using defaults');
    }
    
    // Sicherheitsabfrage
    if (!confirm) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Event-weiter Restart erfordert Bestätigung. Fügen Sie "confirm": true dem Request-Body hinzu.'
        },
        { status: 400 }
      );
    }
    
    // Lade alle nicht-archivierten Batches für das Event mit server-seitiger Filterung
    const eventBatches = await repository.getBatches({
      archived: false,
      eventName: decodedEventName,
      limit: 1000,
      skip: 0
    });
    
    console.log(`[Event Restart] Found ${eventBatches.length} batches for event "${decodedEventName}"`);
    
    if (eventBatches.length === 0) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: `Keine Batches für Event "${decodedEventName}" gefunden.`
        },
        { status: 404 }
      );
    }
    
    // Restart-Ergebnisse sammeln
    const results = [];
    let totalJobsRestarted = 0;
    let successfulBatches = 0;
    
    // Jeden Batch neu starten
    for (const batch of eventBatches) {
      try {
        console.log(`[Event Restart] Restarting batch: ${batch.batch_name} (${batch.batch_id})`);
        
        const restartResult = await repository.restartBatchWithOptions(batch.batch_id, useCache);
        
        if (restartResult) {
          successfulBatches++;
          totalJobsRestarted += batch.total_jobs || 0;
          results.push({
            batch_id: batch.batch_id,
            batch_name: batch.batch_name,
            success: true,
            jobs_restarted: batch.total_jobs || 0,
            use_cache: useCache
          });
          
          console.log(`[Event Restart] ✅ Successfully restarted batch ${batch.batch_id}`);
        } else {
          results.push({
            batch_id: batch.batch_id,
            batch_name: batch.batch_name,
            success: false,
            jobs_restarted: 0,
            error: 'Restart operation failed'
          });
          
          console.log(`[Event Restart] ❌ Failed to restart batch ${batch.batch_id}`);
        }
        
        // Kurze Pause zwischen Batch-Restarts um DB nicht zu überlasten
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`[Event Restart] Error restarting batch ${batch.batch_id}:`, error);
        results.push({
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          success: false,
          jobs_restarted: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`[Event Restart] Completed: ${successfulBatches}/${eventBatches.length} batches restarted, ${totalJobsRestarted} total jobs`);
    
    return NextResponse.json({
      status: 'success',
      message: `Event-Restart abgeschlossen: ${successfulBatches}/${eventBatches.length} Batches erfolgreich neu gestartet. ${totalJobsRestarted} Jobs insgesamt.`,
      data: {
        event_name: decodedEventName,
        total_batches: eventBatches.length,
        successful_batches: successfulBatches,
        failed_batches: eventBatches.length - successfulBatches,
        total_jobs_restarted: totalJobsRestarted,
        use_cache_setting: useCache,
        results
      }
    });
    
  } catch (error) {
    console.error(`[Event Restart] Critical error:`, error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Event-weiten Restart: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 