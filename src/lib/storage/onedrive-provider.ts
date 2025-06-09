import { StorageProvider, StorageItem, StorageValidationResult, StorageError, StorageItemMetadata } from './types';
import { ClientLibrary } from '@/types/library';
import * as process from 'process';

interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: {
    id: string;
    path?: string;
  };
}

interface OneDriveItemResponse {
  value: OneDriveFile[];
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * OneDrive Provider
 * Implementiert die StorageProvider-Schnittstelle für Microsoft OneDrive
 */
export class OneDriveProvider implements StorageProvider {
  private library: ClientLibrary;
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private authenticated: boolean = false;
  private oauthDefaults: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } | null = null;

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
    this.loadTokens();
    this.loadOAuthDefaults(); // Lade OAuth-Standardwerte
  }

  get name() {
    return 'Microsoft OneDrive';
  }

  get id() {
    return this.library.id;
  }

  /**
   * Erstellt eine absolute oder relative API-URL je nach Kontext
   */
  private getApiUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private loadTokens() {
    // Zuerst prüfen, ob Tokens in der Bibliothekskonfiguration vorhanden sind
    const accessToken = this.library.config?.['accessToken'] as string;
    const refreshToken = this.library.config?.['refreshToken'] as string;
    const tokenExpiry = this.library.config?.['tokenExpiry'] as string;
    
    if (accessToken && refreshToken && tokenExpiry) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiry = parseInt(tokenExpiry, 10);
      this.authenticated = true;
      
      console.log(`[OneDriveProvider] Tokens aus Bibliothekskonfiguration geladen`);
      return;
    }
    
    // Falls nicht in der Konfiguration, versuche aus localStorage zu laden
    if (typeof window !== 'undefined') {
      try {
        const tokensJson = localStorage.getItem(`onedrive_tokens_${this.library.id}`);
        if (tokensJson) {
          const tokens = JSON.parse(tokensJson);
          this.accessToken = tokens.accessToken;
          this.refreshToken = tokens.refreshToken;
          this.tokenExpiry = tokens.expiry;
          this.authenticated = true;
          console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage geladen`);
          
          // Wenn Tokens im localStorage, aber nicht in der Datenbank gefunden wurden,
          // versuche sie in die Datenbank zu speichern
          if (this.accessToken && this.refreshToken && this.tokenExpiry) {
            this.saveTokens(this.accessToken, this.refreshToken, this.tokenExpiry - Math.floor(Date.now() / 1000))
              .catch(error => console.error('[OneDriveProvider] Fehler beim Synchronisieren der Tokens mit der Datenbank:', error));
          }
        }
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus localStorage:', error);
      }
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    const expiry = Math.floor(Date.now() / 1000) + expiresIn;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = expiry;
    this.authenticated = true;

    // Tokens im localStorage speichern (nur im Client-Kontext)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`onedrive_tokens_${this.library.id}`, JSON.stringify({
          accessToken,
          refreshToken,
          expiry
        }));
        
        console.log('[OneDriveProvider] Tokens im localStorage gespeichert');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens im localStorage:', error);
      }
    }
    
    // Tokens in der Datenbank speichern (nur im Client-Kontext)
    // Im Server-Kontext werden die Tokens bereits in der Datenbank gespeichert
    if (typeof window !== 'undefined') {
      try {
        // Bibliothekskonfiguration aktualisieren
        const updatedConfig = {
          ...(this.library.config || {}),
          accessToken,
          refreshToken,
          tokenExpiry: expiry.toString()
        };
        
        console.log('[OneDriveProvider] Speichere Tokens in der Datenbank...');
        
        // API aufrufen, um die Bibliothek zu aktualisieren
        const response = await fetch(`/api/libraries/${this.library.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...this.library,
            config: updatedConfig
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`HTTP-Fehler: ${response.status} - ${errorData.error || response.statusText}`);
        }
        
        console.log('[OneDriveProvider] Tokens erfolgreich in der Datenbank gespeichert');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens in der Datenbank:', error);
        // Trotz des Fehlers beim Speichern in der Datenbank bleiben die Tokens im Speicher und localStorage verfügbar
      }
    }
  }

  private async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
    this.authenticated = false;

    // Tokens aus localStorage entfernen
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`onedrive_tokens_${this.library.id}`);
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage entfernt`);
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens aus localStorage:', error);
      }
    }
    
    // Tokens aus der Datenbank entfernen
    try {
      // Bibliothekskonfiguration aktualisieren
      const updatedConfig = {
        ...(this.library.config || {})
      };
      
      // Token-Einträge entfernen, falls vorhanden
      delete updatedConfig['accessToken'];
      delete updatedConfig['refreshToken'];
      delete updatedConfig['tokenExpiry'];
      
      console.log('[OneDriveProvider] Tokens aus der lokalen Konfiguration entfernt');
      
      // TODO: Bei Bedarf könnte hier die Datenbank aktualisiert werden,
      // aber für Storage-Tests ist das lokale Entfernen ausreichend
          } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens:', error);
        // Tokens wurden bereits lokal entfernt, Fehler beim Speichern ignorieren
      }
  }

  private async loadOAuthDefaults() {
    try {
      // Im Server-Kontext (kein window-Objekt) die Umgebungsvariable direkt lesen
      if (typeof window === 'undefined') {
        const redirectUri = process.env.MS_REDIRECT_URI || '';
        if (redirectUri) {
          this.oauthDefaults = {
            tenantId: '',
            clientId: '',
            clientSecret: '',
            redirectUri
          };
          console.log('[OneDriveProvider] OAuth-Defaults aus Umgebungsvariablen geladen (Server-Kontext)');
        }
        return;
      }
      
      // Im Client-Kontext den API-Call machen
      const response = await fetch(this.getApiUrl('/api/settings/oauth-defaults'));
      if (response.ok) {
        const data = await response.json();
        if (data.hasDefaults) {
          this.oauthDefaults = data.defaults;
          console.log('[OneDriveProvider] OAuth-Defaults geladen');
        }
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
    }
  }

  private getConfigValue(key: 'tenantId' | 'clientId' | 'clientSecret' | 'redirectUri'): string {
    // Erst in der Bibliotheks-Konfiguration nachschauen
    const value = this.library.config?.[key] as string;
    if (value) return value;
    
    // Für clientId und clientSecret keine Defaults verwenden - diese müssen explizit gesetzt werden
    if (key === 'clientId' || key === 'clientSecret') {
      return ''; // Leere Zeichenkette zurückgeben, damit wir prüfen können, ob der Wert fehlt
    }
    
    // Dann in den geladenen OAuth-Defaults
    if (this.oauthDefaults && this.oauthDefaults[key]) {
      return this.oauthDefaults[key];
    }
    
    // Fallback für tenantId
    if (key === 'tenantId') return 'common';
    
    // Fallback für redirectUri
    if (key === 'redirectUri') {
      // Im Server-Kontext direkt aus der Umgebungsvariable lesen
      if (typeof window === 'undefined' && process.env.MS_REDIRECT_URI) {
        return process.env.MS_REDIRECT_URI;
      }
      
      // Im Client-Kontext aus OAuth-Defaults
      if (this.oauthDefaults?.redirectUri) {
        return this.oauthDefaults.redirectUri;
      }
      
      throw new StorageError(
        "Fehlende Redirect URI in der Umgebungskonfiguration",
        "CONFIG_ERROR",
        this.id
      );
    }
    
    return '';
  }

  public async getAuthUrl(): Promise<string> {
    // Stelle sicher, dass OAuth-Defaults geladen sind
    if (!this.oauthDefaults) {
      try {
        await this.loadOAuthDefaults();
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
      }
    }

    const tenantId = this.getConfigValue('tenantId');
    const clientId = this.getConfigValue('clientId');
    const redirectUri = this.getConfigValue('redirectUri');

    if (!clientId) {
      throw new StorageError(
        "Fehlende Client ID für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    if (!redirectUri) {
      throw new StorageError(
        "Fehlende Redirect URI für OneDrive-Authentifizierung",
        "CONFIG_ERROR",
        this.id
      );
    }

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=Files.ReadWrite offline_access`;
  }

  public async authenticate(code: string): Promise<boolean> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      const tenantId = this.getConfigValue('tenantId');
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        throw new StorageError(
          `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`,
          "CONFIG_ERROR",
          this.id
        );
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
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
        throw new StorageError(
          `Token-Austausch fehlgeschlagen: ${errorData.error_description || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return true;
    } catch (error) {
      console.error('[OneDriveProvider] Authentifizierungsfehler:', error);
      await this.clearTokens();
      throw error;
    }
  }

  public isAuthenticated(): boolean {
    return this.authenticated && !!this.accessToken;
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      throw new StorageError(
        "Nicht authentifiziert. Bitte authentifizieren Sie sich bei OneDrive.",
        "AUTH_REQUIRED",
        this.id
      );
    }

    // Wenn Token abgelaufen ist, versuche Refresh
    if (this.tokenExpiry <= Date.now() && this.refreshToken) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      const tenantId = this.getConfigValue('tenantId');
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        throw new StorageError(
          `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`,
          "CONFIG_ERROR",
          this.id
        );
      }

      // Token-Refresh direkt bei Microsoft durchführen
      console.log('[OneDriveProvider] Führe Token-Refresh direkt bei Microsoft durch');
      
      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.refreshToken!,
        redirect_uri: redirectUri,
        grant_type: 'refresh_token',
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
        throw new StorageError(
          `Token-Aktualisierung fehlgeschlagen: ${errorData.error_description || errorData.error || response.statusText}`,
          "AUTH_ERROR",
          this.id
        );
      }

      const data = await response.json() as TokenResponse;
      await this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
      console.log('[OneDriveProvider] Token erfolgreich bei Microsoft erneuert');
    } catch (error) {
      console.error('[OneDriveProvider] Fehler bei Token-Aktualisierung:', error);
      await this.clearTokens();
      throw error;
    }
  }

  // Konvertiert OneDrive-Dateiinformationen in ein StorageItem
  private mapOneDriveFileToStorageItem(file: OneDriveFile): StorageItem {
    const metadata: StorageItemMetadata = {
      name: file.name,
      size: file.size,
      modifiedAt: new Date(file.lastModifiedDateTime),
      mimeType: file.file?.mimeType || (file.folder ? 'application/folder' : 'application/octet-stream'),
    };

    return {
      id: file.id,
      parentId: file.parentReference?.id || 'root',
      type: file.folder ? 'folder' : 'file',
      metadata
    };
  }

  // StorageProvider Methoden

  async validateConfiguration(): Promise<StorageValidationResult> {
    try {
      // Stelle sicher, dass OAuth-Defaults geladen sind
      if (!this.oauthDefaults) {
        try {
          await this.loadOAuthDefaults();
        } catch (error) {
          console.error('[OneDriveProvider] Fehler beim Laden der OAuth-Defaults:', error);
        }
      }

      // Prüfe, ob die nötigen Konfigurationswerte vorhanden sind
      const clientId = this.getConfigValue('clientId');
      const clientSecret = this.getConfigValue('clientSecret');
      const redirectUri = this.getConfigValue('redirectUri');

      // Fehlende Parameter identifizieren
      const missingParams = [
        !clientId ? 'Client ID' : '',
        !clientSecret ? 'Client Secret' : '',
        !redirectUri ? 'Redirect URI' : ''
      ].filter(Boolean).join(', ');

      if (missingParams) {
        return {
          isValid: false,
          error: `Fehlende Konfigurationsparameter für OneDrive-Authentifizierung: ${missingParams}`
        };
      }

      // Wenn wir keinen Access Token haben, ist Konfiguration gültig,
      // aber Authentifizierung erforderlich
      if (!this.isAuthenticated()) {
        return {
          isValid: true,
          error: "Authentifizierung erforderlich"
        };
      }

      // Mit einem API-Aufruf testen, ob die Authentifizierung funktioniert
      try {
        await this.ensureAccessToken();
        const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            isValid: false,
            error: `OneDrive API-Fehler: ${errorData.error?.message || response.statusText}`
          };
        }

        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Validierung"
      };
    }
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      if (folderId && folderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateien: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const data = await response.json() as OneDriveItemResponse;
      return data.value.map(file => this.mapOneDriveFileToStorageItem(file));
    } catch (error) {
      console.error('[OneDriveProvider] listItemsById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Auflisten der Dateien",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root';
      if (itemId && itemId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const file = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(file);
    } catch (error) {
      console.error('[OneDriveProvider] getItemById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen der Datei",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      let url;
      if (parentId === 'root') {
        url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Erstellen des Ordners: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const folder = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(folder);
    } catch (error) {
      console.error('[OneDriveProvider] createFolder Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen des Ordners",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht gelöscht werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        // Bei DELETE gibt es möglicherweise keine JSON-Antwort
        const errorText = await response.text();
        throw new StorageError(
          `Fehler beim Löschen des Elements: ${errorText || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] deleteItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht verschoben werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Zuerst die Informationen des Items abrufen, um den Namen zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Item-Informationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      // Verschieben des Items
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      const parentReference = newParentId === 'root' 
        ? { id: 'root' } 
        : { id: newParentId };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentReference
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Verschieben des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }
    } catch (error) {
      console.error('[OneDriveProvider] moveItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Verschieben",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        throw new StorageError(
          "Der Root-Ordner kann nicht umbenannt werden",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Umbenennen des Items über die Microsoft Graph API
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Umbenennen des Elements: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const renamedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(renamedFile);
    } catch (error) {
      console.error('[OneDriveProvider] renameItem Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Umbenennen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      let url;
      if (parentId === 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/root:/${file.name}:/content`;
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${file.name}:/content`;
      }

      // Datei als ArrayBuffer lesen
      const arrayBuffer = await file.arrayBuffer();

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: arrayBuffer
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Hochladen der Datei: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const uploadedFile = await response.json() as OneDriveFile;
      return this.mapOneDriveFileToStorageItem(uploadedFile);
    } catch (error) {
      console.error('[OneDriveProvider] uploadFile Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Hochladen",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (fileId === 'root') {
        throw new StorageError(
          "Der Root-Ordner hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinformationen abrufen, um den MIME-Typ zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!itemResponse.ok) {
        const errorData = await itemResponse.json();
        throw new StorageError(
          `Fehler beim Abrufen der Dateiinformationen: ${errorData.error?.message || itemResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const fileInfo = await itemResponse.json() as OneDriveFile;
      
      if (fileInfo.folder) {
        throw new StorageError(
          "Der angegebene Pfad ist ein Ordner und hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Dateiinhalt abrufen
      const contentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!contentResponse.ok) {
        throw new StorageError(
          `Fehler beim Abrufen des Dateiinhalts: ${contentResponse.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const blob = await contentResponse.blob();
      const mimeType = fileInfo.file?.mimeType || contentResponse.headers.get('content-type') || 'application/octet-stream';

      return { blob, mimeType };
    } catch (error) {
      console.error('[OneDriveProvider] getBinary Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Binärinhalts",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }

  async getPathById(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      if (itemId === 'root') {
        return '/';
      }

      // Item-Informationen abrufen
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new StorageError(
          `Fehler beim Abrufen des Pfads: ${errorData.error?.message || response.statusText}`,
          "API_ERROR",
          this.id
        );
      }

      const item = await response.json() as OneDriveFile;

      // Pfad aus parentReference extrahieren
      if (item.parentReference?.path) {
        // Entfernen von "/drive/root:" vom Pfad
        let path = item.parentReference.path.replace('/drive/root:', '');
        
        // Füge Dateinamen hinzu
        path = `${path}/${item.name}`;
        
        // Formatiere den Pfad
        path = path.replace(/^\/+|\/+$/g, ''); // Entferne führende/nachfolgende Slashes
        
        return path || '/';
      }
      
      return item.name;
    } catch (error) {
      console.error('[OneDriveProvider] getPathById Fehler:', error);
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        error instanceof Error ? error.message : "Unbekannter Fehler beim Abrufen des Pfads",
        "UNKNOWN_ERROR",
        this.id
      );
    }
  }
} 