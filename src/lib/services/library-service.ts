import { getCollection } from '@/lib/mongodb-service';
import { Library, ClientLibrary } from '@/types/library';

export interface UserLibraries {
  email: string;  // Statt userId eine E-Mail-Adresse verwenden
  name: string;
  libraries: Library[];
  lastUpdated: Date;
}

/**
 * Service zur Verwaltung der Bibliotheken in MongoDB
 */
export class LibraryService {
  private static instance: LibraryService;
  private collectionName: string;

  private constructor() {
    this.collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries';
  }

  public static getInstance(): LibraryService {
    if (!LibraryService.instance) {
      LibraryService.instance = new LibraryService();
    }
    return LibraryService.instance;
  }

  /**
   * Bibliotheken für einen Benutzer abrufen
   * @param email E-Mail-Adresse des Benutzers
   */
  async getUserLibraries(email: string): Promise<Library[]> {
    try {
      const collection = await getCollection<UserLibraries>(this.collectionName);
      
      // Alle Einträge mit der angegebenen E-Mail-Adresse finden
      const userEntries = await collection.find({ email }).toArray();
      
      if (!userEntries || userEntries.length === 0) {
        console.log(`Keine Einträge für Benutzer ${email} gefunden.`);
        return [];
      }
      
      // Neu: Einträge nach lastUpdated (DESC) sortieren, damit jüngste Werte bevorzugt werden
      const sortedEntries = [...userEntries].sort((a, b) => {
        const ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return tb - ta;
      });

      // Alle Bibliotheken aus allen gefundenen (sortierten) Einträgen sammeln
      const allLibraries: Library[] = [];
      sortedEntries.forEach(entry => {
        if (entry.libraries && Array.isArray(entry.libraries)) {
          allLibraries.push(...entry.libraries);
        }
      });
      
      // Deduplizierung basierend auf ID (nur die erste gefundene Instanz jeder ID behalten)
      const uniqueLibraries: Library[] = [];
      const seenIds = new Set<string>();
      
      for (const lib of allLibraries) {
        if (!seenIds.has(lib.id)) {
          seenIds.add(lib.id);
          uniqueLibraries.push(lib);
        } else {
          console.log(`Duplikat gefunden und übersprungen: Bibliothek mit ID ${lib.id} (${lib.label})`);
        }
      }
      
      return uniqueLibraries;
    } catch (error) {
      console.error('Fehler beim Abrufen der Bibliotheken:', error);
      throw error;
    }
  }

  /**
   * Bibliothek für einen Benutzer abrufen
   * @param email E-Mail-Adresse des Benutzers
   * @param libraryId ID der Bibliothek
   */
  async getLibrary(email: string, libraryId: string): Promise<Library | null> {
    try {
      const libraries = await this.getUserLibraries(email);
      return libraries.find(lib => lib.id === libraryId && lib.isEnabled) || null;
    } catch (error) {
      console.error('Fehler beim Abrufen der Bibliothek:', error);
      throw error;
    }
  }

