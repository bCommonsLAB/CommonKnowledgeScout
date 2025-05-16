import { getCollection } from '@/lib/mongodb-service';
import { Library, ClientLibrary, StorageProviderType } from '@/types/library';

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
      console.log(`Bibliotheken für Benutzer ${email} werden abgerufen...`);
      const collection = await getCollection<UserLibraries>(this.collectionName);
      
      // Alle Einträge mit der angegebenen E-Mail-Adresse finden
      const userEntries = await collection.find({ email }).toArray();
      
      if (!userEntries || userEntries.length === 0) {
        console.log(`Keine Einträge für Benutzer ${email} gefunden.`);
        return [];
      }
      
      // Alle Bibliotheken aus allen gefundenen Einträgen sammeln
      const allLibraries: Library[] = [];
      userEntries.forEach(entry => {
        if (entry.libraries && Array.isArray(entry.libraries)) {
          allLibraries.push(...entry.libraries);
        }
      });
      
      console.log(`Insgesamt ${allLibraries.length} Bibliotheken für Benutzer ${email} gefunden in ${userEntries.length} Einträgen`);
      
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
      
      console.log(`Nach Deduplizierung: ${uniqueLibraries.length} einzigartige Bibliotheken`);
      
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
      console.log(`Bibliotheken für Benutzer ${email} werden aktualisiert...`);
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
        
        console.log(`Bibliotheken für Benutzer ${email} wurden aktualisiert: ${result.acknowledged}`);
        return result.acknowledged;
      } else {
        // Neuen Eintrag erstellen
        const result = await collection.insertOne({
          email,
          name: userName || 'Unbekannter Benutzer',
          libraries,
          lastUpdated: new Date()
        });
        
        console.log(`Neuer Eintrag für Benutzer ${email} wurde erstellt: ${result.acknowledged}`);
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
      const libraries = await this.getUserLibraries(email);
      const index = libraries.findIndex(lib => lib.id === updatedLibrary.id);
      
      if (index === -1) {
        // Wenn die Bibliothek nicht existiert, hinzufügen
        libraries.push(updatedLibrary);
      } else {
        // Sonst aktualisieren
        libraries[index] = updatedLibrary;
      }
      
      return this.updateUserLibraries(email, libraries);
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
    return libraries.map(lib => {
      // Basis-Konfiguration für alle Bibliothekstypen
      const baseConfig = {
        transcription: lib.transcription,
        secretaryService: lib.config?.secretaryService
      };
      
      // Zusätzliche Konfiguration basierend auf dem Bibliothekstyp
      let config: Record<string, unknown> = { ...baseConfig };
      
      // Für OneDrive-Bibliotheken die OAuth-Parameter hinzufügen
      if (lib.type === 'onedrive') {
        // Wir verwenden den config-Wert als Record<string, unknown>, 
        // um auf dynamische Eigenschaften zuzugreifen
        const configAsRecord = lib.config as Record<string, unknown>;
        
        config = {
          ...config,
          tenantId: lib.config?.tenantId,
          clientId: lib.config?.clientId,
          clientSecret: lib.config?.clientSecret,
          redirectUri: lib.config?.redirectUri,
          // Vorhandene Token ebenfalls übernehmen, falls vorhanden
          accessToken: configAsRecord?.['accessToken'],
          refreshToken: configAsRecord?.['refreshToken'],
          tokenExpiry: configAsRecord?.['tokenExpiry']
        };
      }
      
      // Gleiches für andere OAuth-Provider wie Google Drive
      if (lib.type === 'gdrive') {
        // Wir verwenden den config-Wert als Record<string, unknown>,
        // um auf dynamische Eigenschaften zuzugreifen
        const configAsRecord = lib.config as Record<string, unknown>;
        
        config = {
          ...config,
          clientId: lib.config?.clientId,
          clientSecret: lib.config?.clientSecret,
          redirectUri: lib.config?.redirectUri,
          // Vorhandene Token ebenfalls übernehmen, falls vorhanden
          accessToken: configAsRecord?.['accessToken'],
          refreshToken: configAsRecord?.['refreshToken'],
          tokenExpiry: configAsRecord?.['tokenExpiry']
        };
      }
      
      return {
        id: lib.id,
        label: lib.label,
        type: lib.type,
        path: lib.path || '',
        isEnabled: lib.isEnabled,
        config
      };
    });
  }
} 