/**
 * `@ks/module-explorer/react` — die montierbare Wurzelkomponente.
 *
 * BEWUSST ein eigener Einstiegspunkt, nicht das Wurzel-Barrel: Dort holen sich
 * 22 API-Routen `explorerGate` — laege React daneben, zoege jede von ihnen
 * Client-Code in den react-server-Layer. Das ist der Build-Fehler aus M4b,
 * und er ist der Grund fuer den Subpfad (wie bei `@ks/i18n/react` und
 * `@ks/shell/react`).
 */

export { ExplorerRoot } from './explorer-root'
export { toClientLibrary } from './to-client-library'
export { fetchAccessStatus, postAccessRequest } from './explorer-access'
export type {
  ExplorerRootProps,
  ExplorerViewer,
  ExplorerLibraryPayload,
  ExplorerContext,
  ExplorerAccessStatus,
} from './types'

// Die Galerie (Welle M4i). Ihre oeffentliche Oberflaeche steht in
// `../gallery/index.ts`; hier nur durchgereicht, damit es einen Einstieg gibt.
export {
  GalleryRoot,
  DocumentCard,
  SdgProfile,
  StakeholderPositions,
  AiText,
  OriginalQuote,
  GalleryViewerProvider,
  useGalleryViewer,
  ANONYMOUS_VIEWER,
  GalleryNavigationProvider,
  useGalleryNavigation,
  SpeicherGalleryNavigation,
  EmbedGalleryProviders,
  GalleryHostProvider,
  useGalleryHost,
  STILLER_GASTGEBER,
  SchlichtesBild,
  galleryFiltersAtom,
  chatReferencesAtom,
  useGalleryData,
  useLibraryRole,
  readGalleryMode,
  nextParamsForMode,
  normalizeGalleryCardDensity,
  mapItemToDocCardMeta,
} from '../gallery'
export type {
  GalleryRootProps,
  DetailRenderer,
  DetailRenderProps,
  GalleryViewer,
  GalleryNavigation,
  SpeicherGalleryNavigationProps,
  EmbedGalleryProvidersProps,
  GalleryHost,
  GalleryImageProps,
  LibraryRoleClient,
  UseLibraryRoleResult,
  GalleryMode,
  GalleryCardDensity,
  GalleryItem,
} from '../gallery'
