/**
 * Die Galerie — seit Welle M4i im Paket (`git mv` aus
 * `src/components/library/gallery`, `src/hooks/gallery`, `src/lib/gallery`,
 * drei Kontexten und drei Atomen; `git log --follow` haelt).
 *
 * Dieses Barrel ist die oeffentliche Oberflaeche der Galerie. Es wird ueber
 * `@ks/module-explorer/react` ausgeliefert — dort, weil hier React drin ist
 * (Wurzel-Barrel bleibt React-frei, siehe `../index.ts`).
 *
 * Was hier steht, braucht die Voll-App an ihren Montagepunkten: die
 * Wurzelkomponente, die Karte (Landingpage, Teaser), die drei Kontexte mit
 * ihren Anbietern und Defaults, zwei Atome, die der Chat mitliest, und die
 * Regeln, die die App-Bruecken anwenden. Alles andere ist Paket-intern.
 */

export { GalleryRoot, type GalleryRootProps } from './components/gallery-root'
export { DocumentCard } from './components/document-card'
export type { DetailRenderer, DetailRenderProps } from './components/detail-overlay'

// Bausteine, die die Klimamassnahmen-Detailansicht der App wiederverwendet
// (`climate-action-detail.tsx`): SDG-Profil, Stakeholder-Positionen und die
// Herkunfts-Auszeichnung von Text (KI gegen Original-Zitat).
export { SdgProfile } from './components/sdg-profile'
export { StakeholderPositions } from './components/stakeholder-positions'
export { AiText, OriginalQuote } from './components/provenance-text'

// Die Buch-Detailansicht (M5): im Paket, weil das Embed Buecher zeigt. Bilder,
// Markdown, KI-Hinweis und Zurueck-Link kommen herein — die App reicht ihre
// Next-Varianten unter den alten Pfaden herein, das Embed schlichte.
export { BookDetail, type BookDetailProps, type BookMarkdownProps } from './components/book-detail/book-detail'
export { AttachmentList } from './components/book-detail/attachment-list'
export { AIGeneratedNotice, type HinweisLinkProps } from './components/book-detail/ai-generated-notice'
export { MarkdownBody } from './components/book-detail/markdown-body'
export { BuchDetailRenderer } from './components/book-detail/book-detail-renderer'
export { EMBED_DETAIL_RENDERERS } from './components/embed-detail-renderers'

export {
  GalleryViewerProvider,
  useGalleryViewer,
  ANONYMOUS_VIEWER,
  type GalleryViewer,
} from './contexts/gallery-viewer-context'
export {
  GalleryNavigationProvider,
  useGalleryNavigation,
  type GalleryNavigation,
} from './contexts/gallery-navigation-context'
// Embed (M5): Adressierung im Speicher und das Anbieter-Buendel, Gegenstueck
// zu NextGalleryNavigation und GalleryAppProviders in der App.
export {
  SpeicherGalleryNavigation,
  type SpeicherGalleryNavigationProps,
} from './contexts/speicher-gallery-navigation'
export { EmbedGalleryProviders, type EmbedGalleryProvidersProps } from './contexts/embed-gallery-providers'
export {
  GalleryHostProvider,
  useGalleryHost,
  STILLER_GASTGEBER,
  SchlichtesBild,
  type GalleryHost,
  type GalleryImageProps,
} from './contexts/gallery-host-context'

export { galleryFiltersAtom } from './atoms/gallery-filters'
export { chatReferencesAtom } from './atoms/chat-references-atom'

export { useGalleryData } from './hooks/use-gallery-data'
export { useLibraryRole, type LibraryRoleClient, type UseLibraryRoleResult } from './hooks/use-library-role'

export { readGalleryMode, nextParamsForMode, type GalleryMode } from './lib/mode-params'
export { normalizeGalleryCardDensity, type GalleryCardDensity } from './lib/gallery-card-density'
export { mapItemToDocCardMeta, type GalleryItem } from './lib/types'
