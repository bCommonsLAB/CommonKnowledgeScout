import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // LibraryService instanziieren und Methoden aufrufen
    const libraryService = LibraryService.getInstance();
    
    // Server-Logs generieren durch Aufruf der Methoden
    const libraries = await libraryService.getUserLibraries(userId);
    
    // toClientLibraries aufrufen (generiert viele Server-Logs)
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    return NextResponse.json({
      success: true,
      message: 'LibraryService Server-Logs generiert',
      libraryCount: libraries.length,
      clientLibraryCount: clientLibraries.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Generieren der LibraryService-Logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Fehler beim Generieren der LibraryService-Logs',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 