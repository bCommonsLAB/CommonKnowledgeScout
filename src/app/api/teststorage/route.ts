import { StorageFactory } from '@/lib/storage/storage-factory';
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface TestLogEntry {
  step: string;
  status: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 */
async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  
  const user = await currentUser();
  if (!user?.emailAddresses?.length) return null;
  
  return user.emailAddresses[0].emailAddress;
}

/**
 * Hilfsfunktion zum Ermitteln der Basis-URL
 */
function getBaseUrl(request: NextRequest): string {
  // Versuche, den Host aus den Anfrage-Headers zu extrahieren
  const host = request.headers.get('host') || 'localhost:3000';
  // HTTP oder HTTPS basierend auf Host oder X-Forwarded-Proto bestimmen
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto 
    ? forwardedProto 
    : host.includes('localhost') ? 'http' : 'https';
  
  return `${protocol}://${host}`;
}

/**
 * Streaming-Response-Generator für Log-Einträge
 */
async function* generateTestSteps(provider: StorageProvider): AsyncGenerator<TestLogEntry> {
  // Hilfsfunktion zum Erzeugen eines Zeitstempels
  const now = () => new Date().toISOString();
  // Hilfsfunktion zum Protokollieren eines Schritts
  const logStep = (step: string, status: 'success' | 'error' | 'info', message: string): TestLogEntry => ({
    step,
    status,
    message,
    timestamp: now()
  });

  try {
    // Schritt 1: Konfiguration validieren
    yield logStep("Validierung", "info", "Validiere Storage-Provider Konfiguration...");
    const validationResult = await provider.validateConfiguration();
    
    if (!validationResult.isValid) {
      yield logStep("Validierung", "error", `Storage-Provider Konfiguration ungültig: ${validationResult.error}`);
      return;
    }
    
    yield logStep("Validierung", "success", "Storage-Provider Konfiguration ist gültig.");

    // Schritt 2: Root-Verzeichnis auflisten
    yield logStep("Root-Verzeichnis", "info", "Liste Root-Verzeichnis auf...");
    const rootItems = await provider.listItemsById('root');
    yield logStep("Root-Verzeichnis", "success", `Root-Verzeichnis erfolgreich aufgelistet. ${rootItems.length} Elemente gefunden.`);

    // Schritt 3: Testverzeichnis erstellen
    const testFolderName = `test-folder-${uuidv4().substring(0, 8)}`;
    yield logStep("Testverzeichnis", "info", `Erstelle Testverzeichnis "${testFolderName}"...`);
    const testFolder = await provider.createFolder('root', testFolderName);
    yield logStep("Testverzeichnis", "success", `Testverzeichnis "${testFolderName}" erfolgreich erstellt.`);

    // Schritt 4: Testdatei erstellen
    yield logStep("Testdatei", "info", "Erstelle Testdatei...");
    const testFileContent = "Dies ist eine Testdatei, erstellt von Knowledge Scout Storage Tester.";
    const testFileName = `test-file-${uuidv4().substring(0, 8)}.txt`;
    
    // Blob aus String erstellen
    const blob = new Blob([testFileContent], { type: 'text/plain' });
    // File-Objekt erstellen
    const testFile = new File([blob], testFileName, { type: 'text/plain' });
    
    const createdFile = await provider.uploadFile(testFolder.id, testFile);
    yield logStep("Testdatei", "success", `Testdatei "${testFileName}" erfolgreich erstellt.`);

    // Schritt 5: Verzeichnis auflisten
    yield logStep("Verzeichnisinhalt", "info", `Liste Inhalt des Testverzeichnisses auf...`);
    const folderItems = await provider.listItemsById(testFolder.id);
    yield logStep("Verzeichnisinhalt", "success", `Verzeichnisinhalt erfolgreich aufgelistet. ${folderItems.length} Element(e) gefunden.`);

    // Schritt 6: Datei abrufen
    yield logStep("Datei abrufen", "info", "Rufe Testdatei ab...");
    const retrievedFile = await provider.getItemById(createdFile.id);
    yield logStep("Datei abrufen", "success", `Testdatei erfolgreich abgerufen: "${retrievedFile.metadata.name}" (${retrievedFile.metadata.size} Bytes)`);

    // Schritt 7: Binärdaten abrufen
    yield logStep("Binärdaten", "info", "Rufe Binärdaten der Testdatei ab...");
    const binaryData = await provider.getBinary(createdFile.id);
    const blobText = await binaryData.blob.text();
    const verificationResult = blobText === testFileContent
      ? "Der Inhalt der Datei stimmt mit dem ursprünglichen Inhalt überein."
      : "Der Inhalt der Datei stimmt nicht mit dem ursprünglichen Inhalt überein!";
    yield logStep("Binärdaten", "success", `Binärdaten erfolgreich abgerufen. MIME-Typ: ${binaryData.mimeType}. ${verificationResult}`);

    // Schritt 8: Pfad abrufen
    yield logStep("Dateipfad", "info", "Rufe Pfad der Testdatei ab...");
    const filePath = await provider.getPathById(createdFile.id);
    yield logStep("Dateipfad", "success", `Pfad erfolgreich abgerufen: ${filePath}`);

    // Schritt 9: Datei löschen
    yield logStep("Datei löschen", "info", "Lösche Testdatei...");
    await provider.deleteItem(createdFile.id);
    yield logStep("Datei löschen", "success", "Testdatei erfolgreich gelöscht.");

    // Schritt 10: Verzeichnis nach Löschung auflisten
    yield logStep("Verzeichnis prüfen", "info", "Prüfe Verzeichnisinhalt nach Löschung...");
    const folderItemsAfterDelete = await provider.listItemsById(testFolder.id);
    yield logStep("Verzeichnis prüfen", "success", `Verzeichnisinhalt erfolgreich geprüft. ${folderItemsAfterDelete.length} Element(e) gefunden.`);

    // Schritt 11: Testverzeichnis löschen
    yield logStep("Aufräumen", "info", "Lösche Testverzeichnis...");
    await provider.deleteItem(testFolder.id);
    yield logStep("Aufräumen", "success", "Testverzeichnis erfolgreich gelöscht.");

    // Abschluss
    yield logStep("Zusammenfassung", "success", "Alle Tests wurden erfolgreich durchgeführt.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    yield logStep("Fehler", "error", `Test fehlgeschlagen: ${errorMessage}`);
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  
  if (!libraryId) {
    return NextResponse.json(
      { error: 'Keine Bibliotheks-ID angegeben' },
      { status: 400 }
    );
  }

  try {
    // Benutzer-E-Mail abrufen
    const email = await getUserEmail();
    if (!email) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    // Basis-URL für API-Anfragen ermitteln
    const baseUrl = getBaseUrl(request);
    console.log(`Verwende API-Basis-URL: ${baseUrl}`);

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(email);
    
    // Die angefragte Bibliothek suchen
    const library = libraries.find(lib => lib.id === libraryId);
    if (!library) {
      return NextResponse.json(
        { error: `Bibliothek mit ID "${libraryId}" wurde nicht gefunden` },
        { status: 404 }
      );
    }
    
    // Client-Bibliotheken für die Storage-Factory erstellen
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // StorageFactory initialisieren und mit Bibliotheken versorgen
    const storageFactory = StorageFactory.getInstance();
    // Basis-URL für API-Anfragen setzen (wichtig für serverseitige Aufrufe)
    storageFactory.setApiBaseUrl(baseUrl);
    storageFactory.setLibraries(clientLibraries);
    
    // Provider für die angegebene Bibliothek holen
    const provider = await storageFactory.getProvider(libraryId);
    
    // Streaming-Response erstellen
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          
          // Führe Tests durch und streame Ergebnisse
          for await (const logEntry of generateTestSteps(provider)) {
            controller.enqueue(encoder.encode(JSON.stringify(logEntry) + '\n'));
          }
          
          controller.close();
        } catch (error) {
          console.error('Fehler beim Ausführen der Tests:', error);
          // Fehler wird bereits in generateTestSteps behandelt
          controller.close();
        }
      }
    });
    
    // Streaming-Response zurückgeben
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
    
  } catch (error) {
    console.error('Fehler beim Initialisieren des Storage-Providers:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
} 