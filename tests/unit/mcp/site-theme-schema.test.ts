/**
 * Nachtrag S2 — das Bruecken-Schema von siteTheme muss ein sichtbares
 * Objekt-Schema sein (kein anyOf), Objekte annehmen und Text abweisen.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { SITE_THEME_SCHEMA } from '@/lib/website/site-theme-schema'

describe('SITE_THEME_SCHEMA', () => {
  it('nimmt ein Profil als Objekt an und weist Text ab', () => {
    expect(SITE_THEME_SCHEMA.safeParse({ fontHeading: 'newsreader', accent: '#C85A32', surfaces: { light: { bg: '#f4f1ea', text: '#1c3829' } } }).success).toBe(true)
    expect(SITE_THEME_SCHEMA.safeParse('{"accent":"#c85a32"}').success).toBe(false)
    expect(SITE_THEME_SCHEMA.safeParse({ fontHeading: 'comic' }).success).toBe(false)
    expect(SITE_THEME_SCHEMA.safeParse({ surfaces: { petrol: { bg: '#224851', text: '#ffffff' } } }).success).toBe(false)
  })

  it('ist ein zod-Objekt mit benannten Feldern (wird als JSON-Objekt-Schema veroeffentlicht, nicht als anyOf)', () => {
    expect(SITE_THEME_SCHEMA).toBeInstanceOf(z.ZodObject)
    expect(Object.keys(SITE_THEME_SCHEMA.shape)).toEqual(['fontHeading', 'fontBody', 'accent', 'accentHover', 'accentText', 'buttonShape', 'surfaces'])
  })
})
