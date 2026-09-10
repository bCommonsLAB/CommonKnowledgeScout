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

// Die Buch-Detailansicht in Daten (M5): Vertrag und Mapper aus der
// doc-meta-Antwort, ohne React. Die App re-exportiert den Mapper in
// `src/lib/mappers/doc-meta-mappers.ts`; der Server uebersetzt damit.
export { mapToBookDetail } from './doc-meta/book-detail-mapper'
export type { BookDetailData, Chapter } from './doc-meta/book-detail-mapper'
