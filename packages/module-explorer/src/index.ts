/**
 * `@ks/module-explorer` — Explorer-Modul (Galerie, Story, Chat/RAG, Website).
 *
 * Dieses Barrel haelt den serverseitigen Teil: API-Namensraum und Site-Gate.
 * Es ist BEWUSST frei von React — 22 API-Routen holen sich hier `explorerGate`,
 * und Client-Code daneben zoege jede von ihnen in den react-server-Layer (der
 * Build-Fehler aus M4b).
 *
 * Die montierbare Wurzelkomponente aus Landkarte §5 (Zeile M4) liegt unter
 * `@ks/module-explorer/react`. Die Galerie selbst liegt weiterhin in der
 * Anwendung und wird ihr als Slot hereingereicht — sie ist eine eigene Welle
 * (`docs/refactor/modularisierung/AGENT-BRIEF-M4.md`, Nachtrag).
 */

export { explorerGate, EXPLORER_MODULE } from './api/gate'
export {
  EXPLORER_API_PREFIXES,
  EXPLORER_API_EXCLUSIONS,
  classifyExplorerApiRoute,
} from './api/namespaces'
export type { ExplorerApiExclusion, ExplorerRouteVerdict } from './api/namespaces'

// Dokument-Metadaten in der Sprache des Betrachters (M4h aus
// `src/lib/i18n/get-localized.ts`): reine Nachschlage-Logik ueber den
// Uebersetzungs-Maps aus `@ks/contracts`, ohne React — Galerie, Detail-
// ansichten und der Doc-Meta-Formatter des Servers lesen sie hier.
export { getLocalized, getLocalizedLabel, getLocalizedTopics, localizeDocMetaJson } from './doc-meta/get-localized'
export type { TranslationScope, LocalizableDoc } from './doc-meta/get-localized'
