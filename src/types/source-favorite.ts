/**
 * @fileoverview Source-Favorite Typen
 *
 * @description
 * Datenmodell fuer geteilte Quell-Favoriten in der Explorer-Tabelle.
 * Ein Favorit markiert eine RAG-Quelle (Vector-Meta-Doc) als bevorzugt
 * fuer die gesamte Library. Sichtbarkeit/Toggle ist auf Owner und
 * aktive Co-Creators beschraenkt (siehe Plan + Berechtigungsmatrix).
 *
 * @module types
 */

/**
 * Persistenz-Form eines Favoriten in der MongoDB-Collection
 * `source_favorites`.
 *
 * Identitaet einer Quelle: storage-agnostischer `fileId`-Schluessel
 * (Top-Level der Vector-Meta-Doc). Kein Provider-Pfad, kein
 * `library.type`-Branch (siehe `storage-abstraction.mdc`).
 */
export interface SourceFavorite {
  /** Library, in der die Quelle favorisiert wurde */
  libraryId: string;
  /** Stabile Quell-ID (Vector-Namespace) */
  fileId: string;
  /** E-Mail des Users, der den Favoriten gesetzt hat (Audit) */
  createdBy: string;
  /** Zeitpunkt der Markierung */
  createdAt: Date;
}

/** Antwort von `GET /api/library/[libraryId]/source-favorites` */
export interface SourceFavoriteListResponse {
  libraryId: string;
  favorites: string[];
}

/** Antwort von `POST /api/library/[libraryId]/source-favorites` (Toggle) */
export interface SourceFavoriteToggleResponse {
  libraryId: string;
  fileId: string;
  /** true = neu hinzugefuegt, false = entfernt */
  added: boolean;
}
