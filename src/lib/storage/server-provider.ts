/**
 * @fileoverview Server Provider Helper - Server-side Storage Provider Creation
 *
 * @description
 * Helper function for creating storage providers in server-side contexts (API routes).
 * Handles library loading, factory configuration, and provider validation. Ensures
 * proper user email and base URL configuration for server-to-server operations.
 *
 * Bei `library.type === 'local'` wird zusaetzlich aufgeloest, ob der aufrufende
 * User Owner oder Co-Creator ist:
 * - Owner verwendet `library.path` und schreibt (idempotent) den Identitaets-
 *   Marker (`.knowledgescout/library.json`).
 * - Co-Creator MUSS einen `localPathOverride` in seiner Mitgliedschaft haben;
 *   der Marker wird gelesen und gegen die `libraryId` validiert.
 *
 * Siehe docs/per-user-storage-path-analyse.md (Variante A).
 *
 * @module storage
 *
 * @exports
 * - getServerProvider: Creates and validates a storage provider for server-side use
 *
 * @usedIn
 * - src/app/api: API routes use this helper for server-side storage access
 * - src/lib/external-jobs: External jobs use server providers
 *
 * @dependencies
 * - @/lib/storage/storage-factory: Storage provider factory
 * - @/lib/services/library-service: Library service for loading libraries
 * - @/lib/storage/library-identity: Identity-Marker fuer geteilte local-Libraries
 * - @/lib/env: Environment helpers for base URL
 */

import { StorageFactory } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/types';
import { LibraryService } from '@/lib/services/library-service';
import { getSelfBaseUrl } from '../env'
import { isCoCreatorOrOwner, getMember } from '@/lib/repositories/library-members-repo';
import {
  describeValidationFailure,
  validateIdentityMarker,
  writeIdentityMarker,
} from '@/lib/storage/library-identity';
import type { Library } from '@/types/library';

/**
 * Erstellt einen Storage-Provider fuer serverseitige API-Routen.
 *
 * Ablauf:
 * 1. Zuerst in eigenen Libraries des Users suchen
 * 2. Falls nicht gefunden: Library owner-unabhaengig laden und Co-Creator-Rolle pruefen
 *    (ermoeglicht kollaboratives Arbeiten auf derselben libraryId)
 * 3. Bei `library.type === 'local'`: effektiven Pfad bestimmen (Owner: lib.path,
 *    Co-Creator: member.localPathOverride) und Identitaets-Marker pruefen
 *    bzw. schreiben
 */
export async function getServerProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const baseUrl = getSelfBaseUrl();
  const libraryService = LibraryService.getInstance();

  // 1) Eigene Libraries pruefen (Standard-Fall)
  let lib: Library | null = null;
  let isOwner = false;
  const ownLibraries = await libraryService.getUserLibraries(userEmail);
  const ownLib = ownLibraries.find(l => l.id === libraryId) || null;
  if (ownLib) {
    lib = ownLib;
    isOwner = true;
  }

  // 2) Fallback: Library owner-unabhaengig laden + Co-Creator-Berechtigung pruefen
  if (!lib) {
    lib = await libraryService.getLibraryById(libraryId);
    if (!lib) {
      throw new Error('Library nicht gefunden');
    }

    const hasAccess = await isCoCreatorOrOwner(libraryId, userEmail);
    if (!hasAccess) {
      throw new Error('Keine Berechtigung fuer diese Library');
    }
  }

  // 3) Effektiven Pfad bestimmen + Identitaets-Marker handhaben.
  // Nur fuer lokale Libraries relevant; remote Backends (OneDrive, Nextcloud, GDrive)
  // sind user-unabhaengig erreichbar und brauchen weder Override noch Marker.
  const effectivePath = lib.type === 'local'
    ? await resolveLocalPathAndEnsureMarker({ lib, userEmail, isOwner })
    : lib.path;

  const factory = StorageFactory.getInstance();
  factory.setApiBaseUrl(baseUrl);
  factory.setUserEmail(userEmail);
  // Server-Kontext aktivieren: Erstellt direkte Provider (z.B. WebDAV)
  // statt HTTP-Proxies, die eine Clerk-Session benoetigen wuerden.
  factory.setServerContext(true);
  factory.setLibraries([{
    id: lib.id,
    label: lib.label,
    type: lib.type,
    // Effektiver Pfad: Owner-Pfad oder Co-Creator-Override (siehe oben).
    path: effectivePath,
    isEnabled: lib.isEnabled,
    config: (lib.config as unknown as Record<string, unknown>) || {}
  }]);

  // Cache leeren, damit ein frischer Provider mit aktuellen DB-Credentials erstellt wird.
  // Ohne dies wuerde ein gecachter Provider mit veralteten Zugangsdaten zurueckgegeben,
  // weil setLibraries den Cache nur bei geaenderten IDs leert (nicht bei Config-Aenderungen).
  await factory.clearProvider(lib.id);

  const provider = await factory.getProvider(lib.id);

  // Stelle sicher, dass userEmail im Provider gesetzt ist (fuer Token-Loading)
  if ('setUserEmail' in provider && typeof provider.setUserEmail === 'function') {
    (provider as unknown as { setUserEmail?: (e: string) => void }).setUserEmail?.(userEmail);
  }

  const validation = await provider.validateConfiguration();
  if (!validation.isValid) throw new Error(validation.error || 'Ungueltige Provider-Konfiguration');
  return provider;
}

