import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, existsSync } from 'fs';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageItem } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';
import { AuthLogger } from '@/lib/debug/logger';

// Force dynamic rendering - verhindert Caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Debug-Zeitstempel für jeden Request
const REQUEST_ID = () => `REQ_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 */
async function getUserEmail(request: NextRequest): Promise<string | undefined> {
  const searchParams = request.nextUrl.searchParams;
  const emailParam = searchParams.get('email');
  
  // Debug: Cookie-Analyse
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...value] = c.trim().split('=');
        return [key, value.join('=')];
      })
    );
    AuthLogger.cookieAnalysis('FileSystemAPI', cookies);
  }
  
  AuthLogger.debug('FileSystemAPI', 'getUserEmail called', {
    hasEmailParam: !!emailParam,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  });

  console.log('[API][getUserEmail] 🔍 Suche nach E-Mail:', {
    hasEmailParam: !!emailParam,
    emailParam,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString()
  });
  
  // Wenn ein Email-Parameter übergeben wurde, diesen verwenden (für Tests)
  if (emailParam) {
    AuthLogger.info('FileSystemAPI', 'Using email parameter for auth bypass');
    console.log('[API][getUserEmail] ✅ Verwende Email-Parameter:', emailParam);
    return emailParam;
  }
  
  // Versuche, authentifizierten Benutzer zu erhalten
  try {
    AuthLogger.debug('FileSystemAPI', 'Attempting Clerk server-side auth');
    console.log('[API][getUserEmail] 🔐 Versuche Clerk-Authentifizierung...');
    
    const { userId } = await auth();
    
    AuthLogger.serverAuth('FileSystemAPI', { userId });
    console.log('[API][getUserEmail] 👤 Clerk-Auth Ergebnis:', {
      hasUserId: !!userId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    if (userId) {
      AuthLogger.debug('FileSystemAPI', 'Fetching current user details');
      console.log('[API][getUserEmail] 🔍 Hole User-Details...');
      const user = await currentUser();
      
      AuthLogger.serverAuth('FileSystemAPI', { userId, user });
      console.log('[API][getUserEmail] 👤 User-Details:', {
        hasUser: !!user,
        userId: user?.id,
        emailAddressesCount: user?.emailAddresses?.length,
        primaryEmail: user?.emailAddresses?.[0]?.emailAddress,
        timestamp: new Date().toISOString()
      });
      
      const emailAddresses = user?.emailAddresses || [];
      
      if (user && emailAddresses.length > 0) {
        const email = emailAddresses[0].emailAddress;
        AuthLogger.info('FileSystemAPI', 'Successfully retrieved user email');
        console.log('[API][getUserEmail] ✅ E-Mail gefunden:', email);
        return email;
      } else {
        AuthLogger.warn('FileSystemAPI', 'User has no email addresses', {
          hasUser: !!user,
          emailAddressesCount: emailAddresses.length
        });
        console.warn('[API][getUserEmail] ⚠️ User hat keine E-Mail-Adressen:', {
          hasUser: !!user,
          emailAddressesCount: emailAddresses.length
        });
      }
    } else {
      AuthLogger.warn('FileSystemAPI', 'No userId returned from Clerk auth()');
      console.warn('[API][getUserEmail] ⚠️ Keine User-ID von Clerk erhalten');
    }
  } catch (error) {
    AuthLogger.error('FileSystemAPI', 'Clerk authentication failed', error);
    console.error('[API][getUserEmail] 💥 Fehler bei Clerk-Authentifizierung:', {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3)
      } : error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Fallback: Versuche E-Mail aus Headers zu extrahieren
  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    AuthLogger.debug('FileSystemAPI', 'Attempting header fallback', {
      hasAuthHeader: !!authHeader,
      hasCookieHeader: !!cookieHeader,
      authHeaderLength: authHeader?.length,
      cookieHeaderLength: cookieHeader?.length
    });
    
    console.log('[API][getUserEmail] 🔍 Fallback: Prüfe Headers:', {
      hasAuthHeader: !!authHeader,
      hasCookieHeader: !!cookieHeader,
      authHeaderLength: authHeader?.length,
      cookieHeaderLength: cookieHeader?.length
    });
    
    // Hier könnten weitere Fallback-Logiken implementiert werden
    // z.B. E-Mail aus JWT-Token extrahieren
    
  } catch (fallbackError) {
    AuthLogger.error('FileSystemAPI', 'Header fallback failed', fallbackError);
    console.error('[API][getUserEmail] 💥 Fallback-Fehler:', fallbackError);
  }
  
  AuthLogger.error('FileSystemAPI', 'All authentication methods failed - no email found');
  console.error('[API][getUserEmail] ❌ Keine E-Mail gefunden - alle Methoden fehlgeschlagen');
  return undefined;
}

async function getLibrary(libraryId: string, email: string): Promise<LibraryType | undefined> {
  console.log(`[API][getLibrary] Suche nach Bibliothek:`, {
    libraryId,
    email,
    timestamp: new Date().toISOString()
  });
  
  // Bibliothek aus MongoDB abrufen
  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(email);
  
  
  if (libraries.length === 0) {
    return undefined;
  }
  
  const match = libraries.find(lib => lib.id === libraryId && lib.isEnabled);
  if (match) {
    return match;
  }
  return undefined;
}


// Konvertiert eine ID zurück in einen Pfad
function getPathFromId(library: LibraryType, fileId: string): string {
  console.log('[getPathFromId] 🔍 Input:', { 
    fileId, 
    libraryPath: library.path,
    libraryId: library.id,
    timestamp: new Date().toISOString()
  });
  
  if (fileId === 'root') {
    console.log('[getPathFromId] 🏠 Root-Pfad erkannt, verwende Library-Pfad:', library.path);
    return library.path;
  }
  
  try {
    const decodedPath = Buffer.from(fileId, 'base64').toString();
    console.log('[getPathFromId] 🔓 Decoded path:', {
      originalId: fileId,
      decodedPath,
      decodedLength: decodedPath.length
    });
    
    // Always treat decoded path as relative path and normalize it
    const normalizedPath = decodedPath.replace(/\\/g, '/');
    console.log('[getPathFromId] 🔧 Normalized path:', {
      original: decodedPath,
      normalized: normalizedPath
    });
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      console.log('[getPathFromId] ⚠️ Path traversal detected, returning root');
      return library.path;
    }
    
    // Join with base path using pathLib.join to handle separators correctly
    const result = pathLib.join(library.path, normalizedPath);
    console.log('[getPathFromId] 🔗 Joined path:', {
      basePath: library.path,
      relativePath: normalizedPath,
      result: result
    });
    
    // Double check the result is within the library path
    const normalizedResult = pathLib.normalize(result).replace(/\\/g, '/');
    const normalizedLibPath = pathLib.normalize(library.path).replace(/\\/g, '/');
    
    console.log('[getPathFromId] 🔒 Security check:', {
      normalizedResult,
      normalizedLibPath,
      startsWithLibPath: normalizedResult.startsWith(normalizedLibPath)
    });
    
    // Verbesserte Sicherheitsprüfung für Windows-Pfade
    let isWithinLibrary = false;
    
    // Fall 1: Standard-Prüfung
    if (normalizedResult.startsWith(normalizedLibPath)) {
      isWithinLibrary = true;
    }
    // Fall 2: Windows-Laufwerk-Prüfung (z.B. W: vs W:/)
    else if (normalizedLibPath.endsWith(':') && normalizedResult.startsWith(normalizedLibPath + '/')) {
      isWithinLibrary = true;
    }
    // Fall 3: Windows-Laufwerk mit Punkt (z.B. W:. vs W:/)
    else if (normalizedLibPath.endsWith(':.') && normalizedResult.startsWith(normalizedLibPath.slice(0, -1) + '/')) {
      isWithinLibrary = true;
    }
    
    if (!isWithinLibrary) {
      console.log('[getPathFromId] 🚫 Path escape detected, returning root');
      return library.path;
    }
    
    console.log('[getPathFromId] ✅ Final result:', {
      inputId: fileId,
      finalPath: result,
      exists: existsSync(result)
    });
    return result;
  } catch (error) {
    console.error('[getPathFromId] 💥 Error decoding path:', {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name
      } : error,
      fileId,
      libraryPath: library.path
    });
    return library.path;
  }
}

// Konvertiert einen Pfad in eine ID
function getIdFromPath(library: LibraryType, absolutePath: string): string {
  
  if (absolutePath === library.path) return 'root';
  
  // Normalize both paths to use forward slashes
  const normalizedBasePath = pathLib.normalize(library.path).replace(/\\/g, '/');
  const normalizedPath = pathLib.normalize(absolutePath).replace(/\\/g, '/');
  
  // Get relative path by removing base path
  const relativePath = pathLib.relative(normalizedBasePath, normalizedPath)
    .replace(/\\/g, '/') // Normalize to forward slashes
    .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
  
  // If path tries to go up, return root
  if (relativePath.includes('..')) {
    return 'root';
  }
    
  
  const result = relativePath ? Buffer.from(relativePath).toString('base64') : 'root';
  return result;
}

// Konvertiert Stats in ein StorageItem
async function statsToStorageItem(library: LibraryType, absolutePath: string, stats: Stats): Promise<StorageItem> {
  const id = getIdFromPath(library, absolutePath);
  const parentPath = pathLib.dirname(absolutePath);
  const parentId = parentPath === library.path ? 'root' : getIdFromPath(library, parentPath);

  return {
    id,
    parentId,
    type: stats.isDirectory() ? 'folder' : 'file',
    metadata: {
      name: pathLib.basename(absolutePath),
      size: stats.size,
      mimeType: stats.isFile() ? mime.lookup(absolutePath) || 'application/octet-stream' : 'folder',
      modifiedAt: stats.mtime
    }
  };
}

// Listet Items in einem Verzeichnis
async function listItems(library: LibraryType, fileId: string): Promise<StorageItem[]> {
  console.log(`[API] GET listItems fileId=${fileId}, Bibliothek=${library.id}, Pfad="${library.path}"`);
  
  const absolutePath = getPathFromId(library, fileId);
  console.log(`[API] Absoluter Pfad für Verzeichnisauflistung: "${absolutePath}"`);
  
  try {
    // Prüfe zuerst, ob das Verzeichnis existiert
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      console.error(`[API] Pfad ist kein Verzeichnis: "${absolutePath}"`);
      const error = new Error(`Der angegebene Pfad ist kein Verzeichnis: ${absolutePath}`);
      error.name = 'NotDirectoryError';
      throw error;
    }
    
    const items = await fs.readdir(absolutePath);
    
    const itemPromises = items.map(async (item) => {
      const itemPath = pathLib.join(absolutePath, item);
      try {
        const stats = await fs.stat(itemPath);
        return statsToStorageItem(library, itemPath, stats);
      } catch {
        return null;
      }
    });

    const results = await Promise.all(itemPromises);
    const validResults = results.filter((item): item is StorageItem => item !== null);
    
    return validResults;
  } catch (error) {
    console.error(`[API] Fehler beim Lesen des Verzeichnisses "${absolutePath}":`, error);
    
    // Spezifische Fehlerbehandlung für verschiedene Fehlertypen
    if (error instanceof Error) {
      // NodeJS SystemError hat eine code Eigenschaft
      const nodeError = error as Error & { code?: string };
      if (nodeError.code === 'ENOENT') {
        // Verzeichnis existiert nicht
        const specificError = new Error(`Die Bibliothek "${library.label}" konnte nicht gefunden werden. Pfad: "${library.path}"`);
        specificError.name = 'LibraryPathNotFoundError';
        throw specificError;
      } else if (nodeError.code === 'EACCES') {
        // Keine Berechtigung
        const specificError = new Error(`Keine Berechtigung für den Zugriff auf die Bibliothek "${library.label}". Pfad: "${library.path}"`);
        specificError.name = 'LibraryAccessDeniedError';
        throw specificError;
      } else if (error.name === 'NotDirectoryError') {
        // Bereits behandelt
        throw error;
      }
    }
    
    // Für alle anderen Fehler
    throw error;
  }
}

/**
 * Verarbeitet Anfragen, wenn eine Bibliothek nicht gefunden wurde
 */
async function handleLibraryNotFound(libraryId: string, userEmail?: string): Promise<NextResponse> {
  
  return NextResponse.json({ 
    error: `Bibliothek mit ID: ${libraryId} nicht gefunden`,
    errorCode: 'LIBRARY_NOT_FOUND',
    libraryId: libraryId,
    userEmail: userEmail
  }, { status: 404 });
}

export async function GET(request: NextRequest) {
  // TEST: Sofortige Response um zu sehen ob die Route überhaupt erreicht wird
  const testParam = request.nextUrl.searchParams.get('test');
  if (testParam === 'ping') {
    return new NextResponse('PONG - Route is reachable!', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Test-Response': 'true',
        'X-Timestamp': new Date().toISOString()
      }
    });
  }
  
  
  const requestId = REQUEST_ID();
  
  // Auch in die Response schreiben
  const debugHeaders = new Headers();
  debugHeaders.set('X-Debug-Request-Id', requestId);
  debugHeaders.set('X-Debug-Timestamp', new Date().toISOString());
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const fileId = url.searchParams.get('fileId');
  const libraryId = url.searchParams.get('libraryId');
  
  console.log(`[API][filesystem] GET Request:`, {
    requestId,
    action,
    fileId,
    libraryId,
    timestamp: new Date().toISOString()
  });
  
  // Validiere erforderliche Parameter
  if (!libraryId) {
    console.warn(`[API][filesystem] ❌ Fehlender libraryId Parameter`);
    return NextResponse.json({ 
      error: 'libraryId is required',
      errorCode: 'MISSING_LIBRARY_ID',
      requestId 
    }, { status: 400 });
  }

  if (!fileId) {
    console.warn(`[API][filesystem] ❌ Fehlender fileId Parameter`);
    return NextResponse.json({ 
      error: 'fileId is required',
      errorCode: 'MISSING_FILE_ID',
      requestId 
    }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    console.warn(`[API][filesystem] ❌ Keine E-Mail gefunden`);
    return NextResponse.json({ 
      error: 'No user email found',
      errorCode: 'NO_USER_EMAIL',
      requestId 
    }, { status: 400 });
  }

  console.log(`[API][filesystem] Benutzer-E-Mail gefunden:`, userEmail);

  const library = await getLibrary(libraryId, userEmail);

  if (!library) {
    console.warn(`[API][filesystem] ❌ Bibliothek nicht gefunden`);
    return handleLibraryNotFound(libraryId, userEmail);
  }

  console.log(`[API][filesystem] Bibliothek gefunden:`, {
    libraryId: library.id,
    libraryLabel: library.label,
    libraryPath: library.path,
    libraryType: library.type
  });

  try {
    switch (action) {
      case 'list': {
        console.log(`[API][filesystem][list] Starte Verzeichnisauflistung:`, {
          requestId,
          fileId,
          libraryId,
          libraryPath: library.path
        });
        
        const items = await listItems(library, fileId);
        
        console.log(`[API][filesystem][list] Erfolgreich ${items.length} Items geladen:`, {
          requestId,
          itemCount: items.length,
          fileId
        });
        
        return NextResponse.json(items, { headers: debugHeaders });
      }

      case 'get': {
        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        const item = await statsToStorageItem(library, absolutePath, stats);
        return NextResponse.json(item, { headers: debugHeaders });
      }

      case 'binary': {
        console.log(`[API][filesystem][binary] 🖼️ Binary-Request gestartet:`, {
          requestId,
          fileId,
          libraryId,
          userEmail,
          timestamp: new Date().toISOString()
        });

        if (!fileId || fileId === 'root') {
          console.error('[API][filesystem] Ungültige Datei-ID für binary:', {
            fileId,
            libraryId,
            userEmail
          });
          return NextResponse.json({ 
            error: 'Invalid file ID',
            errorCode: 'INVALID_FILE_ID',
            requestId 
          }, { status: 400 });
        }

        const absolutePath = getPathFromId(library, fileId);
        console.log(`[API][filesystem][binary] 📁 Absoluter Pfad:`, {
          fileId,
          absolutePath,
          libraryPath: library.path
        });

        const stats = await fs.stat(absolutePath);
        console.log(`[API][filesystem][binary] 📊 Datei-Statistiken:`, {
          isFile: stats.isFile(),
          size: stats.size,
          mtime: stats.mtime,
          path: absolutePath
        });
        
        if (!stats.isFile()) {
          console.error('[API][filesystem] Keine Datei:', {
            path: absolutePath,
            libraryId,
            fileId,
            userEmail
          });
          return NextResponse.json({ 
            error: 'Not a file',
            errorCode: 'NOT_A_FILE',
            requestId 
          }, { status: 400 });
        }

        console.log(`[API][filesystem][binary] 📖 Lade Dateiinhalt...`);
        const content = await fs.readFile(absolutePath);
        console.log(`[API][filesystem][binary] ✅ Dateiinhalt geladen:`, {
          contentLength: content.length,
          expectedSize: stats.size,
          matches: content.length === stats.size
        });

        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        console.log(`[API][filesystem][binary] 🏷️ MIME-Type erkannt:`, {
          mimeType,
          filename: pathLib.basename(absolutePath),
          extension: pathLib.extname(absolutePath)
        });
        
        // Spezielle Headers für PDFs, damit sie im Browser angezeigt werden
        const headers: HeadersInit = {
          'Content-Type': mimeType,
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'no-store',
          'X-Debug-Request-Id': requestId,
          'X-Debug-File-Path': absolutePath,
          'X-Debug-File-Size': stats.size.toString(),
          'X-Debug-Mime-Type': mimeType
        };
        
        // Für PDFs Content-Disposition auf inline setzen
        if (mimeType === 'application/pdf') {
          headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(pathLib.basename(absolutePath))}"`;
        }
        
        console.log(`[API][filesystem][binary] 🚀 Sende Response:`, {
          status: 200,
          headers: Object.fromEntries(Object.entries(headers).filter(([key]) => !key.startsWith('X-Debug-'))),
          contentLength: content.length
        });
        
        return new NextResponse(content, { headers });
      }

      case 'path': {
        return handleGetPath(library, fileId);
      }

      default:
        console.error('[API][filesystem] Ungültige Aktion:', {
          action,
          libraryId,
          fileId,
          userEmail
        });
        return NextResponse.json({ 
          error: 'Invalid action',
          errorCode: 'INVALID_ACTION',
          requestId 
        }, { status: 400 });
    }
  } catch (error) {
    console.error(`[API][filesystem] 💥 FEHLER:`, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      action,
      libraryId,
      fileId,
      userEmail,
      requestId
    });
    
    // Spezifische Fehlerbehandlung
    let errorMessage = 'Unbekannter Server-Fehler';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.name === 'LibraryPathNotFoundError') {
        errorMessage = error.message;
        statusCode = 404;
      } else if (error.name === 'LibraryAccessDeniedError') {
        errorMessage = error.message;
        statusCode = 403;
      } else if (error.name === 'NotDirectoryError') {
        errorMessage = error.message;
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      errorCode: 'SERVER_ERROR',
      requestId
    }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] POST ${action} fileId=${fileId}, libraryId=${libraryId}`);

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    switch (action) {
      case 'createFolder': {
        const { name } = await request.json();
        const parentPath = getPathFromId(library, fileId);
        const newFolderPath = pathLib.join(parentPath, name);
        
        await fs.mkdir(newFolderPath, { recursive: true });
        const stats = await fs.stat(newFolderPath);
        const item = await statsToStorageItem(library, newFolderPath, stats);
        
        return NextResponse.json(item);
      }

      case 'upload': {
        const formData = await request.formData();
        
        const file = formData.get('file');
  
        if (!file || !(file instanceof File)) {
          console.error('[API] Invalid file object received');
          return NextResponse.json({ error: 'No valid file provided' }, { status: 400 });
        }

        try {
          const parentPath = getPathFromId(library, fileId);
          
          const filePath = pathLib.join(parentPath, file.name);
  
          const arrayBuffer = await file.arrayBuffer();
          
          const buffer = Buffer.from(arrayBuffer);
          await fs.writeFile(filePath, buffer);
  
          const stats = await fs.stat(filePath);
          
          const item = await statsToStorageItem(library, filePath, stats);
          
          return NextResponse.json(item);
        } catch (error) {
          console.error('[API] Upload processing error:', error);
          throw error; // Re-throw to be caught by the outer try-catch
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] DELETE fileId=${fileId}, libraryId=${libraryId}`);

  if (!fileId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    const absolutePath = getPathFromId(library, fileId);
    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const newParentId = searchParams.get('newParentId');
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] PATCH fileId=${fileId}, newParentId=${newParentId}, libraryId=${libraryId}`);

  if (!fileId || !newParentId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file or parent ID' }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    const sourcePath = getPathFromId(library, fileId);
    const targetParentPath = getPathFromId(library, newParentId);
    const fileName = pathLib.basename(sourcePath);
    const targetPath = pathLib.join(targetParentPath, fileName);

    await fs.rename(sourcePath, targetPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function handleGetPath(library: LibraryType, fileId: string): Promise<Response> {
  try {
    console.log('[API] GET path fileId=', fileId);
    const absolutePath = getPathFromId(library, fileId);
    
    // Konvertiere absoluten Pfad zu relativem Pfad
    const relativePath = pathLib.relative(library.path, absolutePath)
      .replace(/\\/g, '/') // Normalisiere zu Forward Slashes
      .replace(/^\/+|\/+$/g, ''); // Entferne führende/nachfolgende Slashes
    
    const displayPath = relativePath || '/';
    
    return new Response(displayPath);
  } catch (error) {
    console.error('[API] Error getting path:', error);
    return new Response('Failed to get path', { status: 500 });
  }
} 