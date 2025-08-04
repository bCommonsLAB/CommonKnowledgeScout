/**
 * Browser-only Authentication Storage
 * Keine Server-side Speicherung - nur Browser-basiert
 */

export type AuthMode = 'memory' | 'session-storage' | 'local-storage'

interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType?: string
}

interface AuthCredentials {
  url?: string
  username?: string
  password?: string
  timestamp: number
}

// Memory-only Storage (Tab-basiert)
const memoryStorage = new Map<string, AuthTokens | AuthCredentials>()

// Event-basierte Token-Updates für Memory-Storage
const authEventTarget = new EventTarget()

export class BrowserAuthStorage {
  
  /**
   * Speichert Auth-Daten basierend auf gewähltem Modus
   */
  static store(
    key: string, 
    data: AuthTokens | AuthCredentials, 
    mode: AuthMode
  ): void {
    console.log(`[BrowserAuth] Speichere ${key} in ${mode}`)
    
    switch (mode) {
      case 'memory':
        memoryStorage.set(key, data)
        // Event für React-Updates
        authEventTarget.dispatchEvent(new CustomEvent('auth-update', { 
          detail: { key, data, mode } 
        }))
        break
        
      case 'session-storage':
        try {
          sessionStorage.setItem(key, JSON.stringify(data))
        } catch (error) {
          console.warn('[BrowserAuth] SessionStorage fehler, fallback zu Memory:', error)
          memoryStorage.set(key, data)
        }
        break
        
      case 'local-storage':
        try {
          localStorage.setItem(key, JSON.stringify(data))
        } catch (error) {
          console.warn('[BrowserAuth] LocalStorage fehler, fallback zu SessionStorage:', error)
          sessionStorage.setItem(key, JSON.stringify(data))
        }
        break
    }
  }

  /**
   * Lädt Auth-Daten (prüft alle Modi in Prioritäts-Reihenfolge)
   */
  static load(key: string): { data: AuthTokens | AuthCredentials | null; mode: AuthMode | null } {
    // 1. Memory prüfen (höchste Priorität)
    if (memoryStorage.has(key)) {
      const data = memoryStorage.get(key)!
      console.log(`[BrowserAuth] ${key} aus Memory geladen`)
      return { data, mode: 'memory' }
    }

    // 2. SessionStorage prüfen
    try {
      const sessionData = sessionStorage.getItem(key)
      if (sessionData) {
        const data = JSON.parse(sessionData) as AuthTokens | AuthCredentials
        console.log(`[BrowserAuth] ${key} aus SessionStorage geladen`)
        return { data, mode: 'session-storage' }
      }
    } catch (error) {
      console.warn('[BrowserAuth] SessionStorage read error:', error)
    }

    // 3. LocalStorage prüfen (niedrigste Priorität)
    try {
      const localData = localStorage.getItem(key)
      if (localData) {
        const data = JSON.parse(localData) as AuthTokens | AuthCredentials
        console.log(`[BrowserAuth] ${key} aus LocalStorage geladen`)
        return { data, mode: 'local-storage' }
      }
    } catch (error) {
      console.warn('[BrowserAuth] LocalStorage read error:', error)
    }

    return { data: null, mode: null }
  }

  /**
   * Entfernt Auth-Daten aus allen Storage-Modi
   */
  static remove(key: string): void {
    console.log(`[BrowserAuth] Entferne ${key} aus allen Storages`)
    
    // Memory
    memoryStorage.delete(key)
    
    // SessionStorage
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.warn('[BrowserAuth] SessionStorage remove error:', error)
    }
    
    // LocalStorage
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('[BrowserAuth] LocalStorage remove error:', error)
    }

    // Event für React-Updates
    authEventTarget.dispatchEvent(new CustomEvent('auth-remove', { 
      detail: { key } 
    }))
  }

  /**
   * Prüft ob Auth-Daten existieren und gültig sind
   */
  static isValid(key: string): boolean {
    const { data } = this.load(key)
    
    if (!data) return false

    // Token-Ablauf prüfen
    if ('expiresAt' in data && data.expiresAt) {
      if (Date.now() > data.expiresAt) {
        console.log(`[BrowserAuth] ${key} abgelaufen, entferne...`)
        this.remove(key)
        return false
      }
    }

    // Credentials-Alter prüfen (max 24h für Memory/Session)
    if ('timestamp' in data && data.timestamp) {
      const age = Date.now() - data.timestamp
      const maxAge = 24 * 60 * 60 * 1000 // 24 Stunden
      
      if (age > maxAge) {
        console.log(`[BrowserAuth] ${key} zu alt (${Math.round(age / 1000 / 60 / 60)}h), entferne...`)
        this.remove(key)
        return false
      }
    }

    return true
  }

  /**
   * Holt alle verfügbaren Auth-Keys (für Debugging)
   */
  static getAllKeys(): string[] {
    const keys = new Set<string>()
    
    // Memory keys
    memoryStorage.forEach((_, key) => keys.add(key))
    
    // SessionStorage keys
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.includes('auth') || key?.includes('token') || key?.includes('webdav')) {
          keys.add(key)
        }
      }
    } catch (error) {
      console.warn('[BrowserAuth] SessionStorage iteration error:', error)
    }
    
    // LocalStorage keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.includes('auth') || key?.includes('token') || key?.includes('webdav')) {
          keys.add(key)
        }
      }
    } catch (error) {
      console.warn('[BrowserAuth] LocalStorage iteration error:', error)
    }

    return Array.from(keys)
  }

  /**
   * Event-Listener für React-Updates bei Memory-Storage-Änderungen
   */
  static onAuthChange(callback: (event: CustomEvent) => void): () => void {
    authEventTarget.addEventListener('auth-update', callback as EventListener)
    authEventTarget.addEventListener('auth-remove', callback as EventListener)
    
    // Cleanup function
    return () => {
      authEventTarget.removeEventListener('auth-update', callback as EventListener)
      authEventTarget.removeEventListener('auth-remove', callback as EventListener)
    }
  }

  /**
   * Bereinigt abgelaufene Auth-Daten (sollte regelmäßig aufgerufen werden)
   */
  static cleanup(): void {
    console.log('[BrowserAuth] Starte Cleanup...')
    
    const keys = this.getAllKeys()
    let cleanedCount = 0
    
    keys.forEach(key => {
      if (!this.isValid(key)) {
        cleanedCount++
      }
    })
    
    console.log(`[BrowserAuth] Cleanup abgeschlossen: ${cleanedCount} abgelaufene Einträge entfernt`)
  }
}

// Auto-Cleanup alle 5 Minuten
if (typeof window !== 'undefined') {
  setInterval(() => {
    BrowserAuthStorage.cleanup()
  }, 5 * 60 * 1000)
}