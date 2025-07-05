import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/session-repository';
import { Session } from '@/types/session';

const repository = new SessionRepository();

/**
 * GET /api/sessions/[id]
 * Gibt eine einzelne Session zurück
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await repository.getSession(id);
    
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Session nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      data: { session }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Session:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen der Session: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sessions/[id]
 * Aktualisiert eine Session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await request.json() as Partial<Session>;
    
    // Entferne id, created_at aus Updates
    const validUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => key !== 'id' && key !== 'created_at'));
    
    const success = await repository.updateSession(id, validUpdates);
    
    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Session nicht gefunden oder nicht aktualisiert' },
        { status: 404 }
      );
    }
    
    // Aktualisierte Session zurückgeben
    const updatedSession = await repository.getSession(id);
    
    return NextResponse.json({
      status: 'success',
      message: 'Session erfolgreich aktualisiert',
      data: { session: updatedSession }
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Session:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Aktualisieren der Session: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * Löscht eine Session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const success = await repository.deleteSession(id);
    
    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Session nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Session erfolgreich gelöscht'
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Session:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Löschen der Session: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
} 