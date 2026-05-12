/**
 * @fileoverview Source-Comments Repository
 *
 * @description
 * MongoDB-Repository fuer Multi-User-Feedback-Kommentare pro RAG-Quelle.
 * Collection `source_comments`.
 *
 * Sichtbarkeit (Lese-Pfad):
 * - Member (Owner + aktive Co-Creator): alle Kommentare zur Quelle.
 * - Gast: ueber `onlyAuthorEmail` filtern -> nur eigene.
 *
 * Versionierung:
 * - Bei Edit wird der bisherige `body` als Revision in `revisions` gepusht
 *   (neueste zuerst); `editedAt` wird gesetzt.
 *
 * Soft-Delete:
 * - `deletedAt` und `deletedBy` werden gesetzt; das Dokument bleibt erhalten,
 *   damit der Thread "Kommentar geloescht von X" anzeigen kann.
 *
 * @module repositories
 *
 * @exports
 * - listCommentsByFileId
 * - getCommentCountsForLibrary
 * - createComment
 * - updateComment
 * - softDeleteComment
 * - getCommentById
 *
 * @dependencies
 * - mongodb (ObjectId)
 * - @/lib/mongodb-service
 * - @/types/source-comment
 * - @/lib/auth/user-email
 */

import { getCollection } from '@/lib/mongodb-service';
import { ObjectId, type Collection, type WithId } from 'mongodb';
import type {
  SourceComment,
  SourceCommentRevision,
} from '@/types/source-comment';
import { normalizeEmail } from '@/lib/auth/user-email';

const COLLECTION_NAME = 'source_comments';

/** Persistenz-Form (intern): wie SourceComment, aber ohne `id`-String */
interface SourceCommentDoc {
  libraryId: string;
  fileId: string;
  authorEmail: string;
  body: string;
  revisions: SourceCommentRevision[];
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

/** Domain-Fehler fuer Berechtigungsverstoesse im Repo (von Routes als 403 gemappt) */
export class SourceCommentForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceCommentForbiddenError';
  }
}

/** Domain-Fehler wenn ein Kommentar nicht existiert */
export class SourceCommentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceCommentNotFoundError';
  }
}

