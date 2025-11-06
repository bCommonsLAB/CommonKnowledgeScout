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
  private userEmail: string | null = null;
  private baseFolderId: string | null = null;
  private basePath: string = '';
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
  
  // Neu: Token-Refresh Promise für Debouncing
  private refreshPromise: Promise<void> | null = null;
  // Neu: Flag für Token-Löschung
  private clearingTokens: boolean = false;

  constructor(library: ClientLibrary, baseUrl?: string) {
    this.library = library;
    // Im Server-Kontext kann baseUrl übergeben werden, sonst relative URL verwenden
    this.baseUrl = baseUrl || '';
    // loadTokens ist jetzt async, aber wir können nicht await im Constructor verwenden
    // Daher wird es beim ersten ensureAccessToken aufgerufen
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
    const url = `${this.baseUrl}${path}`;
    if (this.userEmail) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}email=${encodeURIComponent(this.userEmail)}`;
    }
    return url;
  }

  setUserEmail(email: string) {
    this.userEmail = email;
  }

  private normalizeBasePath(input: string | undefined): string {
    if (!input) return '';
    const trimmed = input.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return trimmed ? `/${trimmed}` : '';
  }

  private async ensureBaseFolderResolved(): Promise<void> {
    // Resolve once per provider lifecycle
    if (this.baseFolderId !== null) return;
    const configured = this.normalizeBasePath(this.library.path);
    this.basePath = configured;
    // If no base path configured, use root
    if (!configured) {
      this.baseFolderId = 'root';
      return;
    }

    const accessToken = await this.ensureAccessToken();
    // Try to resolve the configured path to an item id
    const tryResolve = async (): Promise<string | null> => {
      const url = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(configured)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        return data.id ?? null;
      }
      if (res.status === 404) return null;
      // Other errors
      const txt = await res.text().catch(() => '');
      throw new StorageError(`Fehler beim Auflösen des Basisordners: ${txt || res.statusText}`,'API_ERROR', this.id);
    };

    const id: string | null = await tryResolve();
    if (id) {
      this.baseFolderId = id;
      return;
    }

    // Create path recursively
    const segments = configured.split('/').filter(Boolean);
    let parentId: string | 'root' = 'root';
    for (const segment of segments) {
      // Try to find child under parent
      let childId: string | null = null;
      const listUrl = parentId === 'root'
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (listRes.ok) {
        const data = await listRes.json() as { value?: Array<{ id: string; name: string; folder?: unknown }> };
        const match = (data.value || []).find(x => x.name === segment && x.folder);
        if (match) childId = match.id;
      }
      if (!childId) {
        const createUrl = parentId === 'root'
          ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
          : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
        const createRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: segment, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
        });
        if (!createRes.ok) {
          const txt = await createRes.text().catch(() => '');
          throw new StorageError(`Fehler beim Erstellen des Basisordners "${segment}": ${txt || createRes.statusText}`,'API_ERROR', this.id);
        }
        const created = await createRes.json() as { id: string };
        childId = created.id;
      }
      parentId = childId as string;
    }
    this.baseFolderId = parentId;
  }

  private async loadTokens(): Promise<void> {
    // Server-Kontext: Tokens aus der Library-Konfiguration lesen (DB)
    if (typeof window === 'undefined') {
      try {
        const cfg = this.library.config as unknown as {
          accessToken?: string; refreshToken?: string; tokenExpiry?: number | string
        } | undefined;
        if (cfg?.accessToken && cfg?.refreshToken) {
          this.accessToken = cfg.accessToken;
          this.refreshToken = cfg.refreshToken;
          this.tokenExpiry = Number(cfg.tokenExpiry || 0);
          this.authenticated = true;
          console.log('[OneDriveProvider] Tokens aus Library-Konfiguration geladen (Server-Kontext)');
          return;
        }
        
        // Wenn keine Tokens in der Config sind, versuche sie direkt aus der DB zu laden
        console.log('[OneDriveProvider] Keine Tokens in Library-Config gefunden, versuche aus DB zu laden...');
        try {
          const response = await fetch(`${this.baseUrl}/api/libraries/${this.library.id}/tokens`, {
            method: 'GET',
            headers: { 'X-Internal-Request': '1' }
          });
          
          if (response.ok) {
            const tokenData = await response.json();
            if (tokenData.accessToken && tokenData.refreshToken) {
              this.accessToken = tokenData.accessToken;
              this.refreshToken = tokenData.refreshToken;
              this.tokenExpiry = Number(tokenData.tokenExpiry || 0);
              this.authenticated = true;
              console.log('[OneDriveProvider] Tokens erfolgreich aus DB geladen');
              return;
            }
          }
        } catch (dbError) {
          console.warn('[OneDriveProvider] Fehler beim Laden der Tokens aus DB:', dbError);
        }
        
        console.log('[OneDriveProvider] Keine Tokens gefunden - Authentifizierung erforderlich');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus Library-Konfiguration:', error);
      }
      return;
    }

    // Client-Kontext: Tokens aus localStorage
    try {
      const tokensJson = localStorage.getItem(`onedrive_tokens_${this.library.id}`);
      if (tokensJson) {
        const tokens = JSON.parse(tokensJson);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.tokenExpiry = tokens.expiry;
        this.authenticated = true;
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage geladen`);
      }
    } catch (error) {
      console.error('[OneDriveProvider] Fehler beim Laden der Tokens aus localStorage:', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
    // Konvertiere expiresIn (Sekunden) in Millisekunden und addiere aktuelle Zeit
    const expiry = Date.now() + (expiresIn * 1000);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = expiry;
    this.authenticated = true;

    // Client-Kontext: Tokens im localStorage persistieren
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`onedrive_tokens_${this.library.id}`, JSON.stringify({
          accessToken,
          refreshToken,
          expiry
        }));
        
        console.log('[OneDriveProvider] Tokens im localStorage gespeichert', {
          libraryId: this.library.id,
          expiresIn: `${expiresIn} Sekunden`,
          expiryTime: new Date(expiry).toISOString()
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens im localStorage:', error);
      }
    }

    // Server-Kontext: Tokens in der Library-Konfiguration persistieren (DB)
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Request': '1' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiry / 1000).toString() })
        });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Speichern der Tokens in der DB:', error);
      }
    }
  }

  private async clearTokens() {
    // Verhindere mehrfache gleichzeitige Aufrufe
    if (this.clearingTokens) {
      console.log('[OneDriveProvider] Token-Löschung läuft bereits, überspringe...');
      return;
    }
    this.clearingTokens = true;

    // Client: localStorage räumen
    if (typeof window !== 'undefined') {
      try {
        const localStorageKey = `onedrive_tokens_${this.library.id}`;
        localStorage.removeItem(localStorageKey);
        console.log(`[OneDriveProvider] Tokens für ${this.library.id} aus localStorage entfernt`);
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens aus localStorage:', error);
      }
    }

    // Server: DB-Eintrag löschen
    if (typeof window === 'undefined') {
      try {
        await fetch(this.getApiUrl(`/api/libraries/${this.library.id}/tokens`), { method: 'DELETE', headers: { 'X-Internal-Request': '1' } });
      } catch (error) {
        console.error('[OneDriveProvider] Fehler beim Entfernen der Tokens in der DB:', error);
      }
    }

    this.clearingTokens = false;
    
    // Setze lokale Variablen zurück
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
    this.authenticated = false;
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
    // Wenn Tokens noch nicht geladen wurden, lade sie jetzt
    if (!this.accessToken && !this.refreshToken) {
      await this.loadTokens();
    }
    
    // Wenn kein Token vorhanden, Fehler werfen
    if (!this.accessToken) {
      throw new StorageError(
        "Nicht authentifiziert",
        "AUTH_REQUIRED",
        this.id
      );
    }

    // Wenn Token in weniger als 5 Minuten abläuft, versuche Refresh
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 Minuten in Millisekunden
    const now = Date.now();
    const timeUntilExpiry = this.tokenExpiry - now;
    
    // Log Token-Status
    console.log('[OneDriveProvider] Token-Status:', {
      libraryId: this.library.id,
      tokenExpiry: new Date(this.tokenExpiry).toISOString(),
      currentTime: new Date(now).toISOString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 1000)} Sekunden`,
      hasRefreshToken: !!this.refreshToken,
      isExpired: this.tokenExpiry <= now,
      refreshBuffer: `${FIVE_MINUTES / 1000} Sekunden`
    });

    // Nur refreshen wenn:
    // 1. Token abgelaufen ist ODER
    // 2. Token läuft in weniger als 5 Minuten ab UND
    // 3. Refresh-Token vorhanden ist UND
    // 4. Kein Refresh bereits läuft
    if (
      (this.tokenExpiry <= now || timeUntilExpiry <= FIVE_MINUTES) && 
      this.refreshToken && 
      !this.refreshPromise
    ) {
      await this.refreshAccessToken();
    } else if (this.refreshPromise) {
      // Wenn bereits ein Refresh läuft, warte darauf
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      await this.refreshPromise;
    }

    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    // Wenn bereits ein Refresh läuft, warte auf dessen Abschluss
    if (this.refreshPromise) {
      console.log('[OneDriveProvider] Token-Refresh läuft bereits, warte auf Abschluss...');
      return this.refreshPromise;
    }

    // Erstelle ein neues Refresh-Promise
    this.refreshPromise = (async () => {
      try {
        if (!this.refreshToken) {
          throw new StorageError(
            "Kein Refresh-Token verfügbar",
            "AUTH_ERROR",
            this.id
          );
        }

        // Token-Refresh über die Server-Route durchführen (vermeidet CORS-Probleme)
        console.log('[OneDriveProvider] Führe Token-Refresh über Server-Route durch');
        
        const response = await fetch(this.getApiUrl('/api/auth/onedrive/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': '1'
          },
          body: JSON.stringify({
            libraryId: this.library.id,
            refreshToken: this.refreshToken
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new StorageError(
            `Token-Aktualisierung fehlgeschlagen: ${errorData.details || errorData.error || response.statusText}`,
            "AUTH_ERROR",
            this.id
          );
        }

        const data = await response.json();
        await this.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
        console.log('[OneDriveProvider] Token erfolgreich über Server erneuert');
      } catch (error) {
        console.error('[OneDriveProvider] Fehler bei Token-Aktualisierung:', error);
        await this.clearTokens();
        throw error;
      } finally {
        // Lösche das Promise nach Abschluss
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
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
      await this.ensureBaseFolderResolved();
      
      // URL für den API-Aufruf
      let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      if (folderId === 'root' && this.baseFolderId && this.baseFolderId !== 'root') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
      } else if (folderId && folderId !== 'root') {
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
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}/children`;
        } else {
          url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';
        }
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
      await this.ensureBaseFolderResolved();
      
      let url;
      if (parentId === 'root') {
        if (this.baseFolderId && this.baseFolderId !== 'root') {
          url = `https://graph.microsoft.com/v1.0/me/drive/items/${this.baseFolderId}:/${file.name}:/content`;
        } else {
          url = `https://graph.microsoft.com/v1.0/me/drive/root:/${file.name}:/content`;
        }
      } else {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${file.name}:/content`;
      }

      // Datei als ArrayBuffer lesen
      const arrayBuffer = await file.arrayBuffer();

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          // OneDrive /content Upload verlangt binären Stream; sichere Wahl ist application/octet-stream
          // Einige Tenants/Proxies reagieren fehlerhaft auf text/markdown → daher immer octet-stream
          'Content-Type': 'application/octet-stream'
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
      await this.ensureBaseFolderResolved();
      
      if (fileId === 'root') {
        throw new StorageError(
          "Der Root-Ordner hat keinen binären Inhalt",
          "INVALID_OPERATION",
          this.id
        );
      }

      // Prüfe, ob fileId ein Base64-kodierter Pfad ist (aus ingestion-service)
      // Versuche zu dekodieren - wenn erfolgreich, handelt es sich um einen Pfad
      let isPath = false
      let normalizedPath = ''
      try {
        const decoded = Buffer.from(fileId, 'base64').toString('utf-8')
        // Wenn Dekodierung erfolgreich ist und das Ergebnis wie ein Pfad aussieht
        if (decoded && decoded.includes('/') && !decoded.match(/^[A-Za-z0-9_-]+$/)) {
          isPath = true
          normalizedPath = decoded
        }
      } catch {
        // Nicht Base64-kodiert, behandele als Item-ID
      }

      let itemId = fileId
      let itemPath = ''

      // Wenn es ein Pfad ist, verwende Microsoft Graph's Pfad-Auflösung
      if (isPath) {
        // Pfad relativ zum baseFolder auflösen
        const fullPath = this.basePath 
          ? `${this.basePath.replace(/^\/+|\/+$/g, '')}/${normalizedPath}`.replace(/^\/+|\/+$/g, '')
          : normalizedPath
        
        console.log('[OneDriveProvider] getBinary: Pfad erkannt', {
          originalFileId: fileId,
          decodedPath: normalizedPath,
          basePath: this.basePath,
          fullPath,
        })
        
        // URL-encode den Pfad für Microsoft Graph
        const encodedPath = encodeURIComponent(fullPath)
        itemPath = `root:/${encodedPath}`
        
        // Versuche Item-ID über Pfad zu erhalten
        const pathItemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${itemPath}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (pathItemResponse.ok) {
          const pathItem = await pathItemResponse.json() as OneDriveFile
          itemId = pathItem.id
          console.log('[OneDriveProvider] getBinary: Pfad erfolgreich aufgelöst', {
            path: fullPath,
            itemId,
          })
        } else {
          // Fallback: Versuche direkt mit Pfad
          const errorData = await pathItemResponse.json().catch(() => ({}))
          console.error('[OneDriveProvider] getBinary: Fehler beim Auflösen des Pfads', {
            path: fullPath,
            itemPath,
            status: pathItemResponse.status,
            error: errorData,
          })
          throw new StorageError(
            `Fehler beim Auflösen des Pfads "${fullPath}": ${errorData.error?.message || pathItemResponse.statusText}`,
            "API_ERROR",
            this.id
          )
        }
      }

      // Dateiinformationen abrufen, um den MIME-Typ zu erhalten
      const itemResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
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
      const contentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`, {
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
      await this.ensureBaseFolderResolved();
      
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
        // Basispfad entfernen, wenn konfiguriert
        if (this.basePath && path.startsWith(this.basePath.replace(/^\/+/, ''))) {
          let rel = path.substring(this.basePath.replace(/^\/+/, '').length);
          rel = rel.replace(/^\/+/, '');
          return rel ? `/${rel}` : '/';
        }
        return path ? `/${path}` : '/';
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

  async getDownloadUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Download-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getDownloadUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Download-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    try {
      const accessToken = await this.ensureAccessToken();
      
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?select=@microsoft.graph.downloadUrl`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data['@microsoft.graph.downloadUrl']) {
        throw new Error('Keine Streaming-URL in der API-Antwort');
      }

      return data['@microsoft.graph.downloadUrl'];
    } catch (error) {
      console.error('[OneDriveProvider] getStreamingUrl Fehler:', error);
      throw new StorageError('Fehler beim Abrufen der Streaming-URL: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    if (itemId === 'root') {
      // Root-Item erzeugen
      return [
        {
          id: 'root',
          parentId: '',
          type: 'folder',
          metadata: {
            name: 'root',
            size: 0,
            modifiedAt: new Date(),
            mimeType: 'application/folder'
          }
        }
      ];
    }
    const path = await this.getPathById(itemId); // z.B. /foo/bar/baz
    const segments = path.split('/').filter(Boolean);
    let parentId = 'root';
    const pathItems: StorageItem[] = [];
    for (const segment of segments) {
      const children = await this.listItemsById(parentId);
      const folder = children.find(child => child.metadata.name === segment && child.type === 'folder');
      if (!folder) break;
      // Eltern in den Cache schreiben, falls sie fehlen
      if (parentId !== 'root' && !pathItems.find(item => item.id === parentId)) {
        try {
          const parentItem = await this.getItemById(parentId);
          pathItems.push(parentItem);
        } catch {}
      }
      pathItems.push(folder);
      parentId = folder.id;
    }
    return [{
      id: 'root',
      parentId: '',
      type: 'folder',
      metadata: {
        name: 'root',
        size: 0,
        modifiedAt: new Date(),
        mimeType: 'application/folder'
      }
    }, ...pathItems];
  }
} 