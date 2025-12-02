/**
 * @fileoverview Library Access Request Repository
 * 
 * @description
 * MongoDB repository for managing library access requests. Handles CRUD operations
 * for access requests including self-service requests and moderator invitations.
 * 
 * @module repositories
 * 
 * @exports
 * - createAccessRequest: Creates a new access request
 * - getAccessRequestByUserAndLibrary: Gets access request for user and library
 * - getAccessRequestById: Gets access request by ID
 * - listAccessRequestsForLibrary: Lists all access requests for a library
 * - updateAccessRequestStatus: Updates access request status
 * - getAccessRequestByInviteToken: Gets access request by invite token
 * - hasUserAccess: Checks if user has access to library
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/types/library-access: Access request type definitions
 * - mongodb: MongoDB driver types
 * - crypto: UUID generation
 */

import { getCollection } from '@/lib/mongodb-service';
import crypto from 'crypto';
import type { Collection } from 'mongodb';
import type { LibraryAccessRequest, AccessRequestStatus } from '@/types/library-access';

const COLLECTION_NAME = 'library_access_requests';

/**
 * Gibt die MongoDB-Collection für Access Requests zurück und erstellt Indizes
 */
async function getAccessRequestsCollection(): Promise<Collection<LibraryAccessRequest>> {
  const col = await getCollection<LibraryAccessRequest>(COLLECTION_NAME);
  try {
    await Promise.all([
      col.createIndex({ id: 1 }, { unique: true, name: 'id_unique' }),
      col.createIndex({ libraryId: 1, userEmail: 1 }, { name: 'library_user' }),
      col.createIndex({ inviteToken: 1 }, { unique: true, sparse: true, name: 'inviteToken_unique' }),
      col.createIndex({ libraryId: 1, status: 1, requestedAt: -1 }, { name: 'library_status_requestedAt_desc' }),
    ]);
  } catch {
    // Indizes existieren bereits oder Fehler beim Erstellen (ignorieren)
  }
  return col;
}

/**
 * Erstellt eine neue Zugriffsanfrage
 * 
 * @param request Access Request ohne id und requestedAt (werden automatisch generiert)
 * @returns ID der erstellten Anfrage
 */
export async function createAccessRequest(
  request: Omit<LibraryAccessRequest, 'id' | 'requestedAt'>
): Promise<string> {
  const col = await getAccessRequestsCollection();
  const id = crypto.randomUUID();
  const accessRequest: LibraryAccessRequest = {
    ...request,
    id,
    requestedAt: new Date(),
  };
  
  await col.insertOne(accessRequest);
  return id;
}

/**
 * Ruft Zugriffsanfrage für Benutzer und Library ab
 * 
 * @param libraryId Library-ID
 * @param userEmail Benutzer-E-Mail
 * @returns Access Request oder null wenn nicht gefunden
 */
export async function getAccessRequestByUserAndLibrary(
  libraryId: string,
  userEmail: string
): Promise<LibraryAccessRequest | null> {
  const col = await getAccessRequestsCollection();
  return await col.findOne({ libraryId, userEmail });
}

/**
 * Ruft Zugriffsanfrage nach ID ab
 * 
 * @param id Request-ID
 * @returns Access Request oder null wenn nicht gefunden
 */
export async function getAccessRequestById(id: string): Promise<LibraryAccessRequest | null> {
  const col = await getAccessRequestsCollection();
  return await col.findOne({ id });
}

/**
 * Listet alle Zugriffsanfragen für eine Library
 * 
 * @param libraryId Library-ID
 * @param status Optional: Filter nach Status
 * @returns Array von Access Requests, sortiert nach requestedAt DESC
 */
export async function listAccessRequestsForLibrary(
  libraryId: string,
  status?: AccessRequestStatus
): Promise<LibraryAccessRequest[]> {
  const col = await getAccessRequestsCollection();
  const filter: Record<string, unknown> = { libraryId };
  if (status) {
    filter.status = status;
  }
  
  return await col.find(filter).sort({ requestedAt: -1 }).toArray();
}

/**
 * Aktualisiert den Status einer Zugriffsanfrage
 * 
 * @param id Request-ID
 * @param status Neuer Status
 * @param reviewedBy E-Mail des Reviewers
 * @returns true wenn erfolgreich aktualisiert
 */
export async function updateAccessRequestStatus(
  id: string,
  status: AccessRequestStatus,
  reviewedBy: string
): Promise<boolean> {
  const col = await getAccessRequestsCollection();
  const result = await col.updateOne(
    { id },
    {
      $set: {
        status,
        reviewedAt: new Date(),
        reviewedBy,
      },
    }
  );
  
  return result.modifiedCount === 1;
}

/**
 * Ruft Zugriffsanfrage nach Invite-Token ab
 * 
 * @param token Invite-Token
 * @returns Access Request oder null wenn nicht gefunden
 */
export async function getAccessRequestByInviteToken(
  token: string
): Promise<LibraryAccessRequest | null> {
  const col = await getAccessRequestsCollection();
  return await col.findOne({ inviteToken: token });
}

/**
 * Prüft ob Benutzer Zugriff auf Library hat
 * 
 * @param libraryId Library-ID
 * @param userEmail Benutzer-E-Mail
 * @returns true wenn Benutzer approved Access Request hat
 */
export async function hasUserAccess(
  libraryId: string,
  userEmail: string
): Promise<boolean> {
  const col = await getAccessRequestsCollection();
  const request = await col.findOne({
    libraryId,
    userEmail,
    status: 'approved',
  });
  
  return request !== null;
}

/**
 * Ruft alle ausstehenden Einladungen für eine E-Mail-Adresse ab
 * 
 * @param userEmail Benutzer-E-Mail
 * @returns Array von ausstehenden Access Requests mit inviteToken
 */
export async function getPendingInvitesByEmail(
  userEmail: string
): Promise<LibraryAccessRequest[]> {
  const col = await getAccessRequestsCollection();
  return await col.find({
    userEmail,
    status: 'pending',
    inviteToken: { $exists: true, $ne: null as unknown as string },
  }).toArray();
}

/**
 * Aktualisiert den Invite-Token einer Zugriffsanfrage
 * 
 * @param id Request-ID
 * @param inviteToken Neuer Invite-Token
 * @returns true wenn erfolgreich aktualisiert
 */
export async function updateAccessRequestInviteToken(
  id: string,
  inviteToken: string
): Promise<boolean> {
  const col = await getAccessRequestsCollection();
  const result = await col.updateOne(
    { id },
    {
      $set: {
        inviteToken,
      },
    }
  );
  
  return result.modifiedCount === 1;
}

/**
 * Löscht eine Zugriffsanfrage
 * 
 * @param id Request-ID
 * @returns true wenn erfolgreich gelöscht
 */
export async function deleteAccessRequest(id: string): Promise<boolean> {
  const col = await getAccessRequestsCollection();
  const result = await col.deleteOne({ id });
  return result.deletedCount === 1;
}

