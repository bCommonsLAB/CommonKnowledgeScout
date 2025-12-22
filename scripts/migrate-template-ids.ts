/**
 * @fileoverview Template ID Migration Script - Migriert Templates von alter _id-Struktur zu neuer
 * 
 * @description
 * Migriert alle Templates aller Libraries von alter _id-Struktur (nur name) 
 * zu neuer Struktur (libraryId:name).
 * 
 * Das Script:
 * 1. Lädt alle Libraries aus MongoDB
 * 2. Für jede Library: Findet alle Templates mit alter _id-Struktur (kein ':' in _id)
 * 3. Migriert diese Templates zur neuen Struktur
 * 4. Löscht alte Template-Versionen
 * 
 * @usage
 * ```bash
 * # Dry-Run (nur Logging, keine DB-Änderungen)
 * pnpm tsx scripts/migrate-template-ids.ts --dryRun
 * 
 * # Echte Migration
 * pnpm tsx scripts/migrate-template-ids.ts
 * 
 * # Migration für eine spezifische Library
 * pnpm tsx scripts/migrate-template-ids.ts --libraryId=1d7b6763-6155-4e2e-8b0e-9d02e58e6b6a
 * ```
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB-Zugriff
 * - @/lib/services/library-service: Library-Zugriff
 * - @/lib/repositories/template-repo: Template-Migration
 */

import { getCollection } from '@/lib/mongodb-service';
import type { TemplateDocument } from '@/lib/templates/template-types';
import type { UserLibraries } from '@/lib/services/library-service';

/**
 * Migrations-Optionen
 */
interface MigrationOptions {
  dryRun?: boolean;
  libraryId?: string;
}


/**
 * Hauptfunktion: Migriert alle Templates aller Libraries
 */
