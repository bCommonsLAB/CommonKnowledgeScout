/**
 * `@ks/embed` — Galerie, Story-Modus und (WE4) die Startseite einer
 * oeffentlichen KnowledgeScout-Library als Komponenten fuer fremde React- und
 * Next-Anwendungen (M5, AECED).
 *
 * Stile nicht vergessen: `import '@ks/embed/styles.css'`. Alle Regeln liegen
 * unter dem Rahmen `.ks-embed` und wirken nicht auf die uebrige Seite.
 */

export { KnowledgeScoutExplorer } from './knowledge-scout-explorer'
export { KnowledgeScoutSite } from './knowledge-scout-site'
export { ksZielAlsParameter, ksEinstiegAusParametern, ksSeiteAusParametern } from './ziel-parameter'
export type {
  KnowledgeScoutExplorerProps,
  KnowledgeScoutSiteProps,
  KnowledgeScoutLocale,
  KsZiel,
  KsEinstieg,
  KsGalerieListe,
  KsAdressParameter,
} from './typen'
