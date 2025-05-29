import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import * as process from 'process';

/**
 * API-Route, die die OAuth-Standardwerte aus der .env zurückgibt
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Nur noch redirectUri aus der Umgebung liefern
    const redirectUri = process.env.MS_REDIRECT_URI || '';
    
    // Logge die Anwesenheit der redirectUri
    console.log('[OAuthDefaults] Umgebungsvariable:', {
      hasRedirectUri: !!redirectUri
    });
    
    // Prüfe, ob redirectUri vorhanden ist
    const hasDefaults = !!redirectUri;
    
    return NextResponse.json({
      hasDefaults,
      defaults: hasDefaults ? {
        redirectUri
      } : null
    });
  } catch (error) {
    console.error('[OAuthDefaults] Fehler:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 