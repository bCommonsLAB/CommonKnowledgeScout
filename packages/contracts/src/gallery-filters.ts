/**
 * @fileoverview Galerie-Filter — welche Facetten sind gerade eingeschraenkt
 *
 * @description
 * Eine Zuordnung von Facetten-Schluessel zu ausgewaehlten Werten, zum Beispiel
 * `{ jahr: ['2024'], track: ['energie', 'mobilitaet'] }`.
 *
 * **Warum hier**: Der Begriff gehoert beiden Seiten. Die Galerie setzt die
 * Filter, der Chat schraenkt seine Suche damit ein — und schreibt sie in
 * Cache-Schluessel und Abfrage-Protokolle. Er lag bei der Galerie
 * (`src/atoms/gallery-filters.ts`), weshalb vierzehn Chat-Stellen dorthin
 * zeigten (Audit `01-audit-galerie-chat.md`, Befund 3).
 *
 * Nur der Typ liegt hier. Das Jotai-Atom bleibt in der App — das Paket
 * beschreibt, es haelt keinen Zustand.
 *
 * @module contracts/gallery-filters
 */

/**
 * Aktive Facetten-Einschraenkungen: Facetten-Schluessel → gewaehlte Werte.
 *
 * Ein fehlender Schluessel bedeutet „nicht eingeschraenkt", ein leeres Array
 * ebenso.
 */
export type GalleryFilters = Record<string, string[]>
