/**
 * @fileoverview Filesystem Storage API Route - Server-side Filesystem Operations
 * 
 * @description
 * API route handler for filesystem storage operations. Provides server-side file and folder
 * management including list, get, create, delete, move, rename, and upload operations.
 * Handles authentication, library validation, and file system access. Uses FileSystemProvider
 * for actual file operations.
 * 
 * @module storage
 * 
 * @exports
 * - GET: List items, get item, download file
 * - POST: Create folder, upload file
 * - DELETE: Delete item
 * - PATCH: Move item, rename item
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/storage/filesystem
 * - src/lib/storage/filesystem-provider.ts: Provider calls this API
 * - src/lib/storage/filesystem-client.ts: Client calls this API
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/services/library-service: Library service for validation
 * - @/lib/storage/types: Storage types
 * - @/types/library: Library types
 * - fs/promises: Node.js filesystem operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
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

// Minimal-Logging über ENV schaltbar
const VERBOSE = process.env.DEBUG_FILESYSTEM === 'true';
const vLog = (...args: unknown[]) => { if (VERBOSE) console.log(...args); };
const vWarn = (...args: unknown[]) => { if (VERBOSE) console.warn(...args); };

/**
 * Normalisiert Query-Parameter, die aus Client-Bugs gelegentlich als String "undefined"/"null" kommen.
 * In diesem Projekt ist "root" der sichere Default für FileSystem-IDs.
 */
