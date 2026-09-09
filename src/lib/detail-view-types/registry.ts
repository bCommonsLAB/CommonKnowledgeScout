/**
 * Die Registry der Renderer-Typen liegt seit M4h in `@ks/contracts`
 * (`detail-view-type-registry.ts`) — hier fuer die App weitergereicht, damit
 * 32 Aufrufstellen ihren Pfad behalten. Nur das zod-Schema wohnt weiter hier:
 * Das Paket beschreibt, es kennt kein zod.
 *
 * Der Galerie-Kegel importiert NICHT von hier, sondern direkt aus
 * `@ks/contracts` — eine Weiterleitung haelt die App am Laufen, loest aber
 * keine Kopplung (Galerie-Audit, Nachtrag zur Gruppe C).
 */
import { z } from 'zod'
import { DETAIL_VIEW_TYPES } from '@ks/contracts'

export type {
  DetailViewType,
  ViewTypeMediaConfig,
  TranslatableScope,
  TranslatableFieldSpec,
  TranslatableChaptersSpec,
  TranslatableSpec,
  ViewTypeConfig,
  TableColumnDef,
} from '@ks/contracts'
export {
  DETAIL_VIEW_TYPES,
  isDetailViewType,
  isValidDetailViewType,
  VIEW_TYPE_REGISTRY,
  getViewTypeConfig,
  getRequiredFields,
  getOptionalFields,
  getTranslatableFields,
  getTranslatableFieldsForScope,
  getSummableFields,
  getTableColumnsForViewType,
} from '@ks/contracts'

export const detailViewTypeSchema = z.enum(DETAIL_VIEW_TYPES)
