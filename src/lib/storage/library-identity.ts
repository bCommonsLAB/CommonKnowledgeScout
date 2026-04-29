/**
 * @fileoverview Library Identity Marker
 *
 * @description
 * Schreibt/liest/validiert eine kleine Kennungs-Datei im Library-Root, damit
 * mehrere User mit unterschiedlichen lokalen Sync-Pfaden sicher auf dieselbe
 * geteilte Library zugreifen koennen (z.B. SharePoint Sync, OneDrive Sync,
 * Nextcloud Sync). Owner und Co-Creator validieren beim Verbinden, dass das
 * Verzeichnis wirklich zu dieser Library gehoert.
 *
 * Strukturentscheidung (siehe docs/per-user-storage-path-analyse.md, M2):
 *   <libraryRoot>/.knowledgescout/library.json
 *
 * Beispielinhalt:
 *   {
 *     "schemaVersion": 1,
 *     "libraryId": "lib_abc123",
 *     "label": "DIVA Catalog (Teams & Externe)",
 *     "ownerEmail": "owner@example.com",
 *     "createdAt": "2026-04-28T17:00:00.000Z"
 *   }
 *
 * @module storage
 */

import { promises as fs } from 'node:fs';
import * as pathLib from 'node:path';

/**
 * Verzeichnisname unter dem Library-Root, in dem die Marker-Dateien liegen.
 * Der Punkt am Anfang macht es zu einem versteckten Verzeichnis (auf Unix-
 * Systemen). Empirisch geprueft: SharePoint Sync synchronisiert versteckte
 * Verzeichnisse mit; gleiches gilt fuer OneDrive Sync und Nextcloud Sync.
 */
export const IDENTITY_DIR_NAME = '.knowledgescout';

/**
 * Dateiname der Hauptkennung im Identity-Verzeichnis.
 * Bewusst eine eigene Datei (nicht direkt im Root), damit wir bei Bedarf
 * weitere Marker-Dateien (z.B. members.json, schema-version.json) ergaenzen
 * koennen, ohne die Schnittstelle zu brechen.
 */
export const IDENTITY_FILE_NAME = 'library.json';

/**
 * Aktuelles Schema der Marker-Datei. Wird mit jeder breaking change am
 * IdentityMarker-Format inkrementiert. Lese-Code muss ggf. migrieren.
 */
export const IDENTITY_SCHEMA_VERSION = 1 as const;

/**
 * Inhalt der Identity-Marker-Datei.
 * `label` und `ownerEmail` sind nur informativ (Debugging / "wem gehoert
 * dieses Verzeichnis"); validiert wird ausschliesslich `libraryId`.
 */
export interface IdentityMarker {
  schemaVersion: typeof IDENTITY_SCHEMA_VERSION;
  libraryId: string;
  label: string;
  ownerEmail: string;
  createdAt: string;
}

/**
 * Ergebnis der Marker-Validierung.
 * Hard-Fail-Modell laut Architektur-Entscheidung: Aufrufer behandelt
 * `ok: false` als blockierenden Fehler (siehe no-silent-fallbacks.mdc).
 */
export type IdentityValidationResult =
  | { ok: true; marker: IdentityMarker }
  | { ok: false; reason: 'missing'; rootPath: string }
  | { ok: false; reason: 'unreadable'; rootPath: string; error: string }
  | { ok: false; reason: 'mismatch'; rootPath: string; expectedLibraryId: string; actualLibraryId: string }
  | { ok: false; reason: 'invalid-schema'; rootPath: string; details: string };

/** Vollstaendiger Pfad zur Marker-Datei innerhalb eines Library-Roots. */
function getMarkerFilePath(rootPath: string): string {
  return pathLib.join(rootPath, IDENTITY_DIR_NAME, IDENTITY_FILE_NAME);
}

/**
 * Liest den Identity-Marker aus dem Library-Root.
 * Gibt `null` zurueck, wenn die Datei nicht existiert. Bei Lese-/Parse-
 * Fehlern wird ein Error mit Kontext geworfen — nie still ein leerer Wert.
 */
