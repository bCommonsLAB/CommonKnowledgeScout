import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-service';

/**
 * GET /api/db-test
 * Testet die Verbindung zur MongoDB und gibt den Status zurück
 */
export async function GET() {
  try {
    console.log('[DB-TEST] Teste MongoDB-Verbindung...');
    
    // Versuch, eine Verbindung zur Datenbank herzustellen
    const db = await connectToDatabase();
    
    // Basisinformationen
    const dbInfo = {
      name: db.databaseName,
      collections: await db.listCollections().toArray()
    };
    
    // Überprüfe die Libraries-Collection
    const librariesCollection = db.collection(process.env.MONGODB_COLLECTION_NAME || 'libraries');
    const count = await librariesCollection.countDocuments();
    
    // Rufe den ersten Eintrag ab, falls vorhanden
    const sampleEntry = count > 0 ? await librariesCollection.findOne({}) : null;
    
    return NextResponse.json({
      success: true,
      message: 'MongoDB-Verbindung erfolgreich',
      database: {
        name: dbInfo.name,
        collections: dbInfo.collections.map(c => c.name),
        url: process.env.MONGODB_URI ? 'Konfiguriert (versteckt)' : 'Nicht konfiguriert',
      },
      libraries: {
        collectionName: process.env.MONGODB_COLLECTION_NAME || 'libraries',
        documentsCount: count,
        hasSampleData: sampleEntry !== null,
        sampleUserIds: sampleEntry ? [sampleEntry.userId] : []
      }
    });
  } catch (error) {
    console.error('[DB-TEST] Fehler bei der MongoDB-Verbindung:', error);
    
    return NextResponse.json({ 
      success: false,
      message: 'Fehler bei der MongoDB-Verbindung',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      config: {
        uri: process.env.MONGODB_URI ? 'Konfiguriert (versteckt)' : 'Nicht konfiguriert',
        dbName: process.env.MONGODB_DATABASE_NAME || 'nicht konfiguriert',
        collectionName: process.env.MONGODB_COLLECTION_NAME || 'nicht konfiguriert'
      }
    }, { status: 500 });
  }
} 