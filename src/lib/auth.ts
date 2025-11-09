/**
 * @fileoverview Authentication and Library Helper Functions
 * 
 * @description
 * Provides helper functions for authentication and library management.
 * Currently handles library ID retrieval from cookies and basic authentication
 * checks. Can be extended in the future for full authentication functionality.
 * 
 * @module core
 * 
 * @exports
 * - getLibraryId(): Retrieves active library ID from cookies
 * - isAuthenticated(): Checks if user is authenticated
 * - getUserInfo(): Retrieves user information
 * 
 * @usedIn
 * - src/app/api: API routes use authentication helpers
 * - src/components: Components may use library ID helpers
 * 
 * @dependencies
 * - next/headers: Next.js cookie handling
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