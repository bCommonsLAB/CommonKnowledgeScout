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
    const tenantId = this.library.config?.tenantId || '';
    const clientId = this.library.config?.clientId || '';
    const clientSecret = this.library.config?.clientSecret || '';
    const redirectUri = process.env.MS_REDIRECT_URI || '';

    // Prüfen, ob clientSecret maskiert ist (mit Sternchen beginnt)
    const isMaskedSecret = typeof clientSecret === 'string' && clientSecret.startsWith('*');

    // Liste der fehlenden Werte zusammenstellen
    const missingValues = [
      !tenantId ? 'Tenant ID' : '',
      !clientId ? 'Client ID' : '',
      !clientSecret || isMaskedSecret ? 'Client Secret' : '',
      !redirectUri ? 'Redirect URI' : ''
    ].filter(Boolean).join(', ');

    // Fehler werfen, wenn Werte fehlen
    if (!tenantId || !clientId || !clientSecret || isMaskedSecret || !redirectUri) {
      throw new StorageError(
        `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingValues}`,
        "CONFIG_ERROR",
        this.id
      );
    }

    return {
      tenantId,
      clientId,
      clientSecret,
      redirectUri
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
      const { tenantId, clientId, clientSecret, redirectUri } = config;
      
      console.log(`[OneDriveServerProvider] Authentifizierung mit gespeicherten Konfigurationswerten`, {
        tenantId,
        clientId: clientId ? 'vorhanden' : 'nicht vorhanden',
        clientSecret: clientSecret ? 'vorhanden' : 'nicht vorhanden',
        redirectUri: redirectUri || 'nicht vorhanden'
      });

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
      console.log('[OneDriveServerProvider] Token erfolgreich erhalten', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in
      });
      
      // TEMPORÄR: Tokens werden einmalig in der Datenbank gespeichert,
      // damit der Client sie abrufen und im localStorage speichern kann.
      // Der Client löscht sie dann sofort aus der Datenbank.
      await this.saveTokensTemporarily(data.access_token, data.refresh_token, data.expires_in);
      
      return true;
    } catch (error) {
      console.error('[OneDriveServerProvider] Authentifizierungsfehler:', error);
      throw error;
    }
  }
  
  /**
   * Speichert die Tokens TEMPORÄR in der Datenbank
   * Diese werden vom Client einmalig abgerufen und dann gelöscht
   */
  private async saveTokensTemporarily(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    try {
      const expiryTime = Math.floor(Date.now() / 1000) + expiresIn;
      
      console.log('[OneDriveServerProvider] Speichere Tokens TEMPORÄR für Client-Transfer...');
      
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(this.userEmail);
      const existingLibrary = libraries.find(lib => lib.id === this.library.id);
      
      if (!existingLibrary) {
        throw new Error(`Bibliothek mit ID ${this.library.id} nicht gefunden`);
      }
      
      const updatedConfig: Record<string, unknown> = {
        ...(existingLibrary.config || {})
      };
      
      // Tokens temporär speichern
      updatedConfig['tempAccessToken'] = accessToken;
      updatedConfig['tempRefreshToken'] = refreshToken;
      updatedConfig['tempTokenExpiry'] = expiryTime.toString();
      updatedConfig['tempTokensAvailable'] = true;
      
      const updatedLibrary: Library = {
        ...existingLibrary,
        config: updatedConfig as StorageConfig,
        type: 'onedrive'
      };
      
      const success = await libraryService.updateLibrary(this.userEmail, updatedLibrary);
      
      if (!success) {
        throw new Error('Bibliotheksupdate fehlgeschlagen');
      }
      
      console.log('[OneDriveServerProvider] Tokens temporär gespeichert für Client-Abruf');
    } catch (error) {
      console.error('[OneDriveServerProvider] Fehler beim temporären Speichern der Tokens:', error);
      throw error;
    }
  }
} 