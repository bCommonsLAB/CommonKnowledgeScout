import { describe, expect, it } from 'vitest'
import { applyEventFrontmatterDefaults } from '@/lib/events/event-frontmatter-defaults'

describe('applyEventFrontmatterDefaults', () => {
  it('fills event defaults when keys exist and values are empty', () => {
    const frontmatterKeys = new Set(['slug', 'docType', 'detailViewType', 'eventStatus', 'testimonialWriteKey'])
    const frontmatter: Record<string, unknown> = {}

    const out = applyEventFrontmatterDefaults({
      frontmatterKeys,
      frontmatter,
      typeId: 'event-creation-de',
      ownerId: 'mein-event',
      detailViewType: 'session',
      generateUuid: () => 'uuid-123',
    })

    expect(out.slug).toBe('mein-event')
    expect(out.docType).toBe('event')
    expect(out.detailViewType).toBe('session')
    expect(out.eventStatus).toBe('open')
    expect(out.testimonialWriteKey).toBe('uuid-123')
  })

  it('does not set docType if typeId is not event-like', () => {
    const frontmatterKeys = new Set(['docType'])
    const frontmatter: Record<string, unknown> = {}

    const out = applyEventFrontmatterDefaults({
      frontmatterKeys,
      frontmatter,
      typeId: 'dialograum-creation-de',
      ownerId: 'x',
      detailViewType: 'session',
      generateUuid: () => 'uuid-123',
    })

    expect(out.docType).toBeUndefined()
  })

  it('does not override existing values', () => {
    const frontmatterKeys = new Set(['slug', 'docType', 'detailViewType', 'eventStatus', 'testimonialWriteKey'])
    const frontmatter: Record<string, unknown> = {
      slug: 'custom-slug',
      docType: 'event',
      detailViewType: 'session',
      eventStatus: 'finalDraft',
      testimonialWriteKey: 'existing',
    }

    const out = applyEventFrontmatterDefaults({
      frontmatterKeys,
      frontmatter,
      typeId: 'event-creation-de',
      ownerId: 'ignored',
      detailViewType: 'session',
      generateUuid: () => 'uuid-123',
    })

    expect(out.slug).toBe('custom-slug')
    expect(out.eventStatus).toBe('finalDraft')
    expect(out.testimonialWriteKey).toBe('existing')
  })

  it('sets wizard template defaults for event docs when missing (if fields exist)', () => {
    const frontmatterKeys = new Set([
      'docType',
      'wizard_testimonial_template_id',
      'wizard_finalize_template_id',
    ])
    const frontmatter: Record<string, unknown> = {}

    const out = applyEventFrontmatterDefaults({
      frontmatterKeys,
      frontmatter,
      typeId: 'event-creation-de',
      ownerId: 'mein-event',
      detailViewType: 'session',
      generateUuid: () => 'uuid-123',
    })

    expect(out.docType).toBe('event')
    expect(out.wizard_testimonial_template_id).toBe('event-testimonial-creation-de')
    expect(out.wizard_finalize_template_id).toBe('event-finalize-de')
  })
})

