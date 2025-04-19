import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { Library } from '@/types/library';

export async function POST(request: NextRequest) {
  try {
    const { email, libraryName, libraryPath } = await request.json();
    
    if (!email || !libraryName) {
      return NextResponse.json({ 
        error: 'E-Mail-Adresse und Bibliotheksname sind erforderlich' 
      }, { status: 400 });
    }
    
    console.log(`[API] POST /add-library für Benutzer ${email}`);
    
    // Library-Service verwenden statt direkter DB-Zugriff
    const libraryService = LibraryService.getInstance();
    
    // Vorhandene Bibliotheken abrufen
    const existingLibraries = await libraryService.getUserLibraries(email);
    
    // Neue Bibliothek erstellen
    const newLibrary: Library = {
      id: `local-${Date.now()}`,
      label: libraryName,
      path: libraryPath || process.env.STORAGE_BASE_PATH || '/data/default',
      type: 'local',
      isEnabled: true,
      transcription: 'shadowTwin'
    };
    
    // Bibliothek hinzufügen und speichern
    const updatedLibraries = [...existingLibraries, newLibrary];
    const success = await libraryService.updateUserLibraries(email, updatedLibraries);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Bibliothek konnte nicht hinzugefügt werden' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Bibliothek erfolgreich hinzugefügt',
      library: newLibrary,
      totalLibraries: updatedLibraries.length
    });
  } catch (error) {
    console.error('[API] Fehler beim Hinzufügen der Bibliothek:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
    }, { status: 500 });
  }
} 