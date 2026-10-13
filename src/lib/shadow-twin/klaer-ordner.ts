/**
 * @fileoverview Name des Klaer-Ordners (C4) — eine Konstante fuer alle Wege.
 *
 * @description
 * `quelle_verwerfen` und `familie_uebergeben` (herkunft: verwerfen) schieben
 * Quellen samt Familie dorthin; nichts wird geloescht. Eigenes Modul, damit
 * reine Module den Namen kennen, ohne `moveFamily` mitzuladen.
 *
 * @module shadow-twin
 */

/** Bewusst deutsch und sichtbar, kein .trash. */
export const KLAER_ORDNER = 'zu klären'
