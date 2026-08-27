/**
 * `@ks/module-explorer` — Explorer-Modul (Galerie, Story, Chat/RAG, Website).
 *
 * Stand Welle M4: Das Paket besitzt bisher NUR seinen API-Namensraum und das
 * Site-Gate. Die montierbare Wurzelkomponente aus Landkarte §5 (Zeile M4)
 * fehlt noch — sie braucht `@ks/ui` und `@ks/i18n` (Begruendung und Messwerte:
 * `docs/refactor/modularisierung/AGENT-BRIEF-M4.md`).
 */

export { explorerGate, EXPLORER_MODULE } from './api/gate'
export {
  EXPLORER_API_PREFIXES,
  EXPLORER_API_EXCLUSIONS,
  classifyExplorerApiRoute,
} from './api/namespaces'
export type { ExplorerApiExclusion, ExplorerRouteVerdict } from './api/namespaces'
