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
 * - 'owner': Full access to all library settings and access management
 * - 'moderator': Can manage access requests and send invitations, but no access to library settings
 */
export type LibraryRole = 'owner' | 'moderator';

/**
 * Library member document
 * Represents a user's role in a library
 */
export interface LibraryMember {
  /** Library ID this member belongs to */
  libraryId: string;
  /** Email address of the member */
  userEmail: string;
  /** Role of the member */
  role: LibraryRole;
  /** Timestamp when the member was added */
  addedAt: Date;
  /** Email of the user who added this member */
  addedBy: string;
}

