/**
 * @fileoverview Library Members Repository
 * 
 * @description
 * MongoDB repository for managing library members (owners, moderators, co-creators).
 * Handles CRUD operations for library member roles and permissions.
 * Mitglieder durchlaufen einen Einladungsflow: pending -> active.
 * 
 * @module repositories
 * 
 * @exports
 * - addMember: Adds a member to a library (status: pending, mit inviteToken)
 * - removeMember: Removes a member from a library
 * - getMember: Gets a member by library and email
 * - getMemberByInviteToken: Gets a member by invite token
 * - acceptMemberInvite: Accepts a pending invitation (status -> active)
 * - updateMemberInviteToken: Updates the invite token (for resend)
 * - listMembers: Lists all members for a library (pending + active)
 * - listMembershipsByEmail: Lists active memberships for a user
 * - isModeratorOrOwner: Checks if user is active moderator or owner
 * - isCoCreatorOrOwner: Checks if user is active co-creator or owner
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
import { buildCaseInsensitiveEmailRegex, normalizeEmail } from '@/lib/auth/user-email';
import { v4 as uuidv4 } from 'uuid';

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
      col.createIndex({ inviteToken: 1 }, { unique: true, sparse: true, name: 'invite_token_unique' }),
    ]);
  } catch {
    // Indizes existieren bereits oder Fehler beim Erstellen (ignorieren)
  }
  return col;
}

/**
 * Fuegt ein Mitglied zu einer Library hinzu (Status: pending, mit inviteToken).
 * Gibt das generierte inviteToken zurueck.
 * 
 * @param libraryId Library-ID
 * @param userEmail E-Mail des Mitglieds
 * @param role Rolle des Mitglieds
 * @param addedBy E-Mail des Benutzers, der das Mitglied eingeladen hat
 * @returns Das generierte inviteToken
 */
export async function addMember(
  libraryId: string,
  userEmail: string,
  role: LibraryRole,
  addedBy: string
): Promise<string> {
  const col = await getMembersCollection();
  const normalizedUserEmail = normalizeEmail(userEmail);
  const normalizedAddedBy = normalizeEmail(addedBy);
  const inviteToken = uuidv4();
  
  // Prüfe ob Mitglied bereits existiert
  const existing =
    (await col.findOne({ libraryId, userEmail: normalizedUserEmail })) ||
    (await col.findOne({ libraryId, userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) } }));
  if (existing) {
    // Aktualisiere bestehendes Mitglied (neuer Token, zurueck auf pending)
    await col.updateOne(
      { libraryId, userEmail: existing.userEmail },
      {
        $set: {
          role,
          status: 'pending',
          inviteToken,
          addedBy: normalizedAddedBy,
          addedAt: new Date(),
        },
        $unset: { acceptedAt: '' },
      }
    );
  } else {
    await col.insertOne({
      libraryId,
      userEmail: normalizedUserEmail,
      role,
      status: 'pending',
      inviteToken,
      addedAt: new Date(),
      addedBy: normalizedAddedBy,
    });
  }

  return inviteToken;
}

/**
 * Sucht ein Mitglied anhand des Einladungs-Tokens
 * 
 * @param token Einladungs-Token
 * @returns Member oder null wenn nicht gefunden
 */
export async function getMemberByInviteToken(
  token: string
): Promise<LibraryMember | null> {
  const col = await getMembersCollection();
  return await col.findOne({ inviteToken: token });
}

/**
 * Akzeptiert eine ausstehende Mitglieder-Einladung.
 * Setzt den Status auf 'active' und entfernt den Token.
 * 
 * @param token Einladungs-Token
 * @param userEmail E-Mail des annehmenden Benutzers (zur Validierung)
 * @returns Das aktualisierte Member-Dokument oder null bei Fehler
 */
