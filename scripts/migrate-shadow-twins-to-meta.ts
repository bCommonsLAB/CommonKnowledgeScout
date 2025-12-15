/**
 * @fileoverview Shadow-Twin Migration Script - Migriert Shadow-Twin-Dateien zu Meta-Dokumenten
 * 
 * @description
 * Migriert bestehende Libraries von Shadow-Twin-Dateien im Storage zu vollständigen
 * Item-Repräsentationen in MongoDB (MetaDocument mit docMetaJson.markdown).
 * 
 * Das Script:
 * 1. Lädt alle Meta-Dokumente einer Library
 * 2. Prüft, ob docMetaJson.markdown vorhanden ist
 * 3. Lädt fehlende Markdown-Daten aus Shadow-Twin-Dateien nach
 * 4. Migriert lokale Bildpfade zu Azure-URLs (falls nötig)
 * 5. Aktualisiert Meta-Dokumente ohne Vektoren neu zu berechnen
 * 
 * @usage
 * ```bash
 * # Dry-Run (nur Logging, keine DB-Änderungen)
 * pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=lib-123 --dryRun
 * 
 * # Echte Migration
 * pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=lib-123
 * 
 * # Migration mit Bild-Migration überspringen
 * pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=lib-123 --skipImages
 * ```
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB-Zugriff
 * - @/lib/storage/server-provider: Storage-Provider für Shadow-Twin-Zugriff
 * - @/lib/repositories/vector-repo: upsertVectorMeta für Updates
 */

import { getCollection } from '@/lib/mongodb-service';
import { getServerProvider } from '@/lib/storage/server-provider';
import { upsertVectorMeta } from '@/lib/repositories/vector-repo';
import { findShadowTwinMarkdown, findShadowTwinFolder } from '@/lib/storage/shadow-twin';
import { ImageProcessor } from '@/lib/ingestion/image-processor';
import { FileLogger } from '@/lib/debug/logger';
import type { StorageProvider } from '@/lib/storage/types';
import type { Library } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Migrations-Optionen
 */
interface MigrationOptions {
  libraryId: string;
  userEmail: string;
  dryRun?: boolean;
  skipImages?: boolean;
  force?: boolean;
}

/**
 * Migrations-Statistiken
 */
interface MigrationStats {
  total: number;
  alreadyComplete: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: Array<{ fileId: string; error: string }>;
}

/**
 * Prüft, ob ein Meta-Dokument vollständig migriert ist.
 * 
 * Ein Item gilt als migriert, wenn:
 * - docMetaJson.markdown vorhanden und nicht leer ist
 * - docMetaJson.slides (falls vorhanden) Azure-URLs enthalten
 * - docMetaJson.coverImageUrl (falls vorhanden) Azure-URL ist
 */
function isItemMigrated(metaDoc: Record<string, unknown>): boolean {
  const docMetaJson = metaDoc.docMetaJson as Record<string, unknown> | undefined;
  if (!docMetaJson) return false;
  
  // Prüfe markdown
  const markdown = docMetaJson.markdown;
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    return false;
  }
  
  // Prüfe slides (falls vorhanden)
  if (Array.isArray(docMetaJson.slides)) {
    const slides = docMetaJson.slides as Array<Record<string, unknown>>;
    for (const slide of slides) {
      const url = slide.url;
      if (typeof url === 'string' && !url.startsWith('https://') && !url.startsWith('http://')) {
        // Lokaler Pfad gefunden → nicht migriert
        return false;
      }
    }
  }
  
  // Prüfe coverImageUrl (falls vorhanden)
  const coverImageUrl = docMetaJson.coverImageUrl;
  if (typeof coverImageUrl === 'string' && !coverImageUrl.startsWith('https://') && !coverImageUrl.startsWith('http://')) {
    // Lokaler Pfad gefunden → nicht migriert
    return false;
  }
  
  return true;
}

/**
 * Lädt Shadow-Twin-Markdown aus dem Storage.
 */
