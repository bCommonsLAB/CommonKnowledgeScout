/**
 * Authentifizierungs- und Bibliotheks-Hilfsfunktionen
 */

import { cookies } from 'next/headers';

/**
 * Ruft die aktuelle Bibliotheks-ID aus den Cookies ab
 * 
 * @returns Die ID der aktiven Bibliothek oder null, wenn keine Bibliothek ausgewählt ist
 */
export async function getLibraryId(): Promise<string | null> {
  const cookieStore = await cookies();
  const libraryId = cookieStore.get('library_id')?.value;
  
  return libraryId || null;
}

/**
 * Hilfsfunktion zur Überprüfung, ob ein Benutzer authentifiziert ist
 * Kann in Zukunft erweitert werden, um tatsächliche Authentifizierungsprüfungen durchzuführen
 * 
 * @returns true, wenn der Benutzer authentifiziert ist, sonst false
 */
export async function isAuthenticated(): Promise<boolean> {
  // In der aktuellen Implementierung prüfen wir nur, ob eine Bibliothek ausgewählt ist
  const libraryId = await getLibraryId();
  return !!libraryId;
}

/**
 * Hilfsfunktion zum Abrufen von Benutzerinformationen
 * Kann in Zukunft erweitert werden, um tatsächliche Benutzerinformationen zurückzugeben
 * 
 * @returns Ein Objekt mit Benutzerinformationen oder null, wenn kein Benutzer authentifiziert ist
 */
export async function getUserInfo(): Promise<{ userId: string; libraryId: string } | null> {
  const libraryId = await getLibraryId();
  
  if (!libraryId) {
    return null;
  }
  
  // Hier könnten in Zukunft zusätzliche Informationen aus der Datenbank abgerufen werden
  return {
    userId: 'anonymous', // Platzhalter für echte Benutzer-ID
    libraryId
  };
} 