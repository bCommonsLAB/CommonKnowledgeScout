/**
 * @fileoverview DetailViewType Registry und Validierung
 * 
 * Zentrale Exports für DetailViewType-Funktionalität.
 * 
 * @example
 * ```typescript
 * import {
 *   DETAIL_VIEW_TYPES,
 *   isValidDetailViewType,
 *   validateMetadataForViewType,
 * } from '@/lib/detail-view-types'
 * ```
 */

// Registry exports
export {
  DETAIL_VIEW_TYPES,
  type DetailViewType,
  detailViewTypeSchema,
  isValidDetailViewType,
  VIEW_TYPE_REGISTRY,
  type ViewTypeConfig,
  getViewTypeConfig,
  getRequiredFields,
  getOptionalFields,
  getTableColumnsForViewType,
  type TableColumnDef,
} from './registry'

// Validation exports
export {
  type ValidationResult,
  validateMetadataForViewType,
  validateTemplateForViewType,
  formatValidationWarning,
} from './validation'
