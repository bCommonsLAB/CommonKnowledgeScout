import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SessionRepository } from '@/lib/session-repository';

export async function GET() {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Nicht authentifiziert' 
        },
        { status: 401 }
      );
    }

    // Session Repository instanziieren
    const sessionRepo = new SessionRepository();
    
    // Alle verfügbaren Events abrufen
    const events = await sessionRepo.getAvailableEvents();
    
    return NextResponse.json({
      status: 'success',
      data: {
        events,
        count: events.length
      }
    });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der Session Events:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Interner Serverfehler',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 