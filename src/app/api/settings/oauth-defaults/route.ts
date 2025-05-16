import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as process from 'process';

/**
 * API-Route, die die OAuth-Standardwerte aus der .env zurückgibt
 */
export async function GET(request: NextRequest) {
  // Authentifizierung des Benutzers prüfen
  const { userId } = await auth();
  if (!userId) {
    console.log('[oauth-defaults] Nicht authentifiziert');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Debug-Logging der Umgebungsvariablen (ohne die Werte selbst zu loggen)
  console.log('[oauth-defaults] Umgebungsvariablen:');
  console.log('[oauth-defaults] MS_TENANT_ID:', process.env.MS_TENANT_ID ? 'vorhanden' : 'nicht vorhanden');
  console.log('[oauth-defaults] MS_CLIENT_ID:', process.env.MS_CLIENT_ID ? 'vorhanden' : 'nicht vorhanden');
  console.log('[oauth-defaults] MS_CLIENT_SECRET:', process.env.MS_CLIENT_SECRET ? 'vorhanden' : 'nicht vorhanden');
  console.log('[oauth-defaults] MS_REDIRECT_URI:', process.env.MS_REDIRECT_URI ? 'vorhanden' : 'nicht vorhanden');

  // Standardwerte aus der .env-Datei auslesen - keine Maskierung
  const defaults = {
    tenantId: process.env.MS_TENANT_ID || 'common',
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    redirectUri: process.env.MS_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/onedrive/callback`,
  };

  // Erzwinge hasDefaults = true, da wir Fallback-Werte haben
  const hasDefaults = true;

  console.log('[oauth-defaults] hasDefaults:', hasDefaults);
  
  // Logging der zurückgegebenen Werte - nur Hinweis, dass Werte vorhanden sind
  console.log('[oauth-defaults] Zurückgegebene Werte:', {
    tenantId: defaults.tenantId,
    clientId: defaults.clientId ? 'vorhanden' : 'nicht vorhanden',
    clientSecret: defaults.clientSecret ? 'vorhanden' : 'nicht vorhanden',
    redirectUri: defaults.redirectUri,
  });

  return NextResponse.json({
    defaults,
    hasDefaults
  });
} 