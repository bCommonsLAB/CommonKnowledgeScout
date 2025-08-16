import { NextResponse } from 'next/server';

declare const process: {
  env: {
    MS_REDIRECT_URI?: string;
  };
};

/**
 * API-Route, die die OAuth-Standardwerte aus der .env zurückgibt
 */
export async function GET() {
  try {
    // Nur noch redirectUri aus der Umgebung liefern (kein auth-Erfordernis)
    const redirectUri = process.env.MS_REDIRECT_URI || '';

    console.log('[OAuthDefaults] Umgebungsvariable:', {
      redirectUri: redirectUri
    });

    const hasDefaults = !!redirectUri;

    return NextResponse.json({
      hasDefaults,
      defaults: hasDefaults ? { redirectUri } : null
    });
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}