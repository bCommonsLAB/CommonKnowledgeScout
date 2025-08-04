import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-service';
import { UserLibraries } from '@/lib/services/library-service';

export async function GET() {
  try {
    console.log('[DEBUG] Abfrage aller Library-Einträge');
    
    // Verbindung zur Datenbank herstellen
    const db = await connectToDatabase();
    
    // Collection abrufen
    const collection = db.collection<UserLibraries>(
      process.env.MONGODB_COLLECTION_NAME || 'libraries'
    );
    
    // Alle Einträge abfragen (begrenzt auf 100)
    const entries = await collection.find({}).limit(100).toArray();
    
    // KRITISCH: Peter-spezifische Analyse mit vollständigen Passwörtern
    const peterEntry = entries.find(entry => entry.email === 'peter.aichner@crystal-design.com');
    
    if (peterEntry) {
      console.log('[DEBUG-LIBRARIES] PETERS DIREKTE DATENBANK-DATEN:', JSON.stringify(peterEntry, null, 2));
      
      const nextcloudLib = peterEntry.libraries.find(lib => lib.id === 'e9e54ddc-6907-4ebb-8bf6-7f3f880c710a');
      const archivPeterLib = peterEntry.libraries.find(lib => lib.id === '_ArchivPeter');
      
      console.log('[DEBUG-LIBRARIES] PASSWORT-VERGLEICH AUS DATENBANK:', {
        nextcloudPassword: nextcloudLib?.config?.password,
        nextcloudPrefix: nextcloudLib?.config?.password ? nextcloudLib.config.password.substring(0, 6) + '***' : 'fehlt',
        archivPeterPassword: archivPeterLib?.config?.password,
        archivPeterPrefix: archivPeterLib?.config?.password ? archivPeterLib.config.password.substring(0, 6) + '***' : 'fehlt',
        passwordsIdentical: nextcloudLib?.config?.password === archivPeterLib?.config?.password
      });
    }

    // Bereite Daten für die Ausgabe vor (entferne sensible Informationen)
    const safeEntries = entries.map(entry => ({
      email: entry.email,
      name: entry.name,
      lastUpdated: entry.lastUpdated,
      librariesCount: entry.libraries.length,
      libraries: entry.libraries.map(lib => ({
        id: lib.id,
        label: lib.label,
        type: lib.type,
        isEnabled: lib.isEnabled,
        // FÜR DEBUGGING: Zeige Passwort-Prefixes
        passwordPrefix: lib.config?.password ? lib.config.password.substring(0, 6) + '***' : 'kein Passwort'
      }))
    }));
    
    return NextResponse.json({
      count: entries.length,
      entries: safeEntries
    });
  } catch (error) {
    console.error('[DEBUG] Fehler bei der Abfrage der Bibliothekseinträge:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 