export async function acceptMemberInvite(
  token: string,
  userEmail: string
): Promise<LibraryMember | null> {
  const col = await getMembersCollection();
  const member = await getMemberByInviteToken(token);
  if (!member) return null;

  // E-Mail-Validierung (case-insensitive)
  const normalizedUserEmail = normalizeEmail(userEmail);
  const normalizedMemberEmail = normalizeEmail(member.userEmail);
  if (normalizedUserEmail !== normalizedMemberEmail) {
    return null;
  }

  await col.updateOne(
    { inviteToken: token },
    {
      $set: {
        status: 'active' as const,
        acceptedAt: new Date(),
      },
      $unset: { inviteToken: '' },
    }
  );

  return { ...member, status: 'active', acceptedAt: new Date() };
}

/**
 * Aktualisiert den Einladungs-Token (z.B. beim erneuten Senden).
 * 
 * @param libraryId Library-ID
 * @param userEmail E-Mail des Mitglieds
 * @returns Der neue Token oder null bei Fehler
 */
export async function updateMemberInviteToken(
  libraryId: string,
  userEmail: string
): Promise<string | null> {
  const col = await getMembersCollection();
  const normalizedUserEmail = normalizeEmail(userEmail);
  const newToken = uuidv4();

  const result = await col.updateOne(
    {
      libraryId,
      $or: [
        { userEmail: normalizedUserEmail },
        { userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) } },
      ],
      status: 'pending',
    },
    { $set: { inviteToken: newToken, addedAt: new Date() } }
  );

  return result.modifiedCount > 0 ? newToken : null;
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
  const normalizedUserEmail = normalizeEmail(userEmail);

  // Erst versuchen wir den normalisierten Key, dann Fallback case-insensitiv.
  const res = await col.deleteOne({ libraryId, userEmail: normalizedUserEmail });
  if (res.deletedCount === 0) {
    await col.deleteOne({ libraryId, userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) } });
  }
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
  const normalizedUserEmail = normalizeEmail(userEmail);
  return (
    (await col.findOne({ libraryId, userEmail: normalizedUserEmail })) ||
    (await col.findOne({ libraryId, userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) } }))
  );
}

/**
 * Listet alle Mitglieder einer Library (pending + active).
 * Owner sieht damit den kompletten Status aller Einladungen.
 * 
 * @param libraryId Library-ID
 * @returns Array von Members
 */
export async function listMembers(libraryId: string): Promise<LibraryMember[]> {
  const col = await getMembersCollection();
  const members = await col.find({ libraryId }).toArray();
  // Alte Eintraege ohne status-Feld als 'active' normalisieren
  return members.map(m => ({
    ...m,
    status: m.status || 'active',
  }));
}

/**
 * Prüft ob Benutzer Moderator oder Owner einer Library ist.
 * Nur aktive Mitgliedschaften (status: 'active') zaehlen.
 * 
 * @param libraryId Library-ID
 * @param userEmail Benutzer-E-Mail
 * @returns true wenn Benutzer Owner oder aktiver Moderator ist
 */
export async function isModeratorOrOwner(
  libraryId: string,
  userEmail: string
): Promise<boolean> {
  const normalizedUserEmail = normalizeEmail(userEmail);

  const isDebug = process.env.NODE_ENV === 'development';
  if (isDebug) {
    console.log('[isModeratorOrOwner] Start:', { libraryId, userEmail, normalizedUserEmail });
  }

  // Prüfe zuerst ob Benutzer Owner ist (über Library-Struktur)
  const libraryService = LibraryService.getInstance();
  
  try {
    const library = await libraryService.getLibrary(normalizedUserEmail, libraryId);
    if (library) {
      if (isDebug) {
        console.log('[isModeratorOrOwner] Owner erkannt:', { libraryId, normalizedUserEmail });
      }
      return true;
    }
  } catch (err) {
    if (isDebug) {
      console.log('[isModeratorOrOwner] Owner-Check fehlgeschlagen:', { libraryId, normalizedUserEmail, error: err instanceof Error ? err.message : String(err) });
    }
  }
  
  // Prüfe ob Benutzer aktiver Moderator ist.
  // Alte Eintraege ohne status-Feld gelten als active (Abwaertskompatibilitaet).
  const col = await getMembersCollection();
  const activeStatusFilter = { $or: [{ status: 'active' as const }, { status: { $exists: false } }] };
  const member =
    (await col.findOne({
      libraryId,
      userEmail: normalizedUserEmail,
      role: 'moderator',
      ...activeStatusFilter,
    })) ||
    (await col.findOne({
      libraryId,
      userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) },
      role: 'moderator',
      ...activeStatusFilter,
    }));
  
  const isModerator = member !== null;
  if (isDebug) {
    console.log('[isModeratorOrOwner] Ergebnis:', { libraryId, normalizedUserEmail, isModerator, memberFound: !!member });
  }
  
  return isModerator;
}

