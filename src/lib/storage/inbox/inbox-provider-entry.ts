/**
 * @fileoverview Server-Einstieg fuer den Inbox-Provider (ADR-0004 II, Welle II-A).
 *
 * @description
 * `getInboxProvider(userEmail, libraryId)` ist das Inbox-Pendant zu
 * `getServerProvider`: Es konfiguriert die `StorageFactory` im Server-Kontext
 * (`setServerContext(true)`) und liefert einen Provider vom Typ `'inbox'` —
 * einen duennen, content-adressierten Blob-Bereich der Library, NIE das
 * Owner-Archiv (Invariante ADR-0004). Die eigentliche Erfass-Berechtigung
 * (owner/co-creator/contributor) prueft der Aufrufer (Capture-Route via
 * `resolveCaptureRole`); hier wird die Library nur owner-unabhaengig geladen,
 * um die Azure-Inbox-Konfiguration (Connection-String/Container) zu erhalten.
 *
 * `inboxUsernameFromEmail` leitet aus der E-Mail das Pfad-Segment `{username}`
 * fuer `{libraryId}/inbox/{username}/...` ab — deterministisch und Blob-sicher,
 * damit Capture- und Provider-Pfad konvergieren.
 *
 * @see src/lib/storage/server-provider.ts (Vorbild getServerProvider)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module storage/inbox
 */

import { StorageFactory } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/types';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Leitet aus einer E-Mail ein deterministisches, Blob-/Pfad-sicheres
 * `{username}`-Segment ab (z.B. `peter.aichner@x-design.com` ->
 * `peter.aichner-x-design.com`). Erlaubt sind `a-z0-9._-`; alles andere wird zu
 * `-`, fuehrende/abschliessende `-` entfernt. Wirft bei leerer Eingabe oder wenn
 * kein gueltiges Segment uebrig bleibt (kein stiller Fallback).
 */
export function inboxUsernameFromEmail(userEmail: string): string {
  const normalized = userEmail.trim().toLowerCase();
  if (!normalized) throw new Error('inboxUsernameFromEmail: userEmail ist erforderlich');
  const safe = normalized.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe || safe === '.' || safe === '..') {
    throw new Error(`inboxUsernameFromEmail: kein gueltiger Username aus "${userEmail}"`);
  }
  return safe;
}

/**
 * Erstellt den Inbox-Provider (Typ `'inbox'`) fuer serverseitige Aufrufer.
 *
 * Ablauf (analog `getServerProvider`):
 * 1. Library owner-unabhaengig laden (nur fuer die Inbox-/Azure-Konfiguration).
 * 2. Factory in Server-Kontext versetzen und mit Typ `'inbox'` registrieren.
 * 3. Provider frisch erstellen (clearProvider) und Konfiguration validieren.
 */
export async function getInboxProvider(
  userEmail: string,
  libraryId: string,
): Promise<StorageProvider> {
  if (!userEmail) throw new Error('getInboxProvider: userEmail ist erforderlich');
  if (!libraryId) throw new Error('getInboxProvider: libraryId ist erforderlich');

  const lib = await LibraryService.getInstance().getLibraryById(libraryId);
  if (!lib) throw new Error(`getInboxProvider: Library nicht gefunden: ${libraryId}`);

  const factory = StorageFactory.getInstance();
  // Server-Kontext: Der Inbox-Provider ist ausschliesslich serverseitig verfuegbar
  // (kein Client-Proxy) — sonst wirft die Factory beim Typ 'inbox'.
  factory.setServerContext(true);
  factory.setUserEmail(userEmail);
  // Provider-Typ 'inbox' (ADR-0004 II): Inbox-Bereich der Library, NICHT das Archiv.
  factory.setLibraries([{
    id: lib.id,
    label: lib.label,
    type: 'inbox',
    path: lib.path,
    isEnabled: lib.isEnabled,
    config: (lib.config as unknown as Record<string, unknown>) || {},
  }]);
  // Frischen Provider erzwingen: aktuelle Config, kein Typ-Cross-Talk mit dem
  // gecachten Archiv-Provider derselben libraryId.
  await factory.clearProvider(lib.id);
  const provider = await factory.getProvider(lib.id);

  const validation = await provider.validateConfiguration();
  if (!validation.isValid) {
    throw new Error(validation.error || 'Inbox-Provider ist nicht gueltig konfiguriert');
  }
  return provider;
}