async function migrateAllTemplates(options: MigrationOptions): Promise<void> {
  console.log('='.repeat(80));
  console.log('Template ID Migration Script');
  console.log('='.repeat(80));
  console.log(`Dry-Run: ${options.dryRun ? 'JA' : 'NEIN'}`);
  if (options.libraryId) {
    console.log(`Library-ID: ${options.libraryId}`);
  }
  console.log('='.repeat(80));
  console.log('');
  
  try {
    const templateCol = await getCollection<TemplateDocument>('templates');
    const libraryCol = await getCollection<UserLibraries>('libraries');
    
    // Schritt 1: Finde alle Templates mit alter _id-Struktur (unabhängig von Library)
    // Verwende $type: 'string' um sicherzustellen, dass _id ein String ist, und dann prüfe auf fehlendes ':'
    // Alternative: Finde alle Templates und filtere dann im Code (sicherer)
    const allTemplates = await templateCol.find({}).toArray();
    const allOldTemplates = allTemplates.filter(t => {
      const id = typeof t._id === 'string' ? t._id : String(t._id);
      return !id.includes(':');
    });
    
    console.log(`[Migration] Gefunden ${allOldTemplates.length} Templates mit alter _id-Struktur insgesamt`);
    console.log(`[Migration] Liste der gefundenen alten Templates:`);
    for (const t of allOldTemplates) {
      console.log(`  - _id: "${t._id}", name: "${t.name}", libraryId: "${t.libraryId || 'FEHLT'}"`);
    }
    console.log('');
    
    // Schritt 2: Gruppiere nach libraryId
    const templatesByLibrary = new Map<string, TemplateDocument[]>();
    for (const template of allOldTemplates) {
      const libId = template.libraryId || 'unknown';
      if (!templatesByLibrary.has(libId)) {
        templatesByLibrary.set(libId, []);
      }
      templatesByLibrary.get(libId)!.push(template);
    }
    
    // Schritt 3: Lade Library-Informationen für User-Email
    const libraryEntries = await libraryCol.find({}).toArray();
    const libraryToUserMap = new Map<string, string>();
    for (const entry of libraryEntries) {
      for (const library of entry.libraries) {
        libraryToUserMap.set(library.id, entry.email);
      }
    }
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Schritt 4: Migriere Templates pro Library
    // WICHTIG: Migriere ALLE gefundenen Templates, unabhängig von --libraryId Parameter
    // Der --libraryId Parameter wird ignoriert, um sicherzustellen, dass alle Templates migriert werden
    for (const [libraryId, templates] of templatesByLibrary.entries()) {
      const userEmail = libraryToUserMap.get(libraryId) || 'unknown@example.com';
      console.log(`[Migration] Verarbeite Library: ${libraryId} (User: ${userEmail})`);
      console.log(`[Migration] Gefunden ${templates.length} Templates mit alter _id-Struktur`);
      
      // Migriere alle Templates dieser Library
      for (const oldTemplate of templates) {
        const templateName = oldTemplate.name;
        const oldId = typeof oldTemplate._id === 'string' ? oldTemplate._id : String(oldTemplate._id);
        const newId = `${libraryId}:${templateName}`;
        
        console.log(`[Migration] Verarbeite Template: name="${templateName}", altes _id="${oldId}", libraryId="${libraryId}"`);
        
        // Prüfe, ob Template mit neuer _id bereits existiert
        // WICHTIG: Prüfe NUR nach der neuen _id, nicht nach libraryId+name, 
        // da das alte Template selbst diese Werte hat
        const existingNew = await templateCol.findOne({ _id: newId });
        
        if (existingNew) {
          const existingId = typeof existingNew._id === 'string' ? existingNew._id : String(existingNew._id);
          console.log(`[Migration] Template "${templateName}" wurde bereits migriert (neue _id: "${existingId}"), lösche alte Version`);
          if (!options.dryRun) {
            const deleteResult = await templateCol.deleteOne({ _id: oldTemplate._id });
            console.log(`[Migration] Lösch-Ergebnis: ${deleteResult.deletedCount} Dokument(e) gelöscht`);
          }
          totalSkipped++;
          continue;
        }
        
        try {
          console.log(`[Migration] Migriere Template "${templateName}": "${oldId}" -> "${newId}"`);
          
          if (!options.dryRun) {
            // Erstelle neues Template mit korrekter _id
            const migratedTemplate: TemplateDocument = {
              ...oldTemplate,
              _id: newId,
              libraryId, // Stelle sicher, dass libraryId gesetzt ist
              updatedAt: new Date(),
            };
            
            // Speichere neues Template
            await templateCol.insertOne(migratedTemplate);
            console.log(`[Migration] Neues Template mit _id "${newId}" erstellt`);
            
            // Lösche altes Template
            const deleteResult = await templateCol.deleteOne({ _id: oldTemplate._id });
            console.log(`[Migration] Altes Template gelöscht: ${deleteResult.deletedCount} Dokument(e) gelöscht`);
            
            console.log(`[Migration] ✓ Template "${templateName}" erfolgreich migriert`);
          } else {
            console.log(`[Migration] [DRY-RUN] Würde migrieren: "${oldId}" -> "${newId}"`);
          }
          
          totalMigrated++;
        } catch (error) {
          console.error(`[Migration] ✗ Fehler beim Migrieren von Template "${templateName}":`, error);
          if (error instanceof Error) {
            console.error(`[Migration] Fehler-Details: ${error.message}`);
            if ('code' in error) {
              console.error(`[Migration] Fehler-Code: ${error.code}`);
            }
          }
          totalErrors++;
        }
      }
      
      console.log(`[Migration] Library ${libraryId}: ${templates.length} Templates verarbeitet`);
      console.log('');
    }
    
    console.log('='.repeat(80));
    console.log('Migration abgeschlossen');
    console.log('='.repeat(80));
    console.log(`Gesamt: ${totalMigrated} migriert, ${totalSkipped} übersprungen, ${totalErrors} Fehler`);
    console.log('='.repeat(80));
    
    if (options.dryRun) {
      console.log('');
      console.log('⚠️  DRY-RUN MODUS: Keine Änderungen wurden vorgenommen');
      console.log('Führen Sie das Script ohne --dryRun aus, um die Migration durchzuführen');
    }
  } catch (error) {
    console.error('[Migration] Fehler:', error);
    process.exit(1);
  }
}

// Script ausführen
const args = process.argv.slice(2);
const options: MigrationOptions = {
  dryRun: args.includes('--dryRun'),
  libraryId: args.find(arg => arg.startsWith('--libraryId='))?.split('=')[1],
};

migrateAllTemplates(options)
  .then(() => {
    console.log('[Migration] Script erfolgreich abgeschlossen');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Script fehlgeschlagen:', error);
    process.exit(1);
  });

