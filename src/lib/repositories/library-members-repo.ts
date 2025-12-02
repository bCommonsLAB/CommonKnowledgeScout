/**
 * @fileoverview Library Members Repository
 * 
 * @description
 * MongoDB repository for managing library members (owners and moderators).
 * Handles CRUD operations for library member roles and permissions.
 * 
 * @module repositories
 * 
 * @exports
 * - addMember: Adds a member to a library
 * - removeMember: Removes a member from a library
 * - getMember: Gets a member by library and email
 * - listMembers: Lists all members for a library
 * - isModeratorOrOwner: Checks if user is moderator or owner
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/lib/services/library-service: Library service for owner checks
 * - @/types/library-members: Member type definitions
 * - mongodb: MongoDB driver types
 */

import { getCollection } from '@/lib/mongodb-service';
import { LibraryService } from '@/lib/services/library-service';
import type { Collection } from 'mongodb';
import type { LibraryMember, LibraryRole } from '@/types/library-members';

const COLLECTION_NAME = 'library_members';

/**
 * Gibt die MongoDB-Collection für Library Members zurück und erstellt Indizes
 */
async function getMembersCollection(): Promise<Collection<LibraryMember>> {
  const col = await getCollection<LibraryMember>(COLLECTION_NAME);
  try {
    await Promise.all([
      col.createIndex({ libraryId: 1, userEmail: 1 }, { unique: true, name: 'library_user_unique' }),
      col.createIndex({ libraryId: 1, role: 1 }, { name: 'library_role' }),
    ]);
  } catch {
    // Indizes existieren bereits oder Fehler beim Erstellen (ignorieren)
  }
  return col;
}

/**
 * Fügt ein Mitglied zu einer Library hinzu
 * 
 * @param libraryId Library-ID
 * @param userEmail E-Mail des Mitglieds
 * @param role Rolle des Mitglieds
 * @param addedBy E-Mail des Benutzers, der das Mitglied hinzugefügt hat
 */
export async function addMember(
  libraryId: string,
  userEmail: string,
  role: LibraryRole,
  addedBy: string
): Promise<void> {
  const col = await getMembersCollection();
  
  // Prüfe ob Mitglied bereits existiert
  const existing = await col.findOne({ libraryId, userEmail });
  if (existing) {
    // Aktualisiere bestehendes Mitglied
    await col.updateOne(
      { libraryId, userEmail },
      {
        $set: {
          role,
          addedBy,
          addedAt: new Date(),
        },
      }
    );
  } else {
    // Erstelle neues Mitglied
    await col.insertOne({
      libraryId,
      userEmail,
      role,
      addedAt: new Date(),
      addedBy,
    });
  }
}

/**
 * Entfernt ein Mitglied aus einer Library
 * 
 * @param libraryId Library-ID
 * @param userEmail E-Mail des Mitglieds
 */
export async function removeMember(
  libraryId: string,
  userEmail: string
): Promise<void> {
  const col = await getMembersCollection();
  await col.deleteOne({ libraryId, userEmail });
}

/**
 * Ruft ein Mitglied nach Library und E-Mail ab
 * 
 * @param libraryId Library-ID
 * @param userEmail E-Mail des Mitglieds
 * @returns Member oder null wenn nicht gefunden
 */
export async function getMember(
  libraryId: string,
  userEmail: string
): Promise<LibraryMember | null> {
  const col = await getMembersCollection();
  return await col.findOne({ libraryId, userEmail });
}

/**
 * Listet alle Mitglieder einer Library
 * 
 * @param libraryId Library-ID
 * @returns Array von Members
 */
export async function listMembers(libraryId: string): Promise<LibraryMember[]> {
  const col = await getMembersCollection();
  return await col.find({ libraryId }).toArray();
}

/**
 * Prüft ob Benutzer Moderator oder Owner einer Library ist
 * 
 * @param libraryId Library-ID
 * @param userEmail Benutzer-E-Mail
 * @returns true wenn Benutzer Owner oder Moderator ist
 */
export async function isModeratorOrOwner(
  libraryId: string,
  userEmail: string
): Promise<boolean> {
  // Prüfe zuerst ob Benutzer Owner ist (über Library-Struktur)
  const libraryService = LibraryService.getInstance();
  
  // Versuche Library zu laden - wenn erfolgreich, ist userEmail der Owner
  try {
    const library = await libraryService.getLibrary(userEmail, libraryId);
    if (library) {
      return true; // Owner
    }
  } catch {
    // Library nicht gefunden oder nicht Owner
  }
  
  // Prüfe ob Benutzer Moderator ist
  const col = await getMembersCollection();
  const member = await col.findOne({
    libraryId,
    userEmail,
    role: 'moderator',
  });
  
  return member !== null;
}

