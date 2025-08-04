import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Library } from '@/types/library';

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 */
async function getUserEmail(request: NextRequest): Promise<{ email: string | null; isAuthenticated: boolean }> {
  // Prüfen, ob ein Test-E-Mail-Parameter verwendet wird
  const searchParams = request.nextUrl.searchParams;
  const testEmail = searchParams.get('email');
  
  if (testEmail) {
    return { email: testEmail, isAuthenticated: true };
  }
  
  // Benutzer-Authentifizierung prüfen
  const { userId } = await auth();
  if (!userId) {
    return { email: null, isAuthenticated: false };
  }
  
  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    return { email: null, isAuthenticated: true };
  }
  
  return { 
    email: user.emailAddresses[0].emailAddress, 
    isAuthenticated: true 
  };
}

/**
 * GET /api/libraries
 * Ruft alle Bibliotheken für den aktuellen Benutzer ab
 */
export async function GET(request: NextRequest) {
  const { email, isAuthenticated } = await getUserEmail(request);
  
  // Authentifizierungsprüfung überspringen, wenn Test-E-Mail verwendet wird
  if (!email && !isAuthenticated) {
    return NextResponse.json({ 
      error: 'Nicht authentifiziert' 
    }, { status: 401 });
  }
  
  if (!email) {
    return NextResponse.json({ 
      error: 'Keine E-Mail-Adresse gefunden. Bitte melden Sie sich an.' 
    }, { status: 401 });
  }
  
  try {
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(email);
    // KRITISCHES DEBUGGING: RAW Database Libraries analysieren
    console.log('[API:libraries] RAW DATABASE LIBRARIES:', JSON.stringify(libraries, null, 2));
    
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // KRITISCHES DEBUGGING: CLIENT Libraries nach Konvertierung analysieren
    console.log('[API:libraries] CLIENT LIBRARIES nach toClientLibraries:', JSON.stringify(clientLibraries, null, 2));
    
    // Spezifische Passwort-Analyse für Debugging
    const nextcloudLib = clientLibraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
    const archivPeterLib = clientLibraries.find(lib => lib.id === '_ArchivPeter');
    
    console.log('[API:libraries] PASSWORT-ANALYSE CLIENT LIBRARIES:', {
      nextcloudPassword: nextcloudLib?.config?.password,
      archivPeterPassword: archivPeterLib?.config?.password,
      nextcloudPasswordPrefix: nextcloudLib?.config?.password?.substring(0, 6) + '***',
      archivPeterPasswordPrefix: archivPeterLib?.config?.password?.substring(0, 6) + '***'
    });
    
    // Aktive Library-ID abrufen
    const activeLibraryId = await libraryService.getActiveLibraryId(email);
    
    const response = {
      libraries: clientLibraries,
      activeLibraryId
    };
    
    console.log('[API:libraries] FINAL RESPONSE:', JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der Bibliotheken:', error);
    
    // Benutzerfreundliche Fehlermeldungen
    let userMessage = 'Ein unerwarteter Fehler ist aufgetreten';
    
    if (error instanceof Error) {
      // Spezielle Behandlung für Datenbankfehler
      if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
        userMessage = 'Die Verbindung zur Datenbank konnte nicht hergestellt werden. Bitte wenden Sie sich an den Administrator.';
      } else if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_DATABASE_NAME')) {
        userMessage = 'Die Datenbankkonfiguration ist unvollständig. Bitte prüfen Sie die Umgebungsvariablen.';
      } else if (error.message.includes('Datenbankverbindung fehlgeschlagen')) {
        userMessage = 'Die Datenbank ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
      } else {
        // Für andere Fehler verwende eine generische Nachricht
        userMessage = `Es ist ein Fehler aufgetreten: ${error.message}`;
      }
    }
    
    return NextResponse.json({ 
      error: userMessage,
      // Füge technische Details nur in der Entwicklungsumgebung hinzu
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unbekannter Fehler' 
      })
    }, { status: 500 });
  }
}

/**
 * POST /api/libraries
 * Erstellt oder aktualisiert eine Bibliothek
 */
export async function POST(request: NextRequest) {
  const { email, isAuthenticated } = await getUserEmail(request);
  
  if (!email) {
    return NextResponse.json({ 
      error: !isAuthenticated ? 'Nicht authentifiziert' : 'Keine E-Mail-Adresse gefunden. Bitte melden Sie sich an.' 
    }, { status: 401 });
  }
  
  try {
    const libraryData = await request.json() as Library;
    
    const libraryService = LibraryService.getInstance();
    const success = await libraryService.updateLibrary(email, libraryData);
    
    if (success) {
      return NextResponse.json({ 
        success: true,
        message: 'Bibliothek erfolgreich gespeichert'
      });
    } else {
      return NextResponse.json({ 
        error: 'Fehler beim Aktualisieren der Bibliothek' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] Fehler beim Speichern der Bibliothek:', error);
    
    // Benutzerfreundliche Fehlermeldungen
    let userMessage = 'Ein unerwarteter Fehler ist aufgetreten';
    
    if (error instanceof Error) {
      // Spezielle Behandlung für Datenbankfehler
      if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
        userMessage = 'Die Verbindung zur Datenbank konnte nicht hergestellt werden. Bitte wenden Sie sich an den Administrator.';
      } else if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_DATABASE_NAME')) {
        userMessage = 'Die Datenbankkonfiguration ist unvollständig. Bitte prüfen Sie die Umgebungsvariablen.';
      } else if (error.message.includes('Datenbankverbindung fehlgeschlagen')) {
        userMessage = 'Die Datenbank ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
      } else {
        // Für andere Fehler verwende eine generische Nachricht
        userMessage = `Es ist ein Fehler aufgetreten: ${error.message}`;
      }
    }
    
    return NextResponse.json({ 
      error: userMessage,
      // Füge technische Details nur in der Entwicklungsumgebung hinzu
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unbekannter Fehler' 
      })
    }, { status: 500 });
  }
}

