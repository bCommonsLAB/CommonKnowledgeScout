/**
 * `@ks/util` — Helfer ohne Fachlogik und ohne React.
 *
 * Entstanden aus einem Build-Fehler in M4b: `cn` lag in `@ks/ui`, und weil
 * `src/lib/utils.ts` es von dort re-exportierte, zog jedes Server-Modul, das
 * `cn` braucht, den GESAMTEN UI-Graph in den react-server-Layer. Korrekte
 * Client-Grenzen haben das behoben, aber die Ursache blieb: Eine reine
 * Funktion darf nicht an einem Paket voller Client-Komponenten haengen.
 *
 * Regel fuer dieses Paket: nur, was in JEDER Umgebung laufen kann — Server,
 * Client, Edge. Kein React, kein Storage, keine Abhaengigkeiten.
 *
 * Zu "keine Fachlogik" (Stand 2026-08-30, Owner-Klarstellung): Gemeint ist
 * KUNDEN- oder BIBLIOTHEKS-spezifisches Wissen — das gehoert nicht hierher.
 * OEFFENTLICHE Standards dagegen schon: Die 17 UN-Nachhaltigkeitsziele sind
 * so wenig KnowledgeScout-Fachlogik wie eine Liste von Laendercodes.
 *
 * Die Grenze laeuft an einem konkreten Beispiel entlang: `sdg-meta` liegt hier
 * (oeffentlicher Standard, arbeitet auf einem schlichten Record).
 * `stakeholder-meta` liegt es NICHT (enthaelt die Suedtiroler
 * Landesverwaltung — ein Kunde, kein Standard).
 */

export { cn } from './cn'

// Reine Formatierer ohne Umgebungsbezug — sie erfuellen die Regel oben und
// werden von Galerie, Archiv und Job-Ansicht gleichermassen gebraucht.
export { formatUpsertedAt } from './format-upserted-at'
export { tryDecodeRelativePathFromFileId } from './decode-storage-file-id'

// Pfad-Zerlegung fuer Shadow-Twin-Ordner: reine Zeichenketten-Arbeit, ohne
// Storage-Zugriff — und von zwoelf Stellen quer durch App und Galerie genutzt.
export * from './shadow-twin-folder-name'

// Die 17 UN-Nachhaltigkeitsziele samt Auslesehilfen. Oeffentlicher Standard,
// null Abhaengigkeiten, arbeitet auf `Record<string, unknown>` — siehe die
// Abgrenzung im Kopf dieser Datei.
export * from './sdg-meta'
