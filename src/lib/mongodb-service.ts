/**
 * @fileoverview MongoDB Database Service
 * 
 * @description
 * Provides MongoDB connection management and collection access for the application.
 * Handles connection pooling, error handling, and database operations. Uses singleton
 * pattern to maintain a single MongoDB client connection across the application.
 * 
 * @module core
 * 
 * @exports
 * - connectToDatabase(): Establishes connection to MongoDB database
 * - getCollection(): Retrieves a collection from the database
 * 
 * @usedIn
 * - src/lib/services/library-service.ts: Library data operations
 * - src/lib/db/chats-repo.ts: Chat repository operations
 * - src/lib/db/queries-repo.ts: Query repository operations
 * - src/lib/external-jobs-repository.ts: External jobs repository
 * - src/lib/event-job-repository.ts: Event job repository
 * - src/app/api: API routes use database collections
 * 
 * @dependencies
 * - mongodb: MongoDB Node.js driver
 * - dotenv: Environment variable loading
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';
import * as dotenv from 'dotenv';

// Dotenv explizit laden
dotenv.config();

// Module-Export deklarieren
export {};

type MongoGlobalState = {
  client: MongoClient | null
  dbPromise: Promise<Db> | null
}

// WICHTIG (DEV/HMR):
// In `next dev` wird dieses Modul durch Hot-Reload mehrfach evaluiert.
// Ein Modul-lokales `client` führt dann zu "Topology is closed" / Race Conditions.
// Deshalb halten wir Client + Promise als Singleton auf `globalThis`.
const globalKey = '__commonKnowledgeScoutMongoClient__'
const g = globalThis as unknown as Record<string, unknown>
if (!g[globalKey]) {
  g[globalKey] = { client: null, dbPromise: null } satisfies MongoGlobalState
}

function getMongoState(): MongoGlobalState {
  return g[globalKey] as MongoGlobalState
}

async function resetMongoState(reason: unknown): Promise<void> {
  const state = getMongoState()
  const c = state.client
  state.client = null
  state.dbPromise = null
  if (c) {
    try {
      await c.close()
    } catch {
      // ignore
    }
  }
  console.error('MongoDB Verbindung zurückgesetzt:', {
    reason: reason instanceof Error ? reason.message : String(reason),
  })
}

/**
 * Stellt eine Verbindung zur MongoDB-Datenbank her
 */
export async function connectToDatabase(): Promise<Db> {
  try {
    // Während des Builds keine MongoDB-Verbindung herstellen
    // Next.js evaluiert Routen während des Builds, aber MongoDB sollte nur zur Laufzeit verwendet werden
    if (process.env.NEXT_RUNTIME === 'build') {
      throw new Error('MongoDB-Verbindung während des Builds nicht verfügbar');
    }

    const state = getMongoState()
    const dbName = process.env.MONGODB_DATABASE_NAME
    if (!dbName) {
      throw new Error('MONGODB_DATABASE_NAME ist nicht definiert')
    }

    // Wenn bereits ein Connect-Lauf aktiv ist, denselben awaiten (verhindert parallele connect()).
    if (state.dbPromise) {
      return await state.dbPromise
    }

    // Wenn Client existiert, DB zurückgeben. (Wenn Topology geschlossen ist, fangen wir das unten ab.)
    if (state.client) {
      try {
        return state.client.db(dbName)
      } catch (e) {
        await resetMongoState(e)
      }
    }

    // Wenn keine Verbindung besteht, neue aufbauen
    const uri = process.env.MONGODB_URI;
    if (!uri || uri === 'mongodb://localhost:27017/dummy') {
      console.error('Umgebungsvariablen Status:', {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_RUNTIME: process.env.NEXT_RUNTIME,
        MONGODB_URI: process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt',
        MONGODB_DATABASE_NAME: process.env.MONGODB_DATABASE_NAME ? 'Vorhanden' : 'Fehlt',
        MONGODB_COLLECTION_NAME: process.env.MONGODB_COLLECTION_NAME ? 'Vorhanden' : 'Fehlt'
      });
      throw new Error('MONGODB_URI ist nicht definiert');
    }

    console.log(`Verbindung zu MongoDB wird hergestellt... (Datenbank: ${dbName})`);

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 75000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true
    });

    state.client = client
    state.dbPromise = (async () => {
      try {
        await client.connect()
        return client.db(dbName)
      } catch (e) {
        // Wichtig: bei ECONNRESET/TopologyClosed sofort resetten, sonst bleibt ein kaputter Client im Singleton hängen.
        await resetMongoState(e)
        throw e
      }
    })()

    return await state.dbPromise
  } catch (error) {
    console.error('MongoDB Verbindungsfehler:', error)

    // Defensive: Falls eine Topology-Closed / Netzwerk-Exception hochkommt, State zurücksetzen,
    // damit der nächste Request sauber neu verbinden kann.
    const msg = error instanceof Error ? error.message : String(error)
    if (/Topology is closed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND/i.test(msg)) {
      await resetMongoState(error)
    }

    throw new Error(`Datenbankverbindung fehlgeschlagen: ${msg || 'Unbekannter Fehler'}`)
  }
}

/**
 * Holt eine Collection aus der Datenbank
 */
export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  try {
    const db = await connectToDatabase();
    return db.collection<T>(collectionName);
  } catch (error) {
    console.error(`Fehler beim Abrufen der Collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Optional: Cleanup-Funktion für die Verbindung
 */
export async function closeDatabaseConnection(): Promise<void> {
  const state = getMongoState()
  if (state.client) {
    await state.client.close()
  }
  state.client = null
  state.dbPromise = null
}

// Prozess-Beendigung behandeln
if (typeof process !== 'undefined') {
  // WICHTIG (DEV/HMR):
  // In `next dev` wird dieses Modul durch Hot-Reload ggf. mehrfach evaluiert.
  // Ohne Guard würden wir pro Reload einen weiteren SIGINT-Listener registrieren
  // → MaxListenersExceededWarning + potenziell mehrfacher Cleanup.
  const g = globalThis as unknown as Record<string, unknown>
  const key = '__commonKnowledgeScoutMongoSigintHandlerInstalled__'
  if (!g[key]) {
    g[key] = true
    process.on('SIGINT', async () => {
      await closeDatabaseConnection()
      process.exit(0)
    })
  }
} 