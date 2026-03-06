/**
 * @fileoverview Library Members Types
 * 
 * @description
 * Type definitions for library member roles and permissions.
 * Handles owner and moderator roles for library access management.
 * 
 * @module library-members
 */

/**
 * Library member role
 * - 'owner': Voller Zugriff auf alle Library-Einstellungen und Zugriffsverwaltung
 * - 'moderator': Kann Zugriffsanfragen verwalten und Einladungen senden, kein Zugang zu Library-Einstellungen
 * - 'co-creator': Voller Arbeitszugriff (Archiv, Explore, Story, Templates), aber kein Zugang zu Settings.
 *   Arbeitet auf derselben libraryId wie der Owner (geteilte Shadow Twins, Stories, Vektor-Daten).
 */
export type LibraryRole = 'owner' | 'moderator' | 'co-creator';

/** Einladungsstatus eines Mitglieds */
export type MemberStatus = 'pending' | 'active' | 'declined';

/**
 * Library member document
 * Represents a user's role in a library.
 * Mitglieder durchlaufen einen Einladungsflow: pending -> active.
 */
export interface LibraryMember {
  /** Library ID this member belongs to */
  libraryId: string;
  /** Email address of the member */
  userEmail: string;
  /** Role of the member */
  role: LibraryRole;
  /** Einladungsstatus: 'pending' bis zur Bestaetigung, dann 'active' */
  status: MemberStatus;
  /** Timestamp when the member was added/invited */
  addedAt: Date;
  /** Email of the user who added this member */
  addedBy: string;
  /** Einladungs-Token fuer den Bestaetigungslink (nur bei pending) */
  inviteToken?: string;
  /** Zeitpunkt der Annahme der Einladung */
  acceptedAt?: Date;
}



