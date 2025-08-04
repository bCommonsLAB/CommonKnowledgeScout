import { StorageError } from './types';
import { ClientLibrary, Library, StorageConfig } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';
import * as process from 'process';
import { ServerLogger } from '@/lib/debug/server-logger';

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
   * @returns Tokens bei Erfolg, null bei Fehler
   */
  public async authenticate(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    try {
      ServerLogger.auth('OneDriveServerProvider', 'Starte Authentifizierung', {
        libraryId: this.library.id,
        userEmail: this.userEmail,
        hasCode: !!code,
        codeLength: code?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Konfigurationswerte aus der Bibliothek laden
      const config = this.getRequiredConfigValues();
      const { tenantId, clientId, clientSecret, redirectUri } = config;
      
      ServerLogger.auth('OneDriveServerProvider', 'Konfigurationswerte validiert', {
        libraryId: this.library.id,
        tenantId: tenantId || 'nicht vorhanden',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasRedirectUri: !!redirectUri,
        timestamp: new Date().toISOString()
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
      ServerLogger.auth('OneDriveServerProvider', 'Sende Token-Request an Microsoft', {
        libraryId: this.library.id,
        tokenEndpoint,
        grantType: 'authorization_code',
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        ServerLogger.auth('OneDriveServerProvider', 'Token-Exchange fehlgeschlagen', {
          libraryId: this.library.id,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          error: errorData.error,
          errorDescription: errorData.error_description,
          timestamp: new Date().toISOString()
        });
        
        console.error('[OneDriveServerProvider] Token-Fehler:', errorData);
        throw new StorageError(
          `Token-Austausch fehlgeschlagen: ${errorData.error_description || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      
      ServerLogger.auth('OneDriveServerProvider', 'Token erfolgreich von Microsoft erhalten', {
        libraryId: this.library.id,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
        accessTokenLength: data.access_token?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Tokens direkt zurückgeben (Browser-only Speicherung)
      ServerLogger.auth('OneDriveServerProvider', 'Tokens erfolgreich erhalten - Browser-only Speicherung', {
        libraryId: this.library.id,
        userEmail: this.userEmail,
        expiresIn: data.expires_in,
        timestamp: new Date().toISOString()
      });
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } catch (error) {
      ServerLogger.auth('OneDriveServerProvider', 'Authentifizierung fehlgeschlagen', {
        libraryId: this.library.id,
        userEmail: this.userEmail,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof StorageError ? error.code : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      });
      
      console.error('[OneDriveServerProvider] Authentifizierungsfehler:', error);
      return null;
    }
  }
  
  /**
   * Speichert die Tokens TEMPORÄR in der Datenbank
   * Diese werden vom Client einmalig abgerufen und dann gelöscht
   */
  private async saveTokensTemporarily(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    try {
      const expiryTime = Math.floor(Date.now() / 1000) + expiresIn;
      
      ServerLogger.info('OneDriveServerProvider', 'Speichere Tokens TEMPORÄR für Client-Transfer');
      
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
      
      ServerLogger.info('OneDriveServerProvider', 'Tokens temporär gespeichert für Client-Abruf');
    } catch (error) {
      console.error('[OneDriveServerProvider] Fehler beim temporären Speichern der Tokens:', error);
      throw error;
    }
  }
} 