/**
 * Session-Management für anonyme Nutzer
 * Generiert und verwaltet Session-IDs für anonyme Chat-Nutzer
 */

const SESSION_ID_KEY = 'anonymous_session_id'
const SESSION_EXPIRY_DAYS = 30 // Session bleibt 30 Tage gültig

export interface SessionInfo {
  sessionId: string
  createdAt: number
  expiresAt: number
}

/**
 * Generiert eine neue Session-ID
 */
function generateSessionId(): string {
  // Verwende crypto.randomUUID() wenn verfügbar, sonst Fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `anon-${crypto.randomUUID()}`
  }
  
  // Fallback für ältere Browser
  return `anon-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Ruft die aktuelle Session-ID ab oder erstellt eine neue
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-Side: Generiere temporäre ID
    return `temp-${Date.now()}`
  }

  try {
    const stored = localStorage.getItem(SESSION_ID_KEY)
    if (stored) {
      const sessionInfo: SessionInfo = JSON.parse(stored)
      
      // Prüfe Ablauf
      if (sessionInfo.expiresAt > Date.now()) {
        return sessionInfo.sessionId
      }
      
      // Session abgelaufen, entferne sie
      localStorage.removeItem(SESSION_ID_KEY)
    }

    // Erstelle neue Session
    const sessionId = generateSessionId()
    const createdAt = Date.now()
    const expiresAt = createdAt + (SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    
    const sessionInfo: SessionInfo = {
      sessionId,
      createdAt,
      expiresAt,
    }
    
    localStorage.setItem(SESSION_ID_KEY, JSON.stringify(sessionInfo))
    return sessionId
  } catch (error) {
    console.error('[SessionUtils] Fehler beim Abrufen/Erstellen der Session-ID:', error)
    // Fallback: Generiere temporäre ID
    return `temp-${Date.now()}`
  }
}

/**
 * Ruft die aktuelle Session-ID ab (ohne neue zu erstellen)
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = localStorage.getItem(SESSION_ID_KEY)
    if (stored) {
      const sessionInfo: SessionInfo = JSON.parse(stored)
      
      // Prüfe Ablauf
      if (sessionInfo.expiresAt > Date.now()) {
        return sessionInfo.sessionId
      }
      
      // Session abgelaufen
      localStorage.removeItem(SESSION_ID_KEY)
    }
    
    return null
  } catch (error) {
    console.error('[SessionUtils] Fehler beim Abrufen der Session-ID:', error)
    return null
  }
}

/**
 * Entfernt die aktuelle Session-ID
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(SESSION_ID_KEY)
  } catch (error) {
    console.error('[SessionUtils] Fehler beim Entfernen der Session-ID:', error)
  }
}

/**
 * Prüft, ob eine Session-ID vorhanden und gültig ist
 */
export function hasValidSession(): boolean {
  return getSessionId() !== null
}










