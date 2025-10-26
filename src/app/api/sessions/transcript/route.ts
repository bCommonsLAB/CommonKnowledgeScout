import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/session-repository';

const repository = new SessionRepository();

/**
 * PATCH /api/sessions/transcript
 * Body: { event: string; session: string; url: string; filename: string; transcript_text: string }
 * Aktualisiert das Plaintext-Transcript einer bestehenden Session.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { event, session, url, filename, transcript_text } = await request.json();
    if (!event || !session || !url || !filename || typeof transcript_text !== 'string') {
      return NextResponse.json({ status: 'error', message: 'Fehlende Felder' }, { status: 400 });
    }
    const ok = await repository.updateSessionByKeys({ event, session, url, filename }, { transcript_text });
    if (!ok) {
      return NextResponse.json({ status: 'error', message: 'Session nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('[API] PATCH /api/sessions/transcript Fehler:', error);
    return NextResponse.json({ status: 'error', message: 'Interner Fehler' }, { status: 500 });
  }
}



