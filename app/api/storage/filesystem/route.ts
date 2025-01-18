import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';

const defaultLibraries: LibraryType[] = [
  {
    id: 'local',
    label: "Lokale Bibliothek",
    path: process.env.STORAGE_BASE_PATH || '',
    type: 'local',
    isEnabled: process.env.STORAGE_BASE_PATH ? true : false,
    config: {},
    transcription: "shadowTwin"
  }
];

function getLibrary(libraryId: string): LibraryType | undefined {
  return defaultLibraries.find(lib => lib.id === libraryId && lib.isEnabled);
}

// Konvertiert eine ID zurück in einen Pfad
function getPathFromId(library: LibraryType, fileId: string): string {
  console.log('[getPathFromId] Input:', { fileId, libraryPath: library.path });
  
  if (fileId === 'root') return library.path;
  
  try {
    const decodedPath = Buffer.from(fileId, 'base64').toString();
    console.log('[getPathFromId] Decoded path:', decodedPath);
    
    // Always treat decoded path as relative path and normalize it
    const normalizedPath = decodedPath.replace(/\\/g, '/');
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      console.log('[getPathFromId] Path traversal detected, returning root');
      return library.path;
    }
    
    // Join with base path using pathLib.join to handle separators correctly
    const result = pathLib.join(library.path, normalizedPath);
    
    // Double check the result is within the library path
    const normalizedResult = pathLib.normalize(result).replace(/\\/g, '/');
    const normalizedLibPath = pathLib.normalize(library.path).replace(/\\/g, '/');
    if (!normalizedResult.startsWith(normalizedLibPath)) {
      console.log('[getPathFromId] Path escape detected, returning root');
      return library.path;
    }
    
    console.log('[getPathFromId] Result:', result);
    return result;
  } catch (error) {
    console.error('Error decoding path:', error);
    return library.path;
  }
}

// Konvertiert einen Pfad in eine ID
function getIdFromPath(library: LibraryType, absolutePath: string): string {
  console.log('[getIdFromPath] Input:', { absolutePath, libraryPath: library.path });
  
  if (absolutePath === library.path) return 'root';
  
  // Normalize both paths to use forward slashes
  const normalizedBasePath = pathLib.normalize(library.path).replace(/\\/g, '/');
  const normalizedPath = pathLib.normalize(absolutePath).replace(/\\/g, '/');
  
  // Get relative path by removing base path
  let relativePath = pathLib.relative(normalizedBasePath, normalizedPath)
    .replace(/\\/g, '/') // Normalize to forward slashes
    .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
  
  // If path tries to go up, return root
  if (relativePath.includes('..')) {
    console.log('[getIdFromPath] Path traversal detected, returning root');
    return 'root';
  }
    
  console.log('[getIdFromPath] Relative path:', relativePath);
  
  const result = relativePath ? Buffer.from(relativePath).toString('base64') : 'root';
  console.log('[getIdFromPath] Result:', result);
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
  console.log(`[API] GET listItems fileId=${fileId}`);
  
  const absolutePath = getPathFromId(library, fileId);
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
  
  console.log(`[API] Response: ${validResults.length} items`);
  return validResults;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId') || 'local';

  console.log(`[API] GET ${action} fileId=${fileId}`);

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });
  }

  try {
    switch (action) {
      case 'list': {
        const items = await listItems(library, fileId);
        return NextResponse.json(items);
      }

      case 'get': {
        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        const item = await statsToStorageItem(library, absolutePath, stats);
        return NextResponse.json(item);
      }

      case 'binary': {
        if (!fileId || fileId === 'root') {
          return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        
        if (!stats.isFile()) {
          return NextResponse.json({ error: 'Not a file' }, { status: 400 });
        }

        const content = await fs.readFile(absolutePath);
        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        
        return new NextResponse(content, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'no-store'
          }
        });
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

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId') || 'local';

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });
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
        const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const parentPath = getPathFromId(library, fileId);
        const filePath = pathLib.join(parentPath, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        
        await fs.writeFile(filePath, buffer);
        const stats = await fs.stat(filePath);
        const item = await statsToStorageItem(library, filePath, stats);
        
        return NextResponse.json(item);
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
  const libraryId = searchParams.get('libraryId') || 'local';

  if (!fileId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });
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
  const libraryId = searchParams.get('libraryId') || 'local';

  if (!fileId || !newParentId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file or parent ID' }, { status: 400 });
  }

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });
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