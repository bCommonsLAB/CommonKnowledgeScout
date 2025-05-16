import { StorageError } from './types';
import { ClientLibrary, Library, StorageConfig } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';
import * as process from 'process';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Serverseitige Implementierung des OneDrive Providers
 * Enthält nur die für die Authentifizierung notwendigen Methoden
 */
export class OneDriveServerProvider {
  private library: ClientLibrary;
  private userEmail: string;
  
  constructor(library: ClientLibrary, userEmail: string) {
    this.library = library;
    this.userEmail = userEmail;
  }
  
  // Implementiere nur die für die Authentifizierung notwendigen Teile
  get id(): string {
    return this.library.id;
  }
  
  /**
   * Extrahiert die für die Authentifizierung erforderlichen Konfigurationswerte
   * aus der Bibliothekskonfiguration und prüft deren Vollständigkeit
   */
  private getRequiredConfigValues() {
    // Die Konfigurationswerte direkt aus der Bibliothek extrahieren
    let tenantId = this.library.config?.tenantId || '';
    let clientId = this.library.config?.clientId || '';
    let clientSecret = this.library.config?.clientSecret || '';
    let redirectUri = this.library.config?.redirectUri || '';
    
    // Prüfen, ob clientSecret maskiert ist (mit Sternchen beginnt)
    const clientSecretStr = clientSecret as string;
    const isMaskedSecret = clientSecretStr && clientSecretStr.startsWith('*');
    
    // Umgebungsvariablen für fehlende oder maskierte Werte verwenden
    if (!tenantId) tenantId = process.env.MS_TENANT_ID || 'common';
    if (!clientId) clientId = process.env.MS_CLIENT_ID || '';
    if (!clientSecret || isMaskedSecret) clientSecret = process.env.MS_CLIENT_SECRET || '';
    if (!redirectUri) redirectUri = process.env.MS_REDIRECT_URI || '';
    
    // Liste der fehlenden Werte zusammenstellen
    const missingValues = [
      !clientId ? 'Client ID' : '',
      !clientSecret ? 'Client Secret' : '',
      !redirectUri ? 'Redirect URI' : ''
    ].filter(Boolean).join(', ');
    
    return {
      tenantId: tenantId || 'common', // Für tenantId ist 'common' ein gültiger Default
      clientId,
      clientSecret,
      redirectUri,
      // Prüfen, ob alle erforderlichen Werte vorhanden sind
      hasAllRequired: !!clientId && !!clientSecret && !!redirectUri,
      // Bei fehlenden Werten eine Fehlermeldung erzeugen
      missingValues
    };
  }
  
  /**
   * Führt die Authentifizierung mit dem erhaltenen Code durch
   * @param code Der Authentifizierungscode von Microsoft
   * @returns true, wenn die Authentifizierung erfolgreich war
   */
  public async authenticate(code: string): Promise<boolean> {
    try {
      // Konfigurationswerte aus der Bibliothek laden
      const config = this.getRequiredConfigValues();
      const { tenantId, clientId, clientSecret, redirectUri, hasAllRequired, missingValues } = config;
      
      console.log(`[OneDriveServerProvider] Authentifizierung mit gespeicherten Konfigurationswerten`, {
        tenantId: tenantId || 'common',
        clientId: clientId ? 'vorhanden' : 'nicht vorhanden',
        clientSecret: clientSecret ? 'vorhanden' : 'nicht vorhanden',
        redirectUri: redirectUri || 'nicht vorhanden',
        hasAllRequired
      });

      // Prüfen, ob alle erforderlichen Werte vorhanden sind
      if (!hasAllRequired) {
        throw new StorageError(
          `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingValues}`,
          "CONFIG_ERROR",
          this.id
        );
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId || 'common'}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: clientId as string,
        client_secret: clientSecret as string,
        code,
        redirect_uri: redirectUri as string,
        grant_type: 'authorization_code',
      });

      // Request zum Token-Endpunkt senden
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[OneDriveServerProvider] Token-Fehler:', errorData);
        throw new StorageError(
          `Token-Austausch fehlgeschlagen: ${errorData.error_description || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      console.log('[OneDriveServerProvider] Token erfolgreich erhalten');
      
      // Tokens in der Bibliothekskonfiguration speichern
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      
      return true;
    } catch (error) {
      console.error('[OneDriveServerProvider] Authentifizierungsfehler:', error);
      throw error;
    }
  }
  
  /**
   * Speichert die Tokens in der Datenbank
   * Diese Methode speichert die Tokens direkt über den LibraryService
   */
  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    try {
      // Aktuelle Zeit in Sekunden + Ablaufzeit
      const expiryTime = Math.floor(Date.now() / 1000) + expiresIn;
      
      console.log('[OneDriveServerProvider] Speichere Tokens in der Bibliothekskonfiguration...');
      
      // LibraryService holen
      const libraryService = LibraryService.getInstance();
      
      // Zuerst die vollständigen Bibliotheksdaten abrufen
      const libraries = await libraryService.getUserLibraries(this.userEmail);
      const existingLibrary = libraries.find(lib => lib.id === this.library.id);
      
      if (!existingLibrary) {
        throw new Error(`Bibliothek mit ID ${this.library.id} nicht gefunden`);
      }
      
      // Erstelle eine neue Config mit den Token-Werten als dynamische Properties
      const updatedConfig: Record<string, any> = {
        ...(existingLibrary.config || {})
      };
      
      // Token als dynamische Properties setzen
      updatedConfig['accessToken'] = accessToken;
      updatedConfig['refreshToken'] = refreshToken;
      updatedConfig['tokenExpiry'] = expiryTime.toString();
      
      // Die existierende Library mit den neuen Token aktualisieren
      const updatedLibrary: Library = {
        ...existingLibrary,
        config: updatedConfig as StorageConfig,
        // Erzwinge den korrekten Typ
        type: 'onedrive'
      };
      
      const success = await libraryService.updateLibrary(this.userEmail, updatedLibrary);
      
      if (!success) {
        throw new Error('Bibliotheksupdate fehlgeschlagen (kein Erfolg zurückgegeben)');
      }
      
      console.log('[OneDriveServerProvider] Tokens erfolgreich gespeichert');
    } catch (error) {
      console.error('[OneDriveServerProvider] Fehler beim Speichern der Tokens:', error);
      throw error;
    }
  }
} 