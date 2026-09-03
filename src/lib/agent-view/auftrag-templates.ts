/**
 * @fileoverview Auftrags-Vorlagen je Gap-Typ (Welle 3, Projektauftrag F3).
 *
 * @description
 * Pro Luecke EINE Aufgabenzeile fuer den Cowork-Auftrag. Vollstaendiges
 * `Record` ueber alle Gap-Typen: ein neuer Typ ohne Vorlage ist ein
 * Typfehler, kein stiller Leertext (`no-silent-fallbacks.mdc`). Vorlagen
 * fuer KS-/Mensch-Typen existieren trotzdem — Peter kann jeden Befund in
 * einen Auftrag aufnehmen, die Zeile benennt dann das richtige Werkzeug.
 *
 * Reine Funktionen; die Pfad-Darstellung liefert der Generator.
 *
 * @module agent-view
 */

import type { CoverageGap, CoverageGapType } from './types'

/** Baut die Aufgabenzeile fuer EINEN Befund; `pfad` ist bereits gerendert. */
export type AuftragTemplate = (gap: CoverageGap, pfad: string) => string

const detail = (gap: CoverageGap): string => (gap.detail ? ` (${gap.detail})` : '')

export const AUFTRAG_TEMPLATES: Record<CoverageGapType, AuftragTemplate> = {
  // — Cowork-Aufgaben (Kern des Generators) —
  report_missing: (gap, pfad) =>
    `Schreibe einen BERICHT.md fuer das Vorhaben ${pfad} auf Twin-Basis: zitiere die Transformationen, verweise als echte Links, Chronologie aus den Datums-Feldern, Unklares als offene Punkte.`,
  index_missing: (gap, pfad) =>
    `Lege einen _INDEX.md in ${pfad} an (flaches Frontmatter, inkl. bearbeitungsstand + bearbeitungsstand_seit) und beschreibe kurz, was der Ordner enthaelt.`,
  bericht_veraltet: (gap, pfad) =>
    `Aktualisiere ${pfad}: der Bericht ist aelter als die juengste Aenderung seines Vorhabens${detail(gap)}. Arbeite die neuen/geaenderten Twins ein.`,
  verweis_tot: (gap, pfad) =>
    `Repariere in ${pfad} den toten Verweis: ${gap.message}${detail(gap)}. Ziel korrigieren oder den Verweis entfernen und im Text vermerken.`,
  verweis_veraltet: (gap, pfad) =>
    `Pruefe in ${pfad} den veralteten Verweis: ${gap.message}${detail(gap)}. Lies das juengere Ziel und aktualisiere die betreffende Passage.`,
  bericht_unvollstaendig: (gap, pfad) =>
    `Ergaenze in ${pfad} die unerwaehnten erschlossenen Quellen${detail(gap)} — mindestens je ein Satz mit Verweis auf die Transformation.`,
  korrektur_offen: (gap, pfad) =>
    `Arbeite Peters Korrekturauftrag zu ${pfad} ab${detail(gap)}. Erst einordnen/umbenennen (familie_umziehen), dann bei Bedarf neu erschliessen — den Korrekturhinweis fuer die Transformation formulierst du selbst aus dem Auftrag, der Auftragstext gehoert nicht roh in den Prompt. Zog die Familie ueber eine Vorhabensgrenze, danach BEIDE Ordner scannen (Quell- und Zielordner), damit Bericht-Nachzug und tote Verweise auffallen.`,
  path_too_long: (gap, pfad) =>
    `Kuerze den Pfad ${pfad}${detail(gap)} — Quellname beim Strukturieren verkuerzen (familie_umziehen bzw. Quelle und _-Ordner gemeinsam bewegen, danach Pruefen).`,

  // — KnowledgeScout-Aufgaben (verweisen auf die vorhandenen Werkzeuge) —
  source_without_twin: (gap, pfad) =>
    `KnowledgeScout: Quelle ${pfad} ueber die Pipeline erschliessen (Transkript + Transformation).`,
  orphan_twin: (gap, pfad) =>
    `KnowledgeScout: verwaisten Twin ${pfad} klaeren${detail(gap)} — Quelle wiederherstellen/umziehen oder Twin bewusst entfernen (Pruefen/Reparieren).`,
  conflict: (gap, pfad) =>
    `KnowledgeScout: Konflikt an ${pfad} aufloesen${detail(gap)} — Pruefen/Reparieren zeigt beide Fassungen.`,
  twin_stale: (gap, pfad) =>
    `KnowledgeScout: Quelle ${pfad} ist juenger als ihr Twin — Pipeline neu laufen lassen.`,
  legacy_twin_name: (gap, pfad) =>
    `KnowledgeScout: Alt-Namen an ${pfad} migrieren${detail(gap)} — Namens-Migration ueber Pruefen/Reparieren.`,
  transformation_missing: (gap, pfad) =>
    `KnowledgeScout: Transformation nach dem Standard-Template fuer ${pfad} erzeugen${detail(gap)}.`,
  transformation_stale: (gap, pfad) =>
    `KnowledgeScout: Transformation von ${pfad} neu erzeugen — das Transkript ist juenger${detail(gap)}.`,
  twin_core_missing: (gap, pfad) =>
    `KnowledgeScout: Twin-Kern-Felder von ${pfad} nachziehen${detail(gap)} — Reparatur/Export stempelt nach.`,
  core_fields_missing: (gap, pfad) =>
    `KnowledgeScout: A0-Pflichtfelder von ${pfad} ergaenzen${detail(gap)} — Library-Verifikation (Reparieren) bzw. Re-Transformation.`,

  quelle_verschwunden: (gap, pfad) =>
    `Mensch: Die Datenbank kennt ${pfad}${detail(gap)}, im Speicher liegt sie nicht mehr. ` +
    'Kein Job behebt das — entweder die Datei zurueckholen (dann greift der naechste Scan) ' +
    'oder die Familie mit quelle_verwerfen aufloesen. NICHT erneut erschliessen: Der Job ' +
    'scheitert am fehlenden Original.',

  // — Mensch-Aufgaben —
  twin_flagged: (gap, pfad) =>
    `Peter: Fehler-Markierung an ${pfad} aufloesen${detail(gap)} — reparieren (lassen) und danach verifizieren.`,
  twin_unverified: (_gap, pfad) =>
    `(Alter Scan) ${pfad} galt als ungeprueft — seit ADR 0006 keine Aufgabe mehr; der naechste Scan raeumt den Befund weg.`,
  self_verified: (gap, pfad) =>
    `Peter: Selbst-Verifikation an ${pfad} aufheben${detail(gap)} — ein anderer Akteur muss pruefen.`,
  stand_widerspruch: (gap, pfad) =>
    `Peter: erklaerten Stand von ${pfad} klaeren${detail(gap)} — bestaetigen (bearbeitungsstand_seit neu datieren) oder zurueckstufen, beides am _INDEX.md.`,

  // — Betrieb —
  teilbaum_ungesichtet: (gap, pfad) =>
    `Teilbaum ${pfad} ist als ungesichtet erklaert${detail(gap)} — erst sichten (Zyklus Schritt 1), dann einzeln bewerten.`,
  scan_error: (gap, pfad) =>
    `Scan-Problem an ${pfad} beheben: ${gap.message}${detail(gap)}.`,

  // — Archiv-Hygiene —
  datei_ohne_endung: (gap, pfad) =>
    `Peter: Datei ohne Endung ${pfad} pruefen${detail(gap)} — vermutlich abgeschnittener Sync-Rest: umbenennen (richtige Endung) oder loeschen.`,
}

/** Rendert die Aufgabenzeile fuer einen Befund. */
export function renderAuftragZeile(gap: CoverageGap, pfad: string): string {
  const template = AUFTRAG_TEMPLATES[gap.type]
  if (!template) throw new Error(`Keine Auftrags-Vorlage fuer Gap-Typ: ${String(gap.type)}`)
  return template(gap, pfad)
}
