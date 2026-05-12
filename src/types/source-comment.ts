/**
 * @fileoverview Source-Comment Typen (Feedback-Kommentare pro Quelle)
 *
 * @description
 * Multi-User-Kommentar-Thread pro RAG-Quelle in der Explorer-Tabelle.
 * Sichtbarkeit folgt der Feedback-an-Owner-Logik:
 * - Owner + aktive Co-Creators sehen alle Kommentare zur Quelle.
 * - Gaeste (eingeloggt, aber kein Mitglied) sehen nur ihre eigenen.
 *
 * Editieren ist Author-only, Loeschen ist Author-or-Member (Soft-Delete).
 * Edits werden voll versioniert: vorherige Bodies wandern in `revisions[]`.
 *
 * @module types
 */

/**
 * Eine archivierte Body-Version eines Kommentars.
 * Wird bei jedem Edit am Anfang von `revisions` ergaenzt.
 */
export interface SourceCommentRevision {
  /** Body-Inhalt vor dem Edit */
  body: string;
  /** Zeitpunkt der Aenderung, die diese Version abloeste */
  editedAt: Date;
  /** E-Mail des Users, der die Aenderung vorgenommen hat */
  editorEmail: string;
}

/**
 * Persistenz-Form eines Kommentars in der MongoDB-Collection
 * `source_comments`.
 *
 * Quellen-Identitaet ueber `(libraryId, fileId)` - storage-agnostisch.
 */
export interface SourceComment {
  /** Mongo `_id` als String fuer den Client (ObjectId.toHexString) */
  id: string;
  libraryId: string;
  /** Stabile Quell-ID (Vector-Namespace) */
  fileId: string;
  /** Author (normalisierte E-Mail) */
  authorEmail: string;
  /** Aktueller Body */
  body: string;
  /** Vorherige Bodies, neueste zuerst */
  revisions: SourceCommentRevision[];
  createdAt: Date;
  /** Letzter Edit-Zeitpunkt; gesetzt wenn `revisions.length > 0` */
  editedAt?: Date;
  /** Soft-Delete-Marker; bei gesetztem Wert wird `body` nicht gerendert */
  deletedAt?: Date;
  /** E-Mail des Users, der den Kommentar geloescht hat */
  deletedBy?: string;
}

/** Eingabe-DTO fuer `POST /api/library/[libraryId]/source-comments` */
export interface SourceCommentCreateInput {
  fileId: string;
  body: string;
}

/** Eingabe-DTO fuer `PATCH /api/library/[libraryId]/source-comments/[id]` */
export interface SourceCommentUpdateInput {
  body: string;
}

/** Antwort von `GET /api/library/[libraryId]/source-comments?fileId=...` */
export interface SourceCommentThreadResponse {
  libraryId: string;
  fileId: string;
  comments: SourceComment[];
  /**
   * Hinweis fuer den Client, ob die Liste rolelhaengig gefiltert ist
   * (Gast sieht nur eigene). Reine UI-Hilfe, keine Sicherheitsgrenze.
   */
  filteredToOwn: boolean;
}

/** Antwort von `GET /api/library/[libraryId]/source-comments?fileIds=a,b,c` */
export interface SourceCommentCountsResponse {
  libraryId: string;
  /** Map fileId -> Anzahl sichtbarer (nicht soft-deleted) Kommentare */
  counts: Record<string, number>;
  filteredToOwn: boolean;
}
