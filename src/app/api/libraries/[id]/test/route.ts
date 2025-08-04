import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { StorageProvider } from '@/lib/storage/types';
import { SettingsLogger } from '@/lib/debug/logger';

/**
 * POST /api/libraries/[id]/test
 * Führt einen generischen Test der StorageProvider-Schnittstellen durch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: libraryId } = await params;
  
  // Benutzerauthentifizierung überprüfen
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
  }
  const userEmail = user.emailAddresses[0].emailAddress;

  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
    SettingsLogger.info('StorageTest', '=== GENERISCHER STORAGE-TEST START ===', {
      libraryId,
      userEmail,
      timestamp: new Date().toISOString()
    });

    // 1. Bibliothek laden und Client-Libraries erstellen
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    
    const library = libraries.find(lib => lib.id === libraryId);
    if (!library) {
      SettingsLogger.error('StorageTest', 'Bibliothek nicht gefunden', { libraryId });
      return NextResponse.json({ 
        error: `Bibliothek "${libraryId}" wurde nicht gefunden`,
        success: false,
        steps: []
      }, { status: 404 });
    }

    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // 2. StorageFactory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(clientLibraries);
    
    // Basis-URL für API-Anfragen setzen (wichtig für Server-zu-Server Calls)
    const baseUrl = process.env.NEXT_PUBLIC_URL || 
                   `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    storageFactory.setApiBaseUrl(baseUrl);

    SettingsLogger.info('StorageTest', 'StorageFactory initialisiert', { 
      baseUrl,
      libraryCount: clientLibraries.length 
    });

    // 3. Provider für die Bibliothek holen
    let provider: StorageProvider;
    try {
      provider = await storageFactory.getProvider(libraryId);
      SettingsLogger.info('StorageTest', 'Provider erfolgreich erstellt', {
        providerName: provider.name,
        providerId: provider.id
      });
    } catch (error) {
      SettingsLogger.error('StorageTest', 'Fehler beim Erstellen des Providers', error);
      return NextResponse.json({
        error: `Provider-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        success: false,
        steps: [
          { step: 'Provider erstellen', success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' }
        ]
      }, { status: 500 });
    }

    // 4. Generische StorageProvider-Tests durchführen
    const testSteps = [];

    // Test 1: Authentifizierung prüfen
    try {
      const isAuthenticated = provider.isAuthenticated();
      testSteps.push({
        step: 'Authentifizierung prüfen',
        success: isAuthenticated,
        details: { isAuthenticated },
        message: isAuthenticated ? 'Provider ist authentifiziert' : 'Provider benötigt Authentifizierung'
      });
      SettingsLogger.info('StorageTest', 'Authentifizierung geprüft', { isAuthenticated });
    } catch (error) {
      testSteps.push({
        step: 'Authentifizierung prüfen',
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
      SettingsLogger.error('StorageTest', 'Fehler bei Authentifizierungsprüfung', error);
    }

    // Test 2: Konfiguration validieren
    try {
      const validation = await provider.validateConfiguration();
      testSteps.push({
        step: 'Konfiguration validieren',
        success: validation.isValid,
        details: { isValid: validation.isValid, error: validation.error },
        message: validation.isValid ? 'Konfiguration ist gültig' : `Konfiguration ungültig: ${validation.error}`
      });
      SettingsLogger.info('StorageTest', 'Konfiguration validiert', validation);
    } catch (error) {
      testSteps.push({
        step: 'Konfiguration validieren',
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
      SettingsLogger.error('StorageTest', 'Fehler bei Konfigurationsvalidierung', error);
    }

    // Test 3: Root-Verzeichnis auflisten
    try {
      const rootItems = await provider.listItemsById('');
      testSteps.push({
        step: 'Root-Verzeichnis auflisten',
        success: true,
        details: { 
          itemCount: rootItems.length,
          hasItems: rootItems.length > 0,
          itemTypes: rootItems.reduce((acc: Record<string, number>, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
          }, {})
        },
        message: `${rootItems.length} Elemente im Root-Verzeichnis gefunden`
      });
      SettingsLogger.info('StorageTest', 'Root-Verzeichnis aufgelistet', { 
        itemCount: rootItems.length 
      });
    } catch (error) {
      testSteps.push({
        step: 'Root-Verzeichnis auflisten',
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
      SettingsLogger.error('StorageTest', 'Fehler beim Auflisten des Root-Verzeichnisses', error);
    }

    // Test 4: Root-Element abrufen (falls Provider das unterstützt)
    try {
      const rootItem = await provider.getItemById('');
      testSteps.push({
        step: 'Root-Element abrufen',
        success: true,
        details: { 
          rootType: rootItem.type,
          rootName: rootItem.metadata.name 
        },
        message: `Root-Element abgerufen: ${rootItem.metadata.name}`
      });
      SettingsLogger.info('StorageTest', 'Root-Element abgerufen', { 
        rootType: rootItem.type,
        rootName: rootItem.metadata.name 
      });
    } catch (error) {
      testSteps.push({
        step: 'Root-Element abrufen',
        success: false,
        error: error instanceof Error ? error.message : 'Vielleicht nicht unterstützt'
      });
      SettingsLogger.warn('StorageTest', 'Root-Element konnte nicht abgerufen werden', error);
    }

    // Erfolgs-Analyse
    const successfulSteps = testSteps.filter(step => step.success).length;
    const totalSteps = testSteps.length;
    const success = successfulSteps >= totalSteps - 1; // Erlaubt 1 fehlgeschlagenen Test

    SettingsLogger.info('StorageTest', '=== GENERISCHER STORAGE-TEST ENDE ===', {
      libraryId,
      success,
      successfulSteps,
      totalSteps,
      providerName: provider.name
    });

    return NextResponse.json({
      success,
      libraryId,
      providerName: provider.name,
      providerId: provider.id,
      summary: {
        totalSteps,
        successfulSteps,
        failedSteps: totalSteps - successfulSteps
      },
      steps: testSteps,
      message: success 
        ? `Storage-Test erfolgreich: ${successfulSteps}/${totalSteps} Tests bestanden`
        : `Storage-Test teilweise erfolgreich: ${successfulSteps}/${totalSteps} Tests bestanden`
    });

  } catch (error) {
    SettingsLogger.error('StorageTest', 'Unerwarteter Fehler beim Storage-Test', error);
    return NextResponse.json({
      error: `Storage-Test fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      success: false,
      steps: []
    }, { status: 500 });
  }
}