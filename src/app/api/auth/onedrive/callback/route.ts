/**
 * @fileoverview OAuth-Callback der OneDrive-Anmeldung.
 *
 * Seit Teil A des Plans speicher-verbindungen-und-library-anlage wird nur noch
 * an der Speicher-Verbindung angemeldet (state traegt `connectionId`); der
 * fruehere Library-Flow (state `libraryId`, temporaere Tokens in der
 * Library-Config) ist entfallen. Die Tokens landen verschluesselt an der
 * Verbindung, der Browser kehrt an den im state genannten Pfad zurueck.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { handleOneDriveConnectionCallback, STORAGE_CONNECTIONS_PATH } from '@/lib/storage-connections/onedrive-callback';

/** Base-URL: Umgebung vor Redirect-URI vor Host-Header (wie bisher). */
function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.MS_REDIRECT_URI) {
    try {
      const u = new URL(process.env.MS_REDIRECT_URI);
      return `${u.protocol}//${u.host}`;
    } catch (error) {
      console.error('[OneDrive Auth Callback] MS_REDIRECT_URI nicht lesbar:', error);
    }
  }
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = getBaseUrl(request);

  let connectionId: string | null = null;
  let redirect: string | null = null;
  const stateRaw = searchParams.get('state');
  if (stateRaw) {
    try {
      const stateObj = JSON.parse(stateRaw) as { connectionId?: unknown; redirect?: unknown };
      connectionId = typeof stateObj.connectionId === 'string' ? stateObj.connectionId : null;
      redirect = typeof stateObj.redirect === 'string' ? stateObj.redirect : null;
    } catch (error) {
      console.error('[OneDrive Auth Callback] state nicht lesbar:', error);
    }
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL('/signin', baseUrl));
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress;
  if (!userEmail) {
    return NextResponse.redirect(new URL(`${STORAGE_CONNECTIONS_PATH}?onedrive=error&message=no_email`, baseUrl));
  }

  if (!connectionId) {
    const message = 'Der Rueckruf traegt keine Verbindungs-Id. Anmeldung bitte unter Mein Konto → Speicher-Verbindungen starten.';
    return NextResponse.redirect(new URL(`${STORAGE_CONNECTIONS_PATH}?onedrive=error&message=${encodeURIComponent(message)}`, baseUrl));
  }

  const ziel = await handleOneDriveConnectionCallback({
    userEmail,
    connectionId,
    code: searchParams.get('code'),
    error: searchParams.get('error'),
    errorDescription: searchParams.get('error_description'),
    redirect,
    baseUrl,
  });
  return NextResponse.redirect(ziel);
}