export async function readIdentityMarker(rootPath: string): Promise<IdentityMarker | null> {
  const filePath = getMarkerFilePath(rootPath);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    // ENOENT ist der einzige bewusst geschluckte Fehler: die Datei darf
    // legitim fehlen (z.B. Owner hat sie noch nicht angelegt). Alle anderen
    // I/O-Fehler werden mit Kontext nach oben gereicht.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw new Error(
      `Identity-Marker konnte nicht gelesen werden (${filePath}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Identity-Marker enthaelt kein gueltiges JSON (${filePath}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!isIdentityMarker(parsed)) {
    throw new Error(`Identity-Marker hat ein ungueltiges Schema (${filePath}).`);
  }
  return parsed;
}

/**
 * Schreibt den Identity-Marker idempotent in den Library-Root.
 * Erstellt das `.knowledgescout`-Verzeichnis, falls es noch nicht existiert.
 *
 * Wenn bereits eine Marker-Datei existiert mit ABWEICHENDER libraryId, wird
 * NICHT ueberschrieben, sondern ein Fehler geworfen. Damit verhindern wir,
 * dass ein Owner versehentlich auf ein fremdes Library-Verzeichnis zeigt
 * und dieses ueberschreibt.
 */
export async function writeIdentityMarker(
  rootPath: string,
  marker: Omit<IdentityMarker, 'schemaVersion' | 'createdAt'> & { createdAt?: string }
): Promise<IdentityMarker> {
  const dirPath = pathLib.join(rootPath, IDENTITY_DIR_NAME);
  const filePath = getMarkerFilePath(rootPath);

  const existing = await readIdentityMarker(rootPath);
  if (existing && existing.libraryId !== marker.libraryId) {
    throw new Error(
      `Verzeichnis ist bereits einer anderen Library zugeordnet ` +
        `(gefunden: ${existing.libraryId} "${existing.label}", erwartet: ${marker.libraryId}).`
    );
  }
  if (existing && existing.libraryId === marker.libraryId) {
    // Idempotent: nichts zu tun. Marker bleibt unveraendert (insbesondere
    // bleibt `createdAt` der ursprueglichen Erstellung erhalten).
    return existing;
  }

  await fs.mkdir(dirPath, { recursive: true });

  const fullMarker: IdentityMarker = {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    libraryId: marker.libraryId,
    label: marker.label,
    ownerEmail: marker.ownerEmail,
    createdAt: marker.createdAt ?? new Date().toISOString(),
  };

  // Pretty-printed JSON, damit ein Mensch im Sync-Verzeichnis sofort sieht,
  // was der Inhalt ist. Die paar Bytes Overhead sind irrelevant.
  await fs.writeFile(filePath, JSON.stringify(fullMarker, null, 2), 'utf8');
  return fullMarker;
}

/**
 * Validiert den Marker gegen eine erwartete `libraryId`. Strukturierter
 * Rueckgabewert (statt throw), damit der Aufrufer kontextspezifische
 * Fehlermeldungen bauen kann (z.B. UI vs. API).
 */
export async function validateIdentityMarker(
  rootPath: string,
  expectedLibraryId: string
): Promise<IdentityValidationResult> {
  let marker: IdentityMarker | null;
  try {
    marker = await readIdentityMarker(rootPath);
  } catch (err) {
    return {
      ok: false,
      reason: 'unreadable',
      rootPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!marker) {
    return { ok: false, reason: 'missing', rootPath };
  }

  if (marker.schemaVersion !== IDENTITY_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'invalid-schema',
      rootPath,
      details: `Unbekannte schemaVersion: ${marker.schemaVersion}`,
    };
  }

  if (marker.libraryId !== expectedLibraryId) {
    return {
      ok: false,
      reason: 'mismatch',
      rootPath,
      expectedLibraryId,
      actualLibraryId: marker.libraryId,
    };
  }

  return { ok: true, marker };
}

/**
 * Liefert eine menschenlesbare Fehlermeldung fuer ein negatives
 * Validierungsergebnis. Wird sowohl im Server-Provider als auch in der
 * Invite-API verwendet, damit die Texte konsistent sind.
 */
export function describeValidationFailure(result: IdentityValidationResult): string {
  if (result.ok) return '';
  switch (result.reason) {
    case 'missing':
      return (
        `Im gewaehlten Verzeichnis (${result.rootPath}) wurde keine ` +
        `Library-Kennung gefunden (${IDENTITY_DIR_NAME}/${IDENTITY_FILE_NAME}). ` +
        `Bitte den Owner bitten, das Verzeichnis vorzubereiten (z.B. einmal ` +
        `"Storage testen" in den Library-Einstellungen klicken).`
      );
    case 'unreadable':
      return (
        `Identity-Marker konnte nicht gelesen werden (${result.rootPath}): ${result.error}`
      );
    case 'mismatch':
      return (
        `Das gewaehlte Verzeichnis (${result.rootPath}) gehoert zu einer ` +
        `anderen Library (${result.actualLibraryId}). Erwartet: ${result.expectedLibraryId}.`
      );
    case 'invalid-schema':
      return (
        `Identity-Marker im Verzeichnis (${result.rootPath}) hat ein ` +
        `unbekanntes Schema: ${result.details}.`
      );
  }
}

/** Type-Guard fuer geparste Marker-Daten. */
function isIdentityMarker(value: unknown): value is IdentityMarker {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.libraryId === 'string' &&
    v.libraryId.length > 0 &&
    typeof v.label === 'string' &&
    typeof v.ownerEmail === 'string' &&
    typeof v.createdAt === 'string'
  );
}