async function loadShadowTwinMarkdown(
  fileId: string,
  fileName: string,
  provider: StorageProvider,
  libraryId: string
): Promise<string | null> {
  try {
    // Versuche Shadow-Twin-Verzeichnis zu finden
    const baseItem = await provider.getItemById(fileId);
    const shadowTwinFolder = await findShadowTwinFolder(
      baseItem.parentId,
      fileName,
      provider
    );
    
    if (!shadowTwinFolder) {
      FileLogger.warn('migration', 'Shadow-Twin-Verzeichnis nicht gefunden', { fileId, fileName });
      return null;
    }
    
    // Versuche Markdown-Datei zu finden (zuerst transformiert, dann transcript)
    const baseName = fileName.replace(/\.[^/.]+$/, ''); // Entferne Extension
    const markdownFile = await findShadowTwinMarkdown(
      shadowTwinFolder.id,
      baseName,
      'de', // Standard-Sprache, kann später parametrisiert werden
      provider,
      true // preferTransformed
    );
    
    if (!markdownFile) {
      FileLogger.warn('migration', 'Shadow-Twin-Markdown nicht gefunden', { fileId, fileName });
      return null;
    }
    
    // Lade Markdown-Inhalt
    const bin = await provider.getBinary(markdownFile.id);
    const markdown = await bin.blob.text();
    
    return markdown;
  } catch (error) {
    FileLogger.error('migration', 'Fehler beim Laden des Shadow-Twin-Markdown', {
      fileId,
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Migriert ein einzelnes Meta-Dokument.
 */
async function migrateItem(
  metaDoc: Record<string, unknown>,
  options: MigrationOptions,
  provider: StorageProvider,
  library: Library,
  dimension: number
): Promise<boolean> {
  const fileId = metaDoc.fileId as string;
  const fileName = metaDoc.fileName as string || '';
  
  try {
    // Prüfe, ob bereits migriert
    if (!options.force && isItemMigrated(metaDoc)) {
      FileLogger.info('migration', 'Item bereits migriert', { fileId });
      return true; // Bereits migriert, kein Fehler
    }
    
    if (options.dryRun) {
      FileLogger.info('migration', 'DRY-RUN: Würde Item migrieren', { fileId, fileName });
      return true;
    }
    
    // Lade Shadow-Twin-Markdown
    const markdown = await loadShadowTwinMarkdown(fileId, fileName, provider, options.libraryId);
    if (!markdown) {
      FileLogger.warn('migration', 'Konnte Shadow-Twin-Markdown nicht laden', { fileId, fileName });
      return false;
    }
    
    // Parse Frontmatter
    const fm = await import('@/lib/markdown/frontmatter');
    const { meta: metaFromMarkdown, body } = fm.parseFrontmatter(markdown);
    
    // Aktualisiere docMetaJson
    const docMetaJson = (metaDoc.docMetaJson as Record<string, unknown>) || {};
    const updatedDocMetaJson: Record<string, unknown> = {
      ...docMetaJson,
      ...metaFromMarkdown,
      markdown: body.trim(),
    };
    
    // Migriere Bilder auf Azure (falls nicht übersprungen)
    if (!options.skipImages) {
      // TODO: Implementiere Bild-Migration
      // - Prüfe slides, coverImageUrl, Markdown-Bilder
      // - Lade Bilder aus Storage
      // - Upload auf Azure
      // - Aktualisiere URLs in updatedDocMetaJson
      FileLogger.info('migration', 'Bild-Migration noch nicht implementiert', { fileId });
    }
    
    // Setze migrationVersion
    updatedDocMetaJson.migrationVersion = '1';
    
    // Aktualisiere Meta-Dokument
    const updatedMetaDoc = {
      ...metaDoc,
      docMetaJson: updatedDocMetaJson,
      fileId, // Stelle sicher, dass fileId enthalten ist (erforderlich für upsertVectorMeta)
    };
    
    // Speichere aktualisiertes Meta-Dokument
    await upsertVectorMeta(
      `vectors__${options.libraryId}`,
      updatedMetaDoc as Omit<import('@/lib/repositories/vector-repo').VectorDocument, '_id' | 'kind'> & { fileId: string },
      dimension,
      library
    );
    
    FileLogger.info('migration', 'Item erfolgreich migriert', { fileId, fileName });
    return true;
  } catch (error) {
    FileLogger.error('migration', 'Fehler beim Migrieren des Items', {
      fileId,
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Migriert eine Library.
 */
async function migrateLibrary(options: MigrationOptions): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    alreadyComplete: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  
  try {
    // Lade Library
    const libraryService = LibraryService.getInstance();
    const library = await libraryService.getLibrary(options.userEmail, options.libraryId);
    if (!library) {
      throw new Error(`Library ${options.libraryId} nicht gefunden`);
    }
    
    // Lade Storage-Provider
    const provider = await getServerProvider(options.userEmail, options.libraryId);
    
    // Lade Meta-Dokumente aus Vector-Collection
    const collectionName = `vectors__${options.libraryId}`;
    const collection = await getCollection(collectionName);
    
    const metaDocs = await collection.find({ kind: 'meta' }).toArray();
    stats.total = metaDocs.length;
    
    FileLogger.info('migration', 'Starte Migration', {
      libraryId: options.libraryId,
      totalItems: stats.total,
      dryRun: options.dryRun,
    });
    
    // Dimension aus Library-Config (Standard: 1024 für voyage-3-large)
    const dimension = library.config?.chat?.embeddings?.dimensions || 1024;
    
    // Migriere jedes Item
    for (const metaDoc of metaDocs) {
      const fileId = metaDoc.fileId as string;
      
      // Prüfe, ob bereits migriert
      if (!options.force && isItemMigrated(metaDoc)) {
        stats.alreadyComplete++;
        continue;
      }
      
      const success = await migrateItem(metaDoc, options, provider, library, dimension);
      if (success) {
        stats.migrated++;
      } else {
        stats.failed++;
        stats.errors.push({
          fileId,
          error: 'Migration fehlgeschlagen',
        });
      }
    }
    
    FileLogger.info('migration', 'Migration abgeschlossen', {
      libraryId: options.libraryId,
      stats,
    });
    
    return stats;
  } catch (error) {
    FileLogger.error('migration', 'Fehler bei der Migration', {
      libraryId: options.libraryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * CLI-Hauptfunktion
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse Argumente
  const options: Partial<MigrationOptions> = {
    dryRun: args.includes('--dryRun'),
    skipImages: args.includes('--skipImages'),
    force: args.includes('--force'),
  };
  
  // libraryId aus Argumenten extrahieren
  const libraryIdArg = args.find(arg => arg.startsWith('--libraryId='));
  if (!libraryIdArg) {
    console.error('Fehler: --libraryId ist erforderlich');
    console.error('Usage: pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=lib-123 [--dryRun] [--skipImages] [--force]');
    process.exit(1);
  }
  
  options.libraryId = libraryIdArg.split('=')[1];
  
  // userEmail aus Argumenten extrahieren (oder aus ENV)
  options.userEmail = process.env.USER_EMAIL || 'migration@example.com';
  
  if (!options.libraryId || !options.userEmail) {
    console.error('Fehler: libraryId und userEmail sind erforderlich');
    process.exit(1);
  }
  
  console.log('=== Shadow-Twin Migration ===');
  console.log(`Library: ${options.libraryId}`);
  console.log(`User: ${options.userEmail}`);
  console.log(`Dry-Run: ${options.dryRun ? 'JA' : 'NEIN'}`);
  console.log(`Skip Images: ${options.skipImages ? 'JA' : 'NEIN'}`);
  console.log(`Force: ${options.force ? 'JA' : 'NEIN'}`);
  console.log('');
  
  try {
    const stats = await migrateLibrary(options as MigrationOptions);
    
    console.log('=== Migrations-Statistiken ===');
    console.log(`Gesamt: ${stats.total}`);
    console.log(`Bereits migriert: ${stats.alreadyComplete}`);
    console.log(`Erfolgreich migriert: ${stats.migrated}`);
    console.log(`Fehlgeschlagen: ${stats.failed}`);
    console.log(`Übersprungen: ${stats.skipped}`);
    
    if (stats.errors.length > 0) {
      console.log('\n=== Fehler ===');
      for (const error of stats.errors) {
        console.log(`- ${error.fileId}: ${error.error}`);
      }
    }
    
    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fehler bei der Migration:', error);
    process.exit(1);
  }
}

// Nur ausführen, wenn direkt aufgerufen (nicht bei Import)
if (require.main === module) {
  main().catch(console.error);
}

export { migrateLibrary };
export type { MigrationOptions, MigrationStats };









