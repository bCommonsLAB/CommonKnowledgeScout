import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SettingsLogger } from '@/lib/debug/logger';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webdavUrl = searchParams.get('url');
    const username = searchParams.get('username');
    const password = searchParams.get('password');
    const path = searchParams.get('path') || '/';
    const method = searchParams.get('method') || 'PROPFIND';

    if (!webdavUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Behebe doppelte Slashes in der URL
    const cleanWebdavUrl = webdavUrl.endsWith('/') ? webdavUrl.slice(0, -1) : webdavUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${cleanWebdavUrl}${cleanPath}`;

    // Detailliertes Logging für Debugging
    SettingsLogger.info('WebDAV Direct API', 'Request Details', {
      method,
      path,
      originalWebdavUrl: webdavUrl,
      cleanWebdavUrl,
      cleanPath,
      fullUrl,
      username: username ? 'vorhanden' : 'fehlt',
      password: password ? 'vorhanden' : 'fehlt',
      hasUrl: !!webdavUrl,
      hasUsername: !!username,
      hasPassword: !!password
    });

    // Erstelle Basic Auth Header
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    
    // Logge die Request-Details
    SettingsLogger.info('WebDAV Direct API', 'Making Request', {
      url: fullUrl,
      method,
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader.length
    });
    
    // Erstelle Request-Headers und Body für PROPFIND
    const headers: Record<string, string> = {
      'Authorization': authHeader
    };
    
    let body: string | undefined;
    
    if (method === 'PROPFIND') {
      headers['Depth'] = '1';
      headers['Content-Type'] = 'application/xml';
      // XML-Body für PROPFIND (wie im funktionierenden curl-Befehl)
      body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>';
      
      SettingsLogger.info('WebDAV Direct API', 'PROPFIND Body', {
        body,
        bodyLength: body.length
      });
    }
    
    // Führe WebDAV-Request aus
    const response = await fetch(fullUrl, {
      method,
      headers,
      body
    });

    SettingsLogger.info('WebDAV Direct API', 'Response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      // Logge den Fehler detailliert
      const errorText = await response.text();
      SettingsLogger.error('WebDAV Direct API', 'Request failed', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500) // Erste 500 Zeichen
      });
      
      return NextResponse.json(
        { error: `WebDAV request failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  } catch (error) {
    console.error('WebDAV Direct API error:', error);
    SettingsLogger.error('WebDAV Direct API', 'Exception', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[WebDAV Direct API] POST Request empfangen');
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log('[WebDAV Direct API] Auth fehlgeschlagen');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webdavUrl = searchParams.get('url');
    const username = searchParams.get('username');
    const password = searchParams.get('password');
    const path = searchParams.get('path') || '/';
    const method = searchParams.get('method') || 'MKCOL';

    console.log('[WebDAV Direct API] Parameter erhalten:', {
      method,
      path,
      hasUrl: !!webdavUrl,
      hasUsername: !!username,
      hasPassword: !!password,
      // DEBUG: Zeige die tatsächlichen Werte
      username: username,
      password: password,  // Vollständiges Passwort zeigen für Debug
      passwordLength: password ? password.length : 0,
      webdavUrl: webdavUrl
    });

    if (!webdavUrl || !username || !password) {
      console.log('[WebDAV Direct API] Fehlende Parameter');
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Behebe doppelte Slashes in der URL
    const cleanWebdavUrl = webdavUrl.endsWith('/') ? webdavUrl.slice(0, -1) : webdavUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${cleanWebdavUrl}${cleanPath}`;

    console.log('[WebDAV Direct API] URL bereinigt:', {
      originalWebdavUrl: webdavUrl,
      cleanWebdavUrl,
      cleanPath,
      fullUrl
    });

    SettingsLogger.info('WebDAV Direct API', 'POST Request', {
      method,
      path,
      originalWebdavUrl: webdavUrl,
      cleanWebdavUrl,
      cleanPath,
      fullUrl,
      hasUrl: !!webdavUrl,
      hasUsername: !!username,
      hasPassword: !!password
    });

    // Erstelle Basic Auth Header
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    
    console.log('[WebDAV Direct API] Authorization Header erstellt:', {
      username,
      passwordLength: password ? password.length : 0,
      authHeaderPrefix: authHeader.substring(0, 15) + '***',
      authHeaderLength: authHeader.length
    });
    
    // Behandle PROPFIND-Requests (vom WebDAVProvider als POST gesendet)
    if (method === 'PROPFIND') {
      console.log('[WebDAV Direct API] PROPFIND Request erkannt');
      // Lade den XML-Body aus dem Request
      const xmlBody = await request.text();
      
      console.log('[WebDAV Direct API] XML-Body erhalten:', {
        xmlBody,
        bodyLength: xmlBody.length
      });
      
      SettingsLogger.info('WebDAV Direct API', 'PROPFIND Request', {
        xmlBody,
        bodyLength: xmlBody.length
      });
      
      // Führe WebDAV PROPFIND-Request aus
      console.log('[WebDAV Direct API] Sende PROPFIND an WebDAV-Server:', fullUrl);
      const startTime = performance.now();
      const response = await fetch(fullUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '1',
          'Content-Type': 'application/xml'
        },
        body: xmlBody
      });
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      console.log('[WebDAV Direct API] PROPFIND Response erhalten:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${duration}ms`
      });
      
      SettingsLogger.info('WebDAV Direct API', 'PROPFIND Response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[WebDAV Direct API] PROPFIND fehlgeschlagen:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500)
        });
        
        SettingsLogger.error('WebDAV Direct API', 'PROPFIND failed', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500)
        });
        
        return NextResponse.json(
          { error: `WebDAV request failed: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      const text = await response.text();
      console.log('[WebDAV Direct API] PROPFIND erfolgreich, Response-Länge:', text.length);
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml'
        }
      });
    }
    
    // Lade Body falls vorhanden
    if (method === 'PUT') {
      // Für PUT-Requests (Datei-Upload)
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (file) {
        const buffer = await file.arrayBuffer();
        
        // Führe WebDAV-Request mit Buffer aus
        const response = await fetch(fullUrl, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/octet-stream'
          },
          body: buffer
        });
        
        SettingsLogger.info('WebDAV Direct API', 'POST Response', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: `WebDAV request failed: ${response.status} ${response.statusText}` },
            { status: response.status }
          );
        }

        return NextResponse.json({ success: true });
      }
    }

    // Für andere Methoden (MKCOL etc.)
    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml'
      }
    });

    SettingsLogger.info('WebDAV Direct API', 'POST Response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WebDAV request failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WebDAV Direct API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const webdavUrl = searchParams.get('url');
    const username = searchParams.get('username');
    const password = searchParams.get('password');
    const path = searchParams.get('path') || '/';

    if (!webdavUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Behebe doppelte Slashes in der URL
    const cleanWebdavUrl = webdavUrl.endsWith('/') ? webdavUrl.slice(0, -1) : webdavUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${cleanWebdavUrl}${cleanPath}`;

    SettingsLogger.info('WebDAV Direct API', 'DELETE Request', {
      path,
      originalWebdavUrl: webdavUrl,
      cleanWebdavUrl,
      cleanPath,
      fullUrl,
      hasUrl: !!webdavUrl,
      hasUsername: !!username,
      hasPassword: !!password
    });

    // Erstelle Basic Auth Header
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    
    // Führe WebDAV-Request aus
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader
      }
    });

    SettingsLogger.info('WebDAV Direct API', 'DELETE Response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WebDAV request failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WebDAV Direct API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 