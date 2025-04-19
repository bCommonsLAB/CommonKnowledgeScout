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
        isEnabled: lib.isEnabled
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