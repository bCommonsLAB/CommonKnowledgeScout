import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';
import crypto from 'crypto';

// Helfer-Funktion für deterministische ID-Generierung
function generateDeterministicId(libraryId: string, path: string): string {
  return crypto.createHash('md5').update(`${libraryId}:${path}`).digest('hex');
}

// Helfer-Funktion um den Pfad aus der ID zu extrahieren
async function getPathFromId(libraryId: string, itemId: string, basePath: string): Promise<string> {
  if (itemId === 'root') return basePath;
  
  // Durchsuche das Verzeichnis rekursiv
  const findPath = async (dir: string): Promise<string | null> => {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = pathLib.join(dir, item.name);
      const currentId = generateDeterministicId(libraryId, fullPath);
      
      if (currentId === itemId) {
        return fullPath;
      }
      
      if (item.isDirectory()) {
        const result = await findPath(fullPath);
        if (result) return result;
      }
    }
    
    return null;
  };
  
  const foundPath = await findPath(basePath);
  return foundPath || basePath;
}

// Library-Konfiguration
const defaultLibraries: LibraryType[] = [
  {
    id: 'local',
    label: "Lokale Bibliothek",
    path: process.env.STORAGE_BASE_PATH || '',
    type: 'local',
    isEnabled: process.env.STORAGE_BASE_PATH ? true : false,
    config: {},
    transcription: 'db'
  }
];

// Helfer-Funktion um die Library zu finden
function getLibrary(libraryId: string): LibraryType | undefined {
  return defaultLibraries.find(lib => lib.id === libraryId && lib.isEnabled);
}

// Konvertiere Stats zu StorageItem
async function statsToStorageItem(libraryId: string, path: string, stats: Stats, parentPath: string): Promise<StorageItem> {
  return {
    id: generateDeterministicId(libraryId, path),
    parentId: generateDeterministicId(libraryId, parentPath),
    type: stats.isDirectory() ? 'folder' : 'file',
    metadata: {
      name: pathLib.basename(path),
      path, // Für interne Verwendung
      size: stats.size,
      mimeType: stats.isFile() ? mime.lookup(path) || 'application/octet-stream' : undefined,
      modifiedAt: stats.mtime
    }
  };
}

// API Route Handler
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const libraryId = searchParams.get('libraryId') || 'local';
  const itemId = searchParams.get('itemId');

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library not found' }, { status: 404 });
  }

  try {
    switch (action) {
      case 'list': {
        const folderPath = await getPathFromId(libraryId, itemId || 'root', library.path);
        const items = await fs.readdir(folderPath);
        const itemsList = await Promise.all(
          items.map(async (name) => {
            const fullPath = pathLib.join(folderPath, name);
            const stats = await fs.stat(fullPath);
            return statsToStorageItem(libraryId, fullPath, stats, folderPath);
          })
        );
        
        return NextResponse.json(itemsList);
      }

      case 'get': {
        if (!itemId) {
          return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }
        
        const path = await getPathFromId(libraryId, itemId, library.path);
        const stats = await fs.stat(path);
        const parentPath = pathLib.dirname(path);
        const item = await statsToStorageItem(libraryId, path, stats, parentPath);
        
        return NextResponse.json(item);
      }

      case 'binary': {
        if (!itemId) {
          return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }
        
        const path = await getPathFromId(libraryId, itemId, library.path);
        const stats = await fs.stat(path);

        // Prüfe ob es eine Datei ist
        if (!stats.isFile()) {
          return NextResponse.json({ 
            error: 'Cannot read binary content of a directory' 
          }, { status: 400 });
        }
        
        const content = await fs.readFile(path);
        const mimeType = mime.lookup(path) || 'application/octet-stream';
        
        return new NextResponse(content, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': content.length.toString(),
            'Cache-Control': 'no-store'
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Storage operation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST Handler für Datei-Upload und Ordner-Erstellung
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const parentId = searchParams.get('parentId');
  const libraryId = searchParams.get('libraryId') || 'local';

  const library = getLibrary(libraryId);
  if (!library || !library.isEnabled || !parentId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const parentPath = await getPathFromId(libraryId, parentId, library.path);

    switch (action) {
      case 'createFolder': {
        const { name } = await request.json();
        const newPath = pathLib.join(parentPath, name);
        await fs.mkdir(newPath, { recursive: true });
        
        const stats = await fs.stat(newPath);
        const item = await statsToStorageItem(libraryId, newPath, stats, parentPath);
        return NextResponse.json(item);
      }

      case 'upload': {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const newPath = pathLib.join(parentPath, file.name);
        await fs.writeFile(newPath, buffer);
        
        const stats = await fs.stat(newPath);
        const item = await statsToStorageItem(libraryId, newPath, stats, parentPath);
        return NextResponse.json(item);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Storage operation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Handler
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const itemId = searchParams.get('itemId');
  const libraryId = searchParams.get('libraryId') || 'local';

  if (!itemId) {
    return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
  }

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library not found' }, { status: 404 });
  }

  try {
    const path = await getPathFromId(libraryId, itemId, library.path);
    const stats = await fs.stat(path);
    
    if (stats.isDirectory()) {
      await fs.rm(path, { recursive: true });
    } else {
      await fs.unlink(path);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete operation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH Handler für Verschieben/Umbenennen
export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const itemId = searchParams.get('itemId');
  const newParentId = searchParams.get('newParentId');
  const libraryId = searchParams.get('libraryId') || 'local';

  if (!itemId || !newParentId) {
    return NextResponse.json({ error: 'Item ID and new parent ID required' }, { status: 400 });
  }

  const library = getLibrary(libraryId);
  if (!library) {
    return NextResponse.json({ error: 'Library not found' }, { status: 404 });
  }

  try {
    const itemPath = await getPathFromId(libraryId, itemId, library.path);
    const newParentPath = await getPathFromId(libraryId, newParentId, library.path);
    const { newName } = await request.json();
    
    const newPath = pathLib.join(newParentPath, newName || pathLib.basename(itemPath));
    await fs.rename(itemPath, newPath);

    const stats = await fs.stat(newPath);
    const item = await statsToStorageItem(libraryId, newPath, stats, newParentPath);
    return NextResponse.json(item);
  } catch (error: any) {
    console.error('Move operation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 