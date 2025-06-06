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
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    return NextResponse.json(clientLibraries);
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der Bibliotheken:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
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
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
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
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
    }, { status: 500 });
  }
} 