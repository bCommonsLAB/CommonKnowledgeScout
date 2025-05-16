import { NextRequest, NextResponse } from 'next/server';

/**
 * Microsoft OAuth2 Callback-Handler
 * 
 * Diese Route empfängt den Authentifizierungscode von Microsoft und leitet ihn
 * an die eigentliche API-Route für die OneDrive-Authentifizierung weiter.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const sessionState = searchParams.get('session_state');

  console.log(`[Microsoft Auth Callback] Received: code=${!!code}, state=${state}, error=${error}`);

  // Weiterleitungs-URL erstellen zur eigentlichen API-Route
  const redirectUrl = new URL('/api/auth/onedrive/callback', request.url);
  
  // Parameter weitergeben
  if (code) redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);
  if (error) redirectUrl.searchParams.set('error', error);
  if (errorDescription) redirectUrl.searchParams.set('error_description', errorDescription);
  if (sessionState) redirectUrl.searchParams.set('session_state', sessionState);

  console.log(`[Microsoft Auth Callback] Redirecting to: ${redirectUrl.toString()}`);
  
  // Mit 307 weiterleiten, um die Anfrage-Methode (GET) beizubehalten
  return NextResponse.redirect(redirectUrl, { status: 307 });
} 