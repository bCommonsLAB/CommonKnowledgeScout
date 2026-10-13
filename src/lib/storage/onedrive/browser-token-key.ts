/**
 * @fileoverview Browser-Schluessel der OneDrive-Tokens (client-sicher, keine Abhaengigkeiten).
 *
 * Seit Teil A des Plans speicher-verbindungen-und-library-anlage haengen
 * OneDrive-Tokens an der Speicher-Verbindung, nicht an der Library: ein Login
 * gilt fuer alle Libraries auf derselben Verbindung. Der localStorage-Schluessel
 * ist deshalb `onedrive_tokens_<connectionId>`. Eine OneDrive-Library ohne
 * Verbindung ist ein Migrationsfehler und wird laut gemeldet.
 */

export const MIGRATION_HINWEIS =
  'Bitte `pnpm tsx scripts/migrate-storage-connections.ts --apply` ausfuehren.'

export function oneDriveTokenStorageKey(connectionId: string): string {
  return `onedrive_tokens_${connectionId}`
}

/** Verbindungs-Id einer OneDrive-Library als Token-Geltungsbereich; wirft ohne Bindung. */
export function resolveOneDriveTokenScope(library: { id: string; label?: string; storageConnectionId?: string }): string {
  const scope = library.storageConnectionId?.trim() ?? ''
  if (scope === '') {
    throw new Error(
      `OneDrive-Library "${library.label ?? library.id}" ist nicht auf eine Speicher-Verbindung umgehaengt. ${MIGRATION_HINWEIS}`,
    )
  }
  return scope
}
