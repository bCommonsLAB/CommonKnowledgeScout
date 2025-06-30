import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/session-repository';
import { SessionCreateRequest } from '@/types/session';

const repository = new SessionRepository();

/**
 * GET /api/sessions
 * Gibt eine Liste von Sessions zurück
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const event = searchParams.get('event') || undefined;
    const track = searchParams.get('track') || undefined;
    const day = searchParams.get('day') || undefined;
    const source_language = searchParams.get('source_language') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Sessions abrufen
    const sessions = await repository.getSessions({ 
      event,
      track,
      day,
      source_language,
      search,
      limit, 
      skip
    });
    
    // Gesamtanzahl der Sessions zählen
    const total = await repository.countSessions({ event, track, day, source_language, search });
    
    return NextResponse.json({
      status: 'success',
      data: {
        sessions,
        total,
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Sessions:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen der Sessions: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * Erstellt neue Sessions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SessionCreateRequest;
    
    console.log('[API] POST /api/sessions - Request Body:', JSON.stringify(body, null, 2));
    
    // Validierung der Eingabedaten
    if (!body.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine gültigen Sessions angegeben' },
        { status: 400 }
      );
    }
    
    // Validierung der einzelnen Session-Felder
    for (let i = 0; i < body.sessions.length; i++) {
      const session = body.sessions[i];
      const requiredFields = ['session', 'filename', 'track', 'video_url', 'event', 'url', 'day', 'starttime', 'endtime', 'speakers', 'source_language'];
      
      for (const field of requiredFields) {
        if (!session[field as keyof typeof session]) {
          return NextResponse.json(
            { 
              status: 'error', 
              message: `Session ${i + 1}: Erforderliches Feld '${field}' fehlt oder ist leer`,
              details: { sessionIndex: i, missingField: field, sessionData: session }
            },
            { status: 400 }
          );
        }
      }
      
      // Validierung des speakers Arrays
      if (!Array.isArray(session.speakers) || session.speakers.length === 0) {
        return NextResponse.json(
          { 
            status: 'error', 
            message: `Session ${i + 1}: 'speakers' muss ein nicht-leeres Array sein`,
            details: { sessionIndex: i, speakers: session.speakers }
          },
          { status: 400 }
        );
      }
    }
    
    // Sessions erstellen
    const sessionIds = await repository.createSessions(body.sessions);
    
    console.log('[API] POST /api/sessions - Sessions erstellt:', sessionIds);
    
    return NextResponse.json(
      { 
        status: 'success', 
        message: `${sessionIds.length} Sessions erfolgreich erstellt`,
        data: { sessionIds }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Erstellen der Sessions:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Erstellen der Sessions: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions
 * Löscht mehrere Sessions
 */
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json() as { ids: string[] };
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine gültigen Session-IDs angegeben' },
        { status: 400 }
      );
    }
    
    const deletedCount = await repository.deleteSessions(ids);
    
    return NextResponse.json({
      status: 'success',
      message: `${deletedCount} Sessions erfolgreich gelöscht`,
      data: { deletedCount }
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Sessions:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Löschen der Sessions: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 