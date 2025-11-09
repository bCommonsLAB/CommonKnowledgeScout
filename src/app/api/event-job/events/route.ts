/**
 * @fileoverview Event Management API Route - Event List and Migration
 * 
 * @description
 * API endpoint for managing events. Provides GET for listing available events
 * and POST for migrating event names in existing jobs and batches.
 * 
 * @module event-job
 * 
 * @exports
 * - GET: Lists all available event names
 * - POST: Migrates event names in existing jobs and batches
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/event-job/events
 * - src/components/event-monitor: Event monitor components call this endpoint
 * 
 * @dependencies
 * - @/lib/event-job-repository: Event job repository for operations
 */

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