/**
 * PATCH /api/libraries
 * Setzt die aktive Library-ID
 */
export async function PATCH(request: NextRequest) {
  const { email, isAuthenticated } = await getUserEmail(request);
  
  if (!email) {
    return NextResponse.json({ 
      error: !isAuthenticated ? 'Nicht authentifiziert' : 'Keine E-Mail-Adresse gefunden. Bitte melden Sie sich an.' 
    }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { activeLibraryId } = body;
    
    if (!activeLibraryId) {
      return NextResponse.json({ 
        error: 'activeLibraryId ist erforderlich' 
      }, { status: 400 });
    }
    
    const libraryService = LibraryService.getInstance();
    const success = await libraryService.setActiveLibraryId(email, activeLibraryId);
    
    if (success) {
      return NextResponse.json({ 
        success: true,
        message: 'Aktive Library-ID erfolgreich gespeichert'
      });
    } else {
      return NextResponse.json({ 
        error: 'Fehler beim Speichern der aktiven Library-ID' 
      }, { status: 500 });
    }
  } catch (error) {
    
    // Benutzerfreundliche Fehlermeldungen
    let userMessage = 'Ein unerwarteter Fehler ist aufgetreten';
    
    if (error instanceof Error) {
      // Spezielle Behandlung für Datenbankfehler
      if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
        userMessage = 'Die Verbindung zur Datenbank konnte nicht hergestellt werden. Bitte wenden Sie sich an den Administrator.';
      } else if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_DATABASE_NAME')) {
        userMessage = 'Die Datenbankkonfiguration ist unvollständig. Bitte prüfen Sie die Umgebungsvariablen.';
      } else if (error.message.includes('Datenbankverbindung fehlgeschlagen')) {
        userMessage = 'Die Datenbank ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
      } else {
        // Für andere Fehler verwende eine generische Nachricht
        userMessage = `Es ist ein Fehler aufgetreten: ${error.message}`;
      }
    }
    
    return NextResponse.json({ 
      error: userMessage,
      // Füge technische Details nur in der Entwicklungsumgebung hinzu
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unbekannter Fehler' 
      })
    }, { status: 500 });
  }
}

/**
 * DELETE /api/libraries
 * Löscht eine Bibliothek
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const libraryId = searchParams.get('libraryId');
  
  if (!libraryId) {
    return NextResponse.json({ 
      error: 'Library-ID fehlt' 
    }, { status: 400 });
  }
  
  const { email, isAuthenticated } = await getUserEmail(request);
  
  if (!email) {
    return NextResponse.json({ 
      error: !isAuthenticated ? 'Nicht authentifiziert' : 'Keine E-Mail-Adresse gefunden. Bitte melden Sie sich an.' 
    }, { status: 401 });
  }
  
  try {
    const libraryService = LibraryService.getInstance();
    const success = await libraryService.deleteLibrary(email, libraryId);
    
    if (success) {
      return NextResponse.json({ 
        success: true,
        message: 'Bibliothek erfolgreich gelöscht'
      });
    } else {
      return NextResponse.json({ 
        error: 'Bibliothek nicht gefunden oder konnte nicht gelöscht werden' 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('[API] Fehler beim Löschen der Bibliothek:', error);
    
    // Benutzerfreundliche Fehlermeldungen
    let userMessage = 'Ein unerwarteter Fehler ist aufgetreten';
    
    if (error instanceof Error) {
      // Spezielle Behandlung für Datenbankfehler
      if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
        userMessage = 'Die Verbindung zur Datenbank konnte nicht hergestellt werden. Bitte wenden Sie sich an den Administrator.';
      } else if (error.message.includes('MONGODB_URI') || error.message.includes('MONGODB_DATABASE_NAME')) {
        userMessage = 'Die Datenbankkonfiguration ist unvollständig. Bitte prüfen Sie die Umgebungsvariablen.';
      } else if (error.message.includes('Datenbankverbindung fehlgeschlagen')) {
        userMessage = 'Die Datenbank ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
      } else {
        // Für andere Fehler verwende eine generische Nachricht
        userMessage = `Es ist ein Fehler aufgetreten: ${error.message}`;
      }
    }
    
    return NextResponse.json({ 
      error: userMessage,
      // Füge technische Details nur in der Entwicklungsumgebung hinzu
      ...(process.env.NODE_ENV === 'development' && { 
        details: error instanceof Error ? error.message : 'Unbekannter Fehler' 
      })
    }, { status: 500 });
  }
} 