/**
 * Listet alle aktiven Library-Mitgliedschaften eines Benutzers (ueber alle Libraries hinweg).
 * Nur aktive Mitgliedschaften (status: 'active') werden zurueckgegeben.
 * Wird verwendet, um Co-Creator-Libraries im Dropdown anzuzeigen.
 * 
 * @param userEmail Benutzer-E-Mail
 * @param role Optionaler Filter nach Rolle (z.B. nur 'co-creator')
 * @returns Array von aktiven LibraryMember-Eintraegen
 */
export async function listMembershipsByEmail(
  userEmail: string,
  role?: LibraryRole
): Promise<LibraryMember[]> {
  const col = await getMembersCollection();
  const normalizedUserEmail = normalizeEmail(userEmail);
  
  // Alte Eintraege ohne status-Feld gelten als active (Abwaertskompatibilitaet)
  const activeStatusFilter = { $or: [{ status: 'active' as const }, { status: { $exists: false } }] };
  const filter: Record<string, unknown> = { ...activeStatusFilter };
  if (role) {
    filter.role = role;
  }
  
  // Zuerst exakte Suche, dann case-insensitiver Fallback
  const exact = await col.find({ ...filter, userEmail: normalizedUserEmail } as Parameters<typeof col.find>[0]).toArray();
  if (exact.length > 0) return exact;
  
  return await col.find({
    ...filter,
    userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) },
  } as Parameters<typeof col.find>[0]).toArray();
}

/**
 * Prueft ob Benutzer Co-Creator oder Owner einer Library ist.
 * Nur aktive Mitgliedschaften (status: 'active') zaehlen.
 * Co-Creators haben vollen Arbeitszugriff (Archiv, Explore, Story, Templates),
 * aber keinen Zugang zu den Einstellungen.
 * 
 * @param libraryId Library-ID
 * @param userEmail Benutzer-E-Mail
 * @returns true wenn Benutzer Owner oder aktiver Co-Creator ist
 */
export async function isCoCreatorOrOwner(
  libraryId: string,
  userEmail: string
): Promise<boolean> {
  const normalizedUserEmail = normalizeEmail(userEmail);

  // Owner-Check ueber Library-Struktur
  const libraryService = LibraryService.getInstance();
  try {
    const library = await libraryService.getLibrary(normalizedUserEmail, libraryId);
    if (library) return true;
  } catch {
    // Nicht Owner
  }
  
  // Co-Creator-Check ueber library_members (nur aktive).
  // Alte Eintraege ohne status-Feld gelten als active (Abwaertskompatibilitaet).
  const col = await getMembersCollection();
  const activeStatusFilter = { $or: [{ status: 'active' as const }, { status: { $exists: false } }] };
  const member =
    (await col.findOne({
      libraryId,
      userEmail: normalizedUserEmail,
      role: 'co-creator',
      ...activeStatusFilter,
    })) ||
    (await col.findOne({
      libraryId,
      userEmail: { $regex: buildCaseInsensitiveEmailRegex(normalizedUserEmail) },
      role: 'co-creator',
      ...activeStatusFilter,
    }));
  
  return member !== null;
}
