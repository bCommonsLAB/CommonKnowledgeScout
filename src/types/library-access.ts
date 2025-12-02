/**
 * @fileoverview Library Access Request Types
 * 
 * @description
 * Type definitions for library access request system. Handles self-service
 * access requests and moderator invitations with approval workflows.
 * 
 * @module library-access
 */

/**
 * Access request source type
 * - 'self': User requested access themselves
 * - 'moderatorInvite': User was invited by a moderator/owner
 */
export type AccessRequestSource = 'self' | 'moderatorInvite';

/**
 * Access request status
 * - 'pending': Request is waiting for approval
 * - 'approved': Access has been granted
 * - 'rejected': Access has been denied
 */
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Library access request document
 * Represents a user's request to access a library that requires authentication
 */
export interface LibraryAccessRequest {
  /** Unique identifier for the access request */
  id: string;
  /** Library ID this request is for */
  libraryId: string;
  /** Email address of the requesting user */
  userEmail: string;
  /** Display name of the requesting user */
  userName: string;
  /** Current status of the request */
  status: AccessRequestStatus;
  /** Source of the request (self-service or moderator invite) */
  source: AccessRequestSource;
  /** Timestamp when the request was created */
  requestedAt: Date;
  /** Timestamp when the request was reviewed (approved/rejected) */
  reviewedAt?: Date;
  /** Email of the reviewer (owner or moderator) */
  reviewedBy?: string;
  /** Email of the moderator/owner who sent the invite (only for moderatorInvite) */
  invitedBy?: string;
  /** Unique token for invite acceptance (only for moderatorInvite) */
  inviteToken?: string;
}


