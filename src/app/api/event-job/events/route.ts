import { NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

/**
 * GET /api/event-job/events
 * Lädt alle verfügbaren Event-Namen
 */
export async function GET() {
  try {
    const repository = new EventJobRepository();
    
    // Lade alle verfügbaren Events
    const events = await repository.getAvailableEvents();
    
    return NextResponse.json({
      status: 'success',
      data: {
        events,
        total: events.length
      }
    });
  } catch (error) {
    console.error('Fehler beim Laden der Events:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Fehler beim Laden der Events'
    }, { status: 500 });
  }
}

/**
 * POST /api/event-job/events/migrate
 * Migriert bestehende Jobs/Batches um event_name Felder hinzuzufügen
 */
export async function POST() {
  try {
    const repository = new EventJobRepository();
    
    // Führe Migration durch
    const result = await repository.migrateEventNames();
    
    return NextResponse.json({
      status: 'success',
      data: result,
      message: `Migration abgeschlossen: ${result.jobsUpdated} Jobs und ${result.batchesUpdated} Batches aktualisiert`
    });
  } catch (error) {
    console.error('Fehler bei der Event-Migration:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Fehler bei der Event-Migration'
    }, { status: 500 });
  }
} 