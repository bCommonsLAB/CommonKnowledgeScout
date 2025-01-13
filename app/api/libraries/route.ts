import { NextResponse } from 'next/server';
import { Library, ClientLibrary } from '@/types/library';

// Server-seitige Library-Konfiguration
const defaultLibraries: Library[] = [
  {
    id: 'local',
    label: "Lokale Bibliothek",
    path: process.env.STORAGE_BASE_PATH || '',
    type: 'local',
    isEnabled: process.env.STORAGE_BASE_PATH ? true : false,
    config: {} // Lokaler Provider braucht keine zusätzliche Konfiguration
  }
];

// Konvertiert Library in ClientLibrary (entfernt sensible Daten)
function toClientLibrary(library: Library): ClientLibrary {
  const { id, label, type, isEnabled } = library;
  return {
    id,
    label,
    type,
    isEnabled
  };
}

export async function GET() {
  try {
    // Nur aktivierte Libraries zurückgeben
    const clientLibraries = defaultLibraries
      .filter(lib => lib.isEnabled)
      .map(toClientLibrary);

    return NextResponse.json(clientLibraries);
  } catch (error) {
    console.error('Failed to get libraries:', error);
    return NextResponse.json(
      { error: 'Failed to get libraries' },
      { status: 500 }
    );
  }
} 