async function getCommentsCollection(): Promise<Collection<SourceCommentDoc>> {
  const col = await getCollection<SourceCommentDoc>(COLLECTION_NAME);
  try {
    await Promise.all([
      col.createIndex(
        { libraryId: 1, fileId: 1, createdAt: 1 },
        { name: 'library_file_created' },
      ),
      col.createIndex(
        { libraryId: 1, authorEmail: 1, createdAt: 1 },
        { name: 'library_author_created' },
      ),
    ]);
  } catch (err) {
    console.warn('[source-comments-repo] Index-Setup uebersprungen:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return col;
}

/** Public-Form mit String-`id` und ohne Mongo-`_id` */
function toPublic(doc: WithId<SourceCommentDoc>): SourceComment {
  return {
    id: doc._id.toHexString(),
    libraryId: doc.libraryId,
    fileId: doc.fileId,
    authorEmail: doc.authorEmail,
    body: doc.body,
    revisions: doc.revisions ?? [],
    createdAt: doc.createdAt,
    editedAt: doc.editedAt,
    deletedAt: doc.deletedAt,
    deletedBy: doc.deletedBy,
  };
}

/**
 * Listet alle Kommentare zu (libraryId, fileId), chronologisch aufsteigend.
 * Soft-deleted Kommentare bleiben enthalten - der UI rendert sie als "geloescht".
 *
 * @param opts.onlyAuthorEmail Wenn gesetzt, werden nur eigene Kommentare
 *   zurueckgegeben (Gast-Pfad). Server muss vorher die Rolle pruefen.
 */
export async function listCommentsByFileId(
  libraryId: string,
  fileId: string,
  opts: { onlyAuthorEmail?: string } = {},
): Promise<SourceComment[]> {
  if (!libraryId || !fileId) {
    throw new Error('listCommentsByFileId: libraryId und fileId sind erforderlich');
  }
  const col = await getCommentsCollection();
  const filter: Record<string, unknown> = { libraryId, fileId };
  if (opts.onlyAuthorEmail) {
    filter.authorEmail = normalizeEmail(opts.onlyAuthorEmail);
  }
  const docs = await col.find(filter).sort({ createdAt: 1 }).toArray();
  return docs.map(toPublic);
}

/**
 * Bulk-Counts: pro `fileId` die Anzahl nicht-soft-deleted Kommentare.
 * Effizient via Mongo-Aggregation.
 *
 * @param opts.onlyAuthorEmail Wenn gesetzt, zaehlt nur eigene Kommentare.
 */
export async function getCommentCountsForLibrary(
  libraryId: string,
  fileIds: string[],
  opts: { onlyAuthorEmail?: string } = {},
): Promise<Record<string, number>> {
  if (!libraryId) {
    throw new Error('getCommentCountsForLibrary: libraryId ist erforderlich');
  }
  if (!fileIds || fileIds.length === 0) {
    return {};
  }

  const match: Record<string, unknown> = {
    libraryId,
    fileId: { $in: fileIds },
    deletedAt: { $exists: false },
  };
  if (opts.onlyAuthorEmail) {
    match.authorEmail = normalizeEmail(opts.onlyAuthorEmail);
  }

  const col = await getCommentsCollection();
  const cursor = col.aggregate<{ _id: string; count: number }>([
    { $match: match },
    { $group: { _id: '$fileId', count: { $sum: 1 } } },
  ]);

  const result: Record<string, number> = {};
  for (const fid of fileIds) result[fid] = 0;
  for await (const row of cursor) {
    result[row._id] = row.count;
  }
  return result;
}

/** Liefert einen einzelnen Kommentar oder null */
export async function getCommentById(commentId: string): Promise<SourceComment | null> {
  if (!ObjectId.isValid(commentId)) return null;
  const col = await getCommentsCollection();
  const doc = await col.findOne({ _id: new ObjectId(commentId) });
  return doc ? toPublic(doc) : null;
}

/** Erstellt einen neuen Kommentar und liefert die Public-Form zurueck */
export async function createComment(
  libraryId: string,
  fileId: string,
  authorEmail: string,
  body: string,
): Promise<SourceComment> {
  if (!libraryId || !fileId) {
    throw new Error('createComment: libraryId und fileId sind erforderlich');
  }
  const trimmed = (body ?? '').trim();
  if (!trimmed) {
    throw new Error('createComment: body darf nicht leer sein');
  }
  if (!authorEmail) {
    throw new Error('createComment: authorEmail ist erforderlich');
  }

  const col = await getCommentsCollection();
  const doc: SourceCommentDoc = {
    libraryId,
    fileId,
    authorEmail: normalizeEmail(authorEmail),
    body: trimmed,
    revisions: [],
    createdAt: new Date(),
  };
  const res = await col.insertOne(doc);
  return toPublic({ ...doc, _id: res.insertedId });
}

/**
 * Aktualisiert den Body eines Kommentars. Nur der Author darf editieren.
 * Vorherige Version landet in `revisions` (neueste zuerst).
 *
 * Wirft `SourceCommentNotFoundError` oder `SourceCommentForbiddenError`.
 */
export async function updateComment(
  commentId: string,
  requesterEmail: string,
  body: string,
): Promise<SourceComment> {
  if (!ObjectId.isValid(commentId)) {
    throw new SourceCommentNotFoundError(`updateComment: Kommentar ${commentId} nicht gefunden`);
  }
  const trimmed = (body ?? '').trim();
  if (!trimmed) {
    throw new Error('updateComment: body darf nicht leer sein');
  }
  if (!requesterEmail) {
    throw new Error('updateComment: requesterEmail ist erforderlich');
  }

  const col = await getCommentsCollection();
  const _id = new ObjectId(commentId);
  const existing = await col.findOne({ _id });
  if (!existing) {
    throw new SourceCommentNotFoundError(`updateComment: Kommentar ${commentId} nicht gefunden`);
  }
  if (existing.deletedAt) {
    throw new SourceCommentForbiddenError('updateComment: Geloeschte Kommentare koennen nicht editiert werden');
  }

  const normalized = normalizeEmail(requesterEmail);
  if (normalizeEmail(existing.authorEmail) !== normalized) {
    throw new SourceCommentForbiddenError('updateComment: Nur der Author darf seinen Kommentar editieren');
  }
  if (existing.body === trimmed) {
    // Idempotenter No-Op: dieselbe Version, keine neue Revision.
    return toPublic(existing);
  }

  const now = new Date();
  const revision: SourceCommentRevision = {
    body: existing.body,
    editedAt: now,
    editorEmail: normalized,
  };

  const updated = await col.findOneAndUpdate(
    { _id },
    {
      $set: { body: trimmed, editedAt: now },
      $push: { revisions: { $each: [revision], $position: 0 } },
    },
    { returnDocument: 'after' },
  );
  if (!updated) {
    throw new SourceCommentNotFoundError(`updateComment: Kommentar ${commentId} verschwunden`);
  }
  return toPublic(updated);
}

/**
 * Soft-loescht einen Kommentar. Author darf immer, Member zusaetzlich beliebige.
 *
 * @param isModerator Vorher serverseitig per `isCoCreatorOrOwner` ermittelt.
 */
export async function softDeleteComment(
  commentId: string,
  requesterEmail: string,
  isModerator: boolean,
): Promise<SourceComment> {
  if (!ObjectId.isValid(commentId)) {
    throw new SourceCommentNotFoundError(`softDeleteComment: Kommentar ${commentId} nicht gefunden`);
  }
  if (!requesterEmail) {
    throw new Error('softDeleteComment: requesterEmail ist erforderlich');
  }

  const col = await getCommentsCollection();
  const _id = new ObjectId(commentId);
  const existing = await col.findOne({ _id });
  if (!existing) {
    throw new SourceCommentNotFoundError(`softDeleteComment: Kommentar ${commentId} nicht gefunden`);
  }
  if (existing.deletedAt) {
    return toPublic(existing);
  }

  const normalized = normalizeEmail(requesterEmail);
  const isAuthor = normalizeEmail(existing.authorEmail) === normalized;
  if (!isAuthor && !isModerator) {
    throw new SourceCommentForbiddenError('softDeleteComment: Keine Berechtigung zum Loeschen');
  }

  const updated = await col.findOneAndUpdate(
    { _id },
    { $set: { deletedAt: new Date(), deletedBy: normalized } },
    { returnDocument: 'after' },
  );
  if (!updated) {
    throw new SourceCommentNotFoundError(`softDeleteComment: Kommentar ${commentId} verschwunden`);
  }
  return toPublic(updated);
}
