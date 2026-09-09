export type {
  StorageItemMetadata,
  StorageItem,
  StorageValidationResult,
  StorageProvider,
} from './storage-provider'
export {
  StorageError,
  SPEICHER_NICHT_VERBUNDEN,
  istAnmeldungNoetig,
} from './storage-provider'

export type {
  StorageUpdateOptions,
  StorageUpdateResult,
  StorageVersioning,
} from './storage-versioning'
export {
  StorageVersionConflictError,
  isVersionConflict,
  supportsVersioning,
} from './storage-versioning'

export type { StorageCapabilityInfo, StorageCapabilities } from './storage-capabilities'
export { supportsCapabilities } from './storage-capabilities'

export type { LlmModelDto } from './llm-model'
export type { UserInfoDto, UserInfoEmailDto } from './user-info'

export type {
  StorageProviderType,
  TranslationsConfig,
  CaptureWizardRef,
  CaptureWizardsConfig,
} from './library-config'
export type { GalleryGraphConfig, LibraryChatConfig } from './library-chat'
export type { ClientLibrary } from './library-client'
export type { LibraryProfile } from './library-profile'

export type {
  TargetLanguage,
  Character,
  SocialContext,
  AccessPerspective,
} from './chat-vocabulary'
export { SOCIAL_CONTEXT_VALUES } from './chat-vocabulary'

export type { DetailViewType } from './detail-view-type'
export { DETAIL_VIEW_TYPES, isDetailViewType } from './detail-view-type'

// Die Konfiguration je Renderer-Typ (M4h aus `src/lib/detail-view-types/registry.ts`).
// Ohne das zod-Schema — das bleibt in der App, das Paket kennt kein zod.
export type {
  ViewTypeMediaConfig,
  TranslatableScope,
  TranslatableFieldSpec,
  TranslatableChaptersSpec,
  TranslatableSpec,
  ViewTypeConfig,
  TableColumnDef,
} from './detail-view-type-registry'
export {
  isValidDetailViewType,
  VIEW_TYPE_REGISTRY,
  getViewTypeConfig,
  getRequiredFields,
  getOptionalFields,
  getTranslatableFields,
  getTranslatableFieldsForScope,
  getSummableFields,
  getTableColumnsForViewType,
} from './detail-view-type-registry'
export { VIEW_TYPE_LABELS, getViewTypeLabel, getPresentDetailViewTypes } from './detail-view-type-display'
export { getDetailViewType } from './resolve-detail-view-type'

// Die persistierte Form der Dokument-Metadaten samt Uebersetzungs-Maps
// (M4h aus `src/types/doc-meta.ts`).
export type {
  ChapterMetaEntry,
  DocPublicationMeta,
  DocTranslationStatus,
  GalleryTranslatedFields,
  DetailTranslatedFields,
  DocTranslationsMeta,
  DocMeta,
  DocMetaFilters,
} from './doc-meta'

export type { DocCardMeta, DetailDoc, ChapterInfo, FavoriteVoter } from './doc-card-meta'

export type { DocReference, QuerySource } from './doc-reference'

export type { GalleryFilters } from './gallery-filters'

export type {
  SourceUserStateValue,
  SourceUserState,
  OwnUserStatesResponse,
  SetUserStateInput,
  SetUserStateResponse,
} from './source-user-state'

export type {
  SourceComment,
  SourceCommentRevision,
  SourceCommentCreateInput,
  SourceCommentUpdateInput,
  SourceCommentThreadResponse,
  SourceCommentCountsResponse,
} from './source-comment'

export type {
  SiteModule,
  SitePrimaryLibrary,
  SitePrimaryLibraryBySlug,
  SitePrimaryLibraryUserSelected,
  SiteFederatedLibrary,
  SiteFederatedLibraryRole,
  SiteChrome,
  SiteAuth,
  SiteApi,
  SiteConfig,
} from './site-config'
export { isSitePrimaryBySlug } from './site-config'