  /**
   * Bibliotheken für einen Benutzer aktualisieren oder erstellen
   * @param email E-Mail-Adresse des Benutzers
   * @param libraries Liste der Bibliotheken
   * @param userName Benutzername (optional)
   */
  async updateUserLibraries(email: string, libraries: Library[], userName?: string): Promise<boolean> {
    try {
      const collection = await getCollection<UserLibraries>(this.collectionName);
      
      // Prüfen, ob bereits ein Eintrag existiert
      const existingEntry = await collection.findOne({ email });
      
      if (existingEntry) {
        // Vorhandenen Eintrag aktualisieren
        const result = await collection.updateOne(
          { email },
          { 
            $set: { 
              libraries,
              name: userName || existingEntry.name || 'Unbekannter Benutzer',
              lastUpdated: new Date()
            } 
          }
        );
        
        return result.acknowledged;
      } else {
        // Neuen Eintrag erstellen
        const result = await collection.insertOne({
          email,
          name: userName || 'Unbekannter Benutzer',
          libraries,
          lastUpdated: new Date()
        });
        
        return result.acknowledged;
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Bibliotheken:', error);
      return false;
    }
  }

  /**
   * Einzelne Bibliothek aktualisieren
   * @param email E-Mail-Adresse des Benutzers
   * @param updatedLibrary Aktualisierte Bibliothek
   */
  async updateLibrary(email: string, updatedLibrary: Library): Promise<boolean> {
    try {
      console.log('[LibraryService] === UPDATE LIBRARY START ===');
      console.log('[LibraryService] Aktualisiere Library:', updatedLibrary.id);
      console.log('[LibraryService] Config vor Update:', {
        hasClientSecret: !!updatedLibrary.config?.clientSecret,
        clientSecretValue: updatedLibrary.config?.clientSecret,
        configKeys: updatedLibrary.config ? Object.keys(updatedLibrary.config) : []
      });
      
      const libraries = await this.getUserLibraries(email);
      const index = libraries.findIndex(lib => lib.id === updatedLibrary.id);
      
      if (index === -1) {
        // Wenn die Bibliothek nicht existiert, hinzufügen
        libraries.push(updatedLibrary);
      } else {
        // Sonst aktualisieren
        libraries[index] = updatedLibrary;
      }
      
      console.log('[LibraryService] Rufe updateUserLibraries auf...');
      const result = await this.updateUserLibraries(email, libraries);
      console.log('[LibraryService] Update-Ergebnis:', result);
      console.log('[LibraryService] === UPDATE LIBRARY END ===');
      
      return result;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Bibliothek:', error);
      return false;
    }
  }

  /**
   * Bibliothek löschen
   * @param email E-Mail-Adresse des Benutzers
   * @param libraryId ID der Bibliothek
   */
  async deleteLibrary(email: string, libraryId: string): Promise<boolean> {
    try {
      const libraries = await this.getUserLibraries(email);
      const filteredLibraries = libraries.filter(lib => lib.id !== libraryId);
      
      if (filteredLibraries.length === libraries.length) {
        // Keine Änderung, Bibliothek existiert nicht
        return false;
      }
      
      return this.updateUserLibraries(email, filteredLibraries);
    } catch (error) {
      console.error('Fehler beim Löschen der Bibliothek:', error);
      return false;
    }
  }

  /**
   * Aktuelle Bibliotheken in MongoDB speichern (Initial)
   */
  async saveCurrentLibraries(libraries: Library[]): Promise<boolean> {
    // Speichern für den Default-Benutzer
    return this.updateUserLibraries('default@example.com', libraries);
  }

  /**
   * Sichere Client-Bibliotheken aus vollständigen Bibliotheken erstellen
   */
  toClientLibraries(libraries: Library[]): ClientLibrary[] {
    console.log('[LibraryService] === TO CLIENT LIBRARIES START ===');
    
    return libraries.map(lib => {
      // Debug: Zeige Chat-Config vor dem Mapping
      if (lib.config?.chat) {
        console.log(`[LibraryService] Library ${lib.id} Chat-Config:`, {
          hasGallery: !!(lib.config.chat as { gallery?: unknown }).gallery,
          detailViewType: ((lib.config.chat as { gallery?: { detailViewType?: unknown } }).gallery)?.detailViewType,
          facetsCount: Array.isArray(((lib.config.chat as { gallery?: { facets?: unknown } }).gallery)?.facets) 
            ? ((lib.config.chat as { gallery?: { facets?: unknown[] } }).gallery)!.facets!.length 
            : 0
        });
      }
      
      // Basis-Konfiguration für alle Bibliothekstypen (nur sichere Felder)
      const baseConfig = {
        transcription: lib.transcription,
        secretaryService: lib.config?.secretaryService,
        // Chat-/Galerie-Settings sind sicher und werden an den Client geliefert
        chat: lib.config?.chat
      } as Record<string, unknown>;
      
      // Zusätzliche Konfiguration basierend auf dem Bibliothekstyp
      let config: Record<string, unknown> = { ...baseConfig };
      
      // Für OneDrive-Bibliotheken die OAuth-Parameter hinzufügen
      if (lib.type === 'onedrive') {
        console.log(`[LibraryService] Verarbeite OneDrive Library ${lib.id}:`, {
          hasClientSecret: !!lib.config?.clientSecret,
          clientSecretValue: lib.config?.clientSecret,
          willMask: !!lib.config?.clientSecret
        });
        
        config = {
          ...config,
          tenantId: lib.config?.tenantId,
          clientId: lib.config?.clientId,
          // Client Secret maskiert senden, wenn vorhanden
          clientSecret: lib.config?.clientSecret ? '********' : undefined,
          redirectUri: lib.config?.redirectUri,
          // Tokens werden NICHT mehr in der Datenbank gespeichert
          // Der Client muss den Token-Status aus localStorage prüfen
        };
        
        console.log(`[LibraryService] OneDrive Config nach Maskierung:`, {
          clientSecretValue: config.clientSecret
        });
      }
      
      // Gleiches für andere OAuth-Provider wie Google Drive
      if (lib.type === 'gdrive') {
        config = {
          ...config,
          clientId: lib.config?.clientId,
          // Client Secret maskiert senden, wenn vorhanden
          clientSecret: lib.config?.clientSecret ? '********' : undefined,
          redirectUri: lib.config?.redirectUri,
          // Tokens werden NICHT mehr in der Datenbank gespeichert
          // Der Client muss den Token-Status aus localStorage prüfen
        };
      }
      
      const result = {
        id: lib.id,
        label: lib.label,
        type: lib.type,
        path: lib.path || '',
        isEnabled: lib.isEnabled,
        config
      };
      
      console.log('[LibraryService] === TO CLIENT LIBRARIES END ===');
      
      return result;
    });
  }
} 