function normalizeFileIdParam(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return 'root'
  if (v === 'undefined' || v === 'null') return 'root'
  return v
}

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 */
async function getUserEmail(request: NextRequest): Promise<string | undefined> {
  const searchParams = request.nextUrl.searchParams;
  const emailParam = searchParams.get('email');
  
  // Cookie-Analyse entfernt - nicht mehr benötigt
  
  // Debug-Log entfernt - nicht mehr benötigt

  // reduced noisy console logs
  
  // Wenn ein Email-Parameter übergeben wurde, diesen verwenden (für Tests)
  if (emailParam) {
    return emailParam;
  }
  
  // Versuche, authentifizierten Benutzer zu erhalten
  try {
    const { userId } = await auth();
    
    if (userId) {
      const user = await currentUser();
      
      const emailAddresses = user?.emailAddresses || [];
      
      if (user && emailAddresses.length > 0) {
        const email = emailAddresses[0].emailAddress;
        return email;
      } else {
        AuthLogger.warn('FileSystemAPI', 'User has no email addresses', {
          hasUser: !!user,
          emailAddressesCount: emailAddresses.length
        });
      }
    } else {
      AuthLogger.warn('FileSystemAPI', 'No userId returned from Clerk auth()');
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
    // Platzhalter für mögliche Fallbacks (bewusst ungenutzt, um Linter ruhig zu halten)
    void request.headers;
  } catch (fallbackError) {
    AuthLogger.error('FileSystemAPI', 'Header fallback failed', fallbackError);
    console.error('[API][getUserEmail] 💥 Fallback-Fehler:', fallbackError);
  }
  
  AuthLogger.error('FileSystemAPI', 'All authentication methods failed - no email found');
  return undefined;
}

async function getLibrary(libraryId: string, email: string): Promise<LibraryType | undefined> {
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
  // Defensive: fileId kommt teilweise als String "undefined"/"null" aus dem Client (sollte root sein).
  if (fileId === 'root' || fileId === 'undefined' || fileId === 'null') {
    return library.path;
  }

  // Wenn es NICHT wie Base64 aussieht, nicht dekodieren – Buffer.from(...,'base64') erzeugt sonst Müll (Windows: "��").
  if (!/^[A-Za-z0-9+/=]+$/.test(fileId) || fileId.length % 4 !== 0) {
    return library.path
  }
  
  try {
    const decodedPath = Buffer.from(fileId, 'base64').toString();
    
    // Always treat decoded path as relative path and normalize it
    const normalizedPath = decodedPath.replace(/\\/g, '/');
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      return library.path;
    }
    
    // Join with base path using pathLib.join to handle separators correctly
    const result = pathLib.join(library.path, normalizedPath);
    
    // Double check the result is within the library path
    const normalizedResult = pathLib.normalize(result).replace(/\\/g, '/');
    const normalizedLibPath = pathLib.normalize(library.path).replace(/\\/g, '/');
    
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
      return library.path;
    }
    
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

/**
 * Heuristik: In diesem Projekt sind Storage-IDs Base64 (siehe getIdFromPath()).
 * Wenn Clients aus Versehen einen Dateinamen oder relativen Pfad schicken, wollen wir NICHT dekodieren,
 * weil Buffer.from(x, 'base64') sonst Müll erzeugt (Windows-Pfade mit "��").
 */
function isLikelyBase64Id(value: string): boolean {
  if (!value) return false
  if (value === 'root') return true
  // Base64 alphabet (+ optional "=" padding). encodeURIComponent bleibt auf Client-Seite, daher hier normale Base64.
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false
  if (value.length < 8) return false
  if (value.length % 4 !== 0) return false
  return true
}

/**
 * Windows-sicherer Dateiname: entfernt Pfadtrenner/Reservierte Zeichen.
 * (Wir vermeiden komplizierte Logik – Ziel ist nur: kein Path-Traversal + kein Crash.)
 */
function sanitizeFileName(input: string): string {
  const raw = typeof input === 'string' ? input : ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Entferne Pfadsegmente (nur Basename)
  const base = trimmed.replace(/\\/g, '/').split('/').pop() || ''
  // Entferne Windows-reservierte Zeichen + Control chars
  return base
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
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
  const absolutePath = getPathFromId(library, fileId);
  
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
  const fileId = normalizeFileIdParam(url.searchParams.get('fileId'));
  const libraryId = url.searchParams.get('libraryId');
  
  vLog(`[API][filesystem] GET Request:`, {
    requestId,
    action,
    fileId,
    libraryId,
    timestamp: new Date().toISOString()
  });
  
  // Validiere erforderliche Parameter
  if (!libraryId) {
    vWarn(`[API][filesystem] ❌ Fehlender libraryId Parameter`);
    return NextResponse.json({ 
      error: 'libraryId is required',
      errorCode: 'MISSING_LIBRARY_ID',
      requestId 
    }, { status: 400 });
  }

  // fileId ist absichtlich optional (root fallback), damit Requests wie fileId=undefined nicht 404/500 erzeugen.

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    vWarn(`[API][filesystem] ❌ Keine E-Mail gefunden`);
    return NextResponse.json({ 
      error: 'No user email found',
      errorCode: 'NO_USER_EMAIL',
      requestId 
    }, { status: 400 });
  }


  const library = await getLibrary(libraryId, userEmail);

  if (!library) {
    console.warn(`[API][filesystem] ❌ Bibliothek nicht gefunden`);
    return handleLibraryNotFound(libraryId, userEmail);
  }

  // WICHTIG: Diese Route ist nur für lokale Filesystem-Libraries gedacht
  // Für OneDrive-Libraries sollte /api/storage verwendet werden
  if (library.type === 'onedrive') {
    console.warn(`[API][filesystem] ❌ Diese Route unterstützt keine OneDrive-Libraries. Verwende /api/storage statt /api/storage/filesystem`, {
      libraryId: library.id,
      libraryType: library.type,
      action,
      fileId
    });
    return NextResponse.json({ 
      error: 'OneDrive-Libraries werden über /api/storage unterstützt, nicht über /api/storage/filesystem',
      errorCode: 'WRONG_ROUTE_FOR_PROVIDER',
      libraryId: library.id,
      libraryType: library.type,
      requestId 
    }, { status: 400 });
  }

  vLog(`[API][filesystem] Bibliothek gefunden:`, {
    libraryId: library.id,
    libraryLabel: library.label,
    libraryPath: library.path,
    libraryType: library.type
  });

  try {
    switch (action) {
      case 'list': {
        vLog(`[API][filesystem][list] Starte Verzeichnisauflistung:`, {
          requestId,
          fileId,
          libraryId,
          libraryPath: library.path
        });
        
        const items = await listItems(library, fileId);
        
        vLog(`[API][filesystem][list] Erfolgreich ${items.length} Items geladen:`, {
          requestId,
          itemCount: items.length,
          fileId
        });
        
        return NextResponse.json(items, { headers: debugHeaders });
      }

      case 'get': {
        try {
          const absolutePath = getPathFromId(library, fileId);
          const stats = await fs.stat(absolutePath);
          const item = await statsToStorageItem(library, absolutePath, stats);
          return NextResponse.json(item, { headers: debugHeaders });
        } catch (error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code === 'ENOENT') {
            const absolutePath = getPathFromId(library, fileId);
            console.error('[API][filesystem][get] Datei nicht gefunden:', {
              fileId,
              absolutePath,
              libraryId,
              userEmail,
              requestId
            });
            return NextResponse.json({ 
              error: 'Datei nicht gefunden',
              errorCode: 'FILE_NOT_FOUND',
              fileId,
              absolutePath,
              requestId
            }, { status: 404 });
          }
          throw error; // Andere Fehler weiterwerfen
        }
      }

      case 'binary': {
        vLog(`[API][filesystem][binary] 🖼️ Binary-Request gestartet:`, {
          requestId,
          fileId,
          libraryId,
          userEmail,
          timestamp: new Date().toISOString()
        });

        try {
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

          const stats = await fs.stat(absolutePath);
          
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

          // Logge Dateigröße vor dem Lesen
          vLog(`[API][filesystem][binary] 📊 Starte Datei-Laden:`, {
            absolutePath,
            fileSize: stats.size,
            fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
            requestId
          });
          
          const readStartTime = Date.now();
          const content = await fs.readFile(absolutePath);
          const readDuration = Date.now() - readStartTime;
          
          vLog(`[API][filesystem][binary] ✅ Datei geladen:`, {
            absolutePath,
            fileSize: stats.size,
            fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
            readDurationMs: readDuration,
            readDurationSec: (readDuration / 1000).toFixed(2),
            requestId
          });

          const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
          vLog(`[API][filesystem][binary] 🏷️ MIME-Type erkannt:`, {
            mimeType,
            filename: pathLib.basename(absolutePath),
            extension: pathLib.extname(absolutePath)
          });
          
          // Spezielle Headers für PDFs, damit sie im Browser angezeigt werden
          // WICHTIG: Bereinige alle Header-Werte, die nicht-ASCII-Zeichen enthalten könnten
          // HTTP-Header müssen ByteString-kompatibel sein (nur ASCII-Zeichen 0-255)
          const cleanedPath = absolutePath
            .replace(/['']/g, "'") // Typografische Apostrophe → Standard-Apostroph
            .replace(/[""]/g, '"') // Typografische Anführungszeichen → Standard-Anführungszeichen
            .replace(/[–—]/g, '-') // En/Em-Dash → Bindestrich
            .replace(/[^\x20-\x7E]/g, '_'); // Alle anderen nicht-ASCII-Zeichen → Unterstrich
          
          const headers: HeadersInit = {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'no-store',
            'X-Debug-Request-Id': requestId,
            'X-Debug-File-Path': cleanedPath, // Bereinigter Pfad für Header-Kompatibilität
            'X-Debug-File-Size': stats.size.toString(),
            'X-Debug-Mime-Type': mimeType
          };
          
          // Für PDFs Content-Disposition auf inline setzen
          // WICHTIG: Dateinamen bereinigen, um Probleme mit nicht-ASCII-Zeichen in HTTP-Headers zu vermeiden
          // RFC 5987-konforme Kodierung verwenden für Dateinamen mit Sonderzeichen
          if (mimeType === 'application/pdf') {
            const rawFilename = pathLib.basename(absolutePath);
            // Bereinige Dateinamen: Ersetze problematische Zeichen (z.B. typografische Apostrophe) durch ASCII-Äquivalente
            const cleanedFilename = rawFilename
              .replace(/['']/g, "'") // Typografische Apostrophe → Standard-Apostroph
              .replace(/[""]/g, '"') // Typografische Anführungszeichen → Standard-Anführungszeichen
              .replace(/[–—]/g, '-') // En/Em-Dash → Bindestrich
              .replace(/[^\x20-\x7E]/g, '_'); // Alle anderen nicht-ASCII-Zeichen → Unterstrich
            
            // Verwende RFC 5987-konforme Kodierung für den Dateinamen im Header
            // Format: filename="fallback"; filename*=UTF-8''encoded
            const encodedFilename = encodeURIComponent(rawFilename).replace(/'/g, "%27");
            headers['Content-Disposition'] = `inline; filename="${cleanedFilename}"; filename*=UTF-8''${encodedFilename}`;
          }
          
          vLog(`[API][filesystem][binary] 🚀 Sende Response:`, {
            status: 200,
            headers: Object.fromEntries(Object.entries(headers).filter(([key]) => !key.startsWith('X-Debug-'))),
            contentLength: content.length
          });
          
          return new NextResponse(content, { headers });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          const errorStack = error instanceof Error ? error.stack : undefined;
          
          console.error('[API][filesystem] 💥 FEHLER:', {
            error: {
              message: errorMessage,
              name: errorName,
              stack: errorStack
            },
            action: 'binary',
            libraryId,
            fileId,
            userEmail,
            requestId
          });
          
          // Prüfe, ob es ein Header-Encoding-Problem ist
          const isHeaderEncodingError = errorMessage.includes('ByteString') || errorMessage.includes('character at index');
          
          return NextResponse.json({ 
            error: isHeaderEncodingError 
              ? 'Dateiname enthält ungültige Zeichen für HTTP-Header'
              : 'Fehler beim Laden der Datei',
            errorCode: isHeaderEncodingError ? 'HEADER_ENCODING_ERROR' : 'FILE_LOAD_ERROR',
            errorDetails: {
              message: errorMessage,
              name: errorName,
              isHeaderEncodingError
            },
            requestId 
          }, { status: 500 });
        }
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
  const fileId = normalizeFileIdParam(searchParams.get('fileId'));
  const libraryId = searchParams.get('libraryId') || '';

  vLog(`[API] POST ${action} fileId=${fileId}, libraryId=${libraryId}`);

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

      case 'saveAndExtractZipInFolder': {
        // Performance-Optimierung für filesystem:
        // - statt N einzelner Upload-Requests (action=upload) nur 1 Request mit Base64-ZIP
        // - serverseitiges Entpacken + direktes Schreiben ins Filesystem
        const body = await request.json().catch(() => ({})) as { zipBase64?: unknown }
        const zipBase64 = typeof body.zipBase64 === 'string' ? body.zipBase64 : ''
        if (!zipBase64) {
          return NextResponse.json({ error: 'zipBase64 fehlt' }, { status: 400 })
        }

        const parentPath = getPathFromId(library, fileId)
        await fs.mkdir(parentPath, { recursive: true })

        // ZIP laden
        const JSZip = await import('jszip')
        const zip = new JSZip.default()
        const buf = Buffer.from(zipBase64, 'base64')
        const zipContent = await zip.loadAsync(buf)

        const saved: StorageItem[] = []

        for (const [zipPath, entry] of Object.entries(zipContent.files)) {
          if (entry.dir) continue

          // Nur Basename verwenden (kein Traversal)
          const originalName = zipPath.replace(/\\/g, '/').split('/').pop() || ''
          const safeNameRaw = sanitizeFileName(originalName)
          if (!safeNameRaw) continue

          // Gleiche Namenslogik wie in ImageExtractionService (minimal):
          // Konvertiere image_XXX → page_XXX (mit führenden Nullen)
          const finalName = safeNameRaw.replace(/^image_(\d+)/, (_m, pageNum: string) => {
            return `page_${String(pageNum).padStart(3, '0')}`
          })

          const outPath = pathLib.join(parentPath, finalName)
          const fileBuffer = await entry.async('nodebuffer')

          // Überschreiben ist ok (idempotenter Import)
          await fs.writeFile(outPath, fileBuffer, { flag: 'w' })
          const st = await fs.stat(outPath)
          const item = await statsToStorageItem(library, outPath, st)
          saved.push(item)
        }

        return NextResponse.json({ savedItems: saved })
      }

      case 'upload': {
        const formData = await request.formData();
        
        const file = formData.get('file');
  
        if (!file || !(file instanceof File)) {
          console.error('[API] Invalid file object received');
          return NextResponse.json({ error: 'No valid file provided' }, { status: 400 });
        }

        try {
          // IMPORTANT:
          // - fileId ist im Normalfall die Parent-Folder-ID (Base64).
          // - In manchen Browser-Flows kommt file.name als "blob" an; dann brauchen wir einen Fallback.
          // - Wenn Clients aus Versehen einen Dateinamen/relativen Pfad als fileId senden, dürfen wir NICHT Base64-dekodieren.
          const rawIncomingName = typeof file.name === 'string' ? file.name : ''
          const isBlobName = rawIncomingName.trim().length === 0 || rawIncomingName === 'blob'

          // Fallback: wenn file.name="blob" und fileId keine Base64-ID ist, interpretieren wir fileId als Dateiname/relativen Pfad.
          const fileIdLooksLikePath = fileId !== 'root' && !isLikelyBase64Id(fileId)

          let parentPath = library.path
          let finalFileName = sanitizeFileName(rawIncomingName)

          if (fileId === 'root') {
            parentPath = library.path
          } else if (isLikelyBase64Id(fileId)) {
            const decodedPath = getPathFromId(library, fileId)
            try {
              const decodedStats = await fs.stat(decodedPath)
              if (decodedStats.isDirectory()) {
                parentPath = decodedPath
              } else {
                // fileId zeigt auf eine Datei → überschreibe genau diese Datei
                parentPath = pathLib.dirname(decodedPath)
                finalFileName = sanitizeFileName(pathLib.basename(decodedPath))
              }
            } catch {
              // Pfad existiert noch nicht – interpretieren als Zielordner
              parentPath = decodedPath
            }
          } else if (fileIdLooksLikePath) {
            const normalized = fileId.replace(/\\/g, '/').replace(/^\/+/, '')
            if (!normalized.includes('..') && normalized.trim().length > 0) {
              // Wenn es wie ein Dateipfad aussieht (hat Slash oder Extension), behandeln wir es als "library-relative file path"
              const looksLikeFile = normalized.includes('/') || /\.[A-Za-z0-9]{1,8}$/.test(normalized)
              if (looksLikeFile) {
                parentPath = pathLib.join(library.path, pathLib.dirname(normalized))
                finalFileName = sanitizeFileName(pathLib.basename(normalized))
              } else {
                // Sonst als Ordnername unterhalb der Library
                parentPath = pathLib.join(library.path, normalized)
              }
            }
          }

          // Wenn file.name="blob" und wir noch keinen sinnvollen Namen haben, nutzen wir fileId als Namen.
          if (isBlobName && (!finalFileName || finalFileName === 'blob') && fileIdLooksLikePath) {
            const normalized = fileId.replace(/\\/g, '/')
            finalFileName = sanitizeFileName(normalized.split('/').pop() || '')
          }

          if (!finalFileName) finalFileName = 'upload.bin'

          // Sicherheit: parentPath muss innerhalb von library.path liegen
          const normalizedParent = pathLib.normalize(parentPath).replace(/\\/g, '/')
          const normalizedLib = pathLib.normalize(library.path).replace(/\\/g, '/')
          if (!normalizedParent.startsWith(normalizedLib)) {
            parentPath = library.path
          }

          // ENOENT Fix: Zielordner sicher erstellen
          await fs.mkdir(parentPath, { recursive: true })

          const filePath = pathLib.join(parentPath, finalFileName);
  
          const arrayBuffer = await file.arrayBuffer();
          
          const buffer = Buffer.from(arrayBuffer);
          
          // WICHTIG: Verwende { flag: 'w' } um sicherzustellen, dass die Datei überschrieben wird
          // Dies stellt sicher, dass die Datei auch dann aktualisiert wird, wenn sie bereits existiert
          await fs.writeFile(filePath, buffer, { flag: 'w' });
  
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
  const fileId = normalizeFileIdParam(searchParams.get('fileId'));
  const libraryId = searchParams.get('libraryId') || '';

  vLog(`[API] DELETE fileId=${fileId}, libraryId=${libraryId}`);

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
    
    // Prüfe ob es sich um ein Buch handelt (PDF-Datei) und lösche Azure-Bilder
    if (!stats.isDirectory()) {
      // Prüfe MIME-Type (PDF-Dateien)
      const isPdf = absolutePath.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        // Prüfe ob Azure Storage konfiguriert ist
        const { getAzureStorageConfig } = await import('@/lib/config/azure-storage')
        const azureConfig = getAzureStorageConfig()
        if (azureConfig) {
          const { AzureStorageService } = await import('@/lib/services/azure-storage-service')
          const azureStorage = new AzureStorageService()
          if (azureStorage.isConfigured()) {
            try {
              await azureStorage.deleteImagesForOwner(
                azureConfig.containerName,
                libraryId,
                'books',
                fileId
              )
              vLog(`[API] Azure-Bilder für Buch gelöscht: fileId=${fileId}`)
            } catch (azureError) {
              // Fehler beim Löschen der Azure-Bilder: Loggen, aber nicht abbrechen
              console.warn('[API] Fehler beim Löschen der Azure-Bilder', {
                fileId,
                libraryId,
                error: azureError instanceof Error ? azureError.message : String(azureError),
              })
            }
          }
        }
      }
    }
    
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
  const action = searchParams.get('action');
  const fileId = normalizeFileIdParam(searchParams.get('fileId'));
  const newParentId = searchParams.get('newParentId');
  const libraryId = searchParams.get('libraryId') || '';

  vLog(`[API] PATCH fileId=${fileId}, newParentId=${newParentId}, libraryId=${libraryId}`);

  // Validierung erfolgt abhängig von der Aktion
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
    // Aktion: Umbenennen
    if (action === 'rename') {
      const body = await request.json().catch(() => ({}));
      const newName = (body as { name?: string }).name;
      if (!newName || typeof newName !== 'string') {
        return NextResponse.json({ error: 'Invalid new name' }, { status: 400 });
      }

      const sourcePath = getPathFromId(library, fileId);
      const parentPath = pathLib.dirname(sourcePath);
      const targetPath = pathLib.join(parentPath, newName);

      // Prüfe auf bestehende Datei/Ordner mit gleichem Namen
      try {
        await fs.stat(targetPath);
        return NextResponse.json({ error: `Eine Datei mit dem Namen "${newName}" existiert bereits` }, { status: 409 });
      } catch {
        // ENOENT ist erwartbar (Ziel existiert nicht) → fortfahren
      }

      await fs.rename(sourcePath, targetPath);

      const stats = await fs.stat(targetPath);
      const item = await statsToStorageItem(library, targetPath, stats);
      return NextResponse.json(item);
    }

    // Aktion: Verschieben (Fallback, wenn action != 'rename')
    if (!newParentId) {
      return NextResponse.json({ error: 'Invalid parent ID' }, { status: 400 });
    }

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
    vLog('[API] GET path fileId=', fileId);
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