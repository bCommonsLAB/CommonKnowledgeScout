/**
 * `@ks/embed` — die Galerie einer oeffentlichen KnowledgeScout-Library als
 * Komponente fuer fremde React- und Next-Anwendungen (M5, AECED).
 *
 * Stile nicht vergessen: `import '@ks/embed/styles.css'`. Alle Regeln liegen
 * unter dem Rahmen `.ks-embed` und wirken nicht auf die uebrige Seite.
 */

export { KnowledgeScoutExplorer } from './knowledge-scout-explorer'
export { ksZielAlsParameter, ksEinstiegAusParametern, ksSeiteAusParametern } from './ziel-parameter'
export type {
  KnowledgeScoutExplorerProps,
  KnowledgeScoutLocale,
  KsZiel,
  KsEinstieg,
  KsGalerieListe,
  KsAdressParameter,
} from './typen'
