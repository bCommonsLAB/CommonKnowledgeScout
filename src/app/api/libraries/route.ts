import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { Library } from '@/types/library';
import { getServerAuth } from '@/lib/auth/server';

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 * Unterstützt sowohl Clerk als auch Offline-Modus
 */
async function getUserEmail(request: NextRequest): Promise<{ email: string | null; isAuthenticated: boolean }> {
  // Prüfen, ob ein Test-E-Mail-Parameter verwendet wird
  const searchParams = request.nextUrl.searchParams;
  const testEmail = searchParams.get('email');
  
  if (testEmail) {
    return { email: testEmail, isAuthenticated: true };
  }
  
  // Verwende die neue Auth-Abstraktionsschicht
  try {
    const authResult = await getServerAuth(request);
    
    if (!authResult.userId || !authResult.user) {
      return { email: null, isAuthenticated: false };
    }
    
    return { 
      email: authResult.user.email, 
      isAuthenticated: true 
    };
  } catch (error) {
    console.warn('Auth-Fehler in getUserEmail:', error);
    return { email: null, isAuthenticated: false };
  }
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
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    return NextResponse.json(clientLibraries);
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