/**
 * Bestimmt den effektiven lokalen Pfad fuer den aktuellen User und stellt
 * sicher, dass der Identitaets-Marker korrekt ist.
 *
 * Owner:
 *  - Pfad = `lib.path`
 *  - Marker wird idempotent geschrieben, falls noch nicht vorhanden
 *  - Wenn Verzeichnis bereits einen Marker einer ANDEREN Library enthaelt:
 *    Hard-Fail (verhindert versehentliches Ueberschreiben)
 *
 * Co-Creator:
 *  - Pfad = `member.localPathOverride` (Pflichtfeld bei `local`-Libraries)
 *  - Marker wird gelesen und gegen `lib.id` validiert; Mismatch ist Hard-Fail
 *
 * Beide Faelle laufen serverseitig (Node fs), daher direkter Datei-Zugriff.
 */
async function resolveLocalPathAndEnsureMarker(args: {
  lib: Library;
  userEmail: string;
  isOwner: boolean;
}): Promise<string> {
  const { lib, userEmail, isOwner } = args;

  if (isOwner) {
    if (!lib.path || lib.path.trim().length === 0) {
      throw new Error('Library hat keinen Speicherpfad konfiguriert.');
    }

    // Owner-Email zum Anreichern des Markers ermitteln (informativ, nicht
    // sicherheitsrelevant). Bei mehreren MongoDB-Eintraegen mit derselben
    // Library-ID gibt findOwnerEmailForLibraryId den ersten Treffer zurueck.
    const libraryService = LibraryService.getInstance();
    const ownerEmail = (await libraryService.findOwnerEmailForLibraryId(lib.id)) ?? userEmail;

    // Idempotent: Wenn Marker existiert und passt, passiert nichts; bei
    // Mismatch wirft writeIdentityMarker mit klarem Fehlertext.
    await writeIdentityMarker(lib.path, {
      libraryId: lib.id,
      label: lib.label,
      ownerEmail,
    });
    return lib.path;
  }

  // Co-Creator: Override laden (Pflichtfeld bei local).
  const member = await getMember(lib.id, userEmail);
  const override = member?.localPathOverride?.trim();
  if (!override) {
    throw new Error(
      'Fuer diese geteilte Library ist kein lokaler Pfad konfiguriert. ' +
      'Bitte den Owner um eine neue Einladung bitten und im Annahme-Dialog ' +
      'das lokale Sync-Verzeichnis auswaehlen.'
    );
  }

  const result = await validateIdentityMarker(override, lib.id);
  if (!result.ok) {
    // Hard-Fail laut Architektur-Entscheidung: keine Soft-Warnung.
    throw new Error(describeValidationFailure(result));
  }
  return override;
}
