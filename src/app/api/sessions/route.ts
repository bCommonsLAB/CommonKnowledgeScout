import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/session-repository';
import { SessionCreateRequest } from '@/types/session';

// Next.js Route Segment Config: Kein Caching für Sessions
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // Wenn kein Limit angegeben ist, alle Sessions laden (kein Limit)
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;
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
        limit: limit ?? sessions.length, // Falls kein Limit gesetzt, verwende die Anzahl der geladenen Sessions
        skip
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
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
    // Pflichtfelder: session, filename, event, track
    // Optionale Felder: image_url, video_url, url, day, starttime, endtime, speakers, source_language, target_language, subtitle, description, attachments_url
    for (let i = 0; i < body.sessions.length; i++) {
      const session = body.sessions[i];
      const requiredFields = ['session', 'filename', 'event', 'track'];
      
      // Prüfung der Pflichtfelder
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
      
      // Optionale Felder werden toleriert - keine Validierung erforderlich
      // Falls speakers vorhanden ist, sicherstellen dass es ein Array ist (kann leer sein)
      if (session.speakers && !Array.isArray(session.speakers)) {
        return NextResponse.json(
          { 
            status: 'error', 
            message: `Session ${i + 1}: 'speakers' muss ein Array sein (falls angegeben)`,
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