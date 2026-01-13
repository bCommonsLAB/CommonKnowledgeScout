/**
 * @fileoverview Event frontmatter defaults
 *
 * @description
 * Pure helper to apply minimal defaults for event-like documents.
 * This is used by the Creation Wizard to ensure stable slugs and optional
 * write keys for anonymous testimonial uploads.
 */

export function applyEventFrontmatterDefaults(args: {
  /** Keys that exist in the template frontmatter schema */
  frontmatterKeys: Set<string>
  /** Mutable frontmatter map that will be enriched */
  frontmatter: Record<string, unknown>
  /** Wizard typeId (used for minimal docType heuristics) */
  typeId: string
  /** Safe basename derived from fileName (used as slug fallback) */
  ownerId: string
  /** Wizard preview detailViewType (e.g. 'session') */
  detailViewType: string
  /** Optional UUID generator (injectable for tests) */
  generateUuid?: () => string
}): Record<string, unknown> {
  const { frontmatterKeys, frontmatter, ownerId, detailViewType } = args
  const typeIdLower = String(args.typeId || '').toLowerCase()

  if (frontmatterKeys.has('slug')) {
    const current = frontmatter.slug
    if (!current || String(current).trim() === '') {
      frontmatter.slug = ownerId
    }
  }

  if (frontmatterKeys.has('docType')) {
    const current = frontmatter.docType
    if (!current || String(current).trim() === '') {
      // Minimal heuristic: Only set for templates that clearly signal "event" in typeId.
      if (typeIdLower.includes('event')) {
        frontmatter.docType = 'event'
      }
    }
  }

  if (frontmatterKeys.has('detailViewType')) {
    const current = frontmatter.detailViewType
    if (!current || String(current).trim() === '') {
      frontmatter.detailViewType = detailViewType
    }
  }

  const docType = typeof frontmatter.docType === 'string' ? frontmatter.docType.trim() : ''

  if (frontmatterKeys.has('eventStatus')) {
    const current = frontmatter.eventStatus
    if (docType === 'event' && (!current || String(current).trim() === '')) {
      frontmatter.eventStatus = 'open'
    }
  }

  if (frontmatterKeys.has('testimonialWriteKey')) {
    const current = frontmatter.testimonialWriteKey
    if (docType === 'event' && (!current || String(current).trim() === '')) {
      const uuid =
        typeof args.generateUuid === 'function'
          ? args.generateUuid()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      frontmatter.testimonialWriteKey = uuid
    }
  }

  // Wizard-Orchestrierung: Default-Templates für Folgeflüsse (B/C).
  // Diese Felder sind bewusst optional: Nur setzen, wenn das Template sie definiert.
  if (docType === 'event') {
    if (frontmatterKeys.has('wizard_testimonial_template_id')) {
      const current = frontmatter.wizard_testimonial_template_id
      if (!current || String(current).trim() === '') {
        frontmatter.wizard_testimonial_template_id = 'event-testimonial-creation-de'
      }
    }
    if (frontmatterKeys.has('wizard_finalize_template_id')) {
      const current = frontmatter.wizard_finalize_template_id
      if (!current || String(current).trim() === '') {
        frontmatter.wizard_finalize_template_id = 'event-finalize-de'
      }
    }
  }

  return frontmatter
}

