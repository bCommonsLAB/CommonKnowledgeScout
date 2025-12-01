import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'

export async function POST(req: NextRequest) {
  try {
    const isInternal = req.headers.get('x-internal-request') === '1'
    const emailParam = req.nextUrl.searchParams.get('email') || undefined
    if (!isInternal) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = isInternal ? null : await currentUser()
    const email = emailParam || user?.emailAddresses?.[0]?.emailAddress
    if (!email) return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })

    const body = await req.json()
    const { libraryId, refreshToken } = body as { libraryId?: string; refreshToken?: string }
    if (!libraryId || !refreshToken) {
      return NextResponse.json({ error: 'libraryId und refreshToken erforderlich' }, { status: 400 })
    }

    // OneDrive Token-Endpoint
    const client = LibraryService.getInstance()
    const libraries = await client.getUserLibraries(email)
    const lib = libraries.find(l => l.id === libraryId)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const tenantId = lib.config?.tenantId || 'common'
    const clientId = lib.config?.clientId
    const clientSecret = lib.config?.clientSecret
    const redirectUri = lib.config?.redirectUri || process.env.MS_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'OneDrive OAuth-Konfiguration unvollständig' }, { status: 400 })
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
      grant_type: 'refresh_token',
    })

    const resp = await fetch(tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
    if (!resp.ok) {
      const txt = await resp.text()
      let errorDetails = txt.slice(0, 500)
      
      // Prüfe auf häufigen Fehler: Invalid client secret
      try {
        const errorJson = JSON.parse(txt)
        if (errorJson.error === 'invalid_client' || errorJson.error_description?.includes('AADSTS7000215')) {
          errorDetails = `Ungültiges Client Secret. Bitte verwenden Sie den Client Secret VALUE (nicht die ID). 
          
Der Client Secret VALUE ist der lange String, den Sie beim Erstellen des Secrets erhalten haben. 
Die Client Secret ID beginnt oft mit einem GUID-Format.

Original-Fehler: ${errorJson.error_description || txt.slice(0, 200)}`
        }
      } catch {
        // Wenn JSON-Parsing fehlschlägt, verwende den ursprünglichen Text
      }
      
      console.error('[OneDrive Refresh] Token-Refresh fehlgeschlagen:', {
        libraryId,
        errorDetails,
        hasClientSecret: !!clientSecret,
        clientSecretLength: clientSecret?.length || 0,
        clientSecretPreview: clientSecret ? `${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)}` : 'N/A'
      })
      
      return NextResponse.json({ error: 'Token-Refresh fehlgeschlagen', details: errorDetails }, { status: 502 })
    }
    const data = await resp.json()
    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}