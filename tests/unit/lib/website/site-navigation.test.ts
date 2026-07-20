/**
 * Unit-Tests fuer die dokumentgetriebene Website-Navigation (Phase C1):
 * Menue-Filterung nach `menu_area`/`site_role` + `?site=`-Deep-Link-Aufloesung.
 */

import { describe, it, expect } from 'vitest'
import type { DocCardMeta } from '@/lib/gallery/types'
import {
  selectMainMenuDocs,
  selectFooterLinkDocs,
  findFooterContentDoc,
  resolveSiteParamDoc,
  getSiteParamForDoc,
  sortByMenuOrder,
} from '@/lib/website/site-navigation'

function doc(overrides: Partial<DocCardMeta> & { id: string }): DocCardMeta {
  return { fileId: overrides.id, ...overrides }
}

const home = doc({ id: 'home', title: 'Start', menu_order: 1 })
const kontakt = doc({ id: 'kontakt', title: 'Kontakt', menu_order: 9, menu_area: 'main' })
const impressum = doc({ id: 'impressum', title: 'Impressum', menu_order: 2, menu_area: 'footer', slug: 'impressum' })
const hiddenDoc = doc({ id: 'entwurf', title: 'Entwurf', menu_area: 'hidden' })
const footerContent = doc({ id: 'footer', title: 'Fusszeile', site_role: 'footer-content', menu_area: 'hidden' })
const all = [footerContent, kontakt, impressum, hiddenDoc, home]

describe('selectMainMenuDocs', () => {
  it('liefert nur main/ohne menu_area, sortiert nach menu_order', () => {
    expect(selectMainMenuDocs(all).map((d) => d.fileId)).toEqual(['home', 'kontakt'])
  })

  it('schliesst footer-content auch ohne menu_area aus', () => {
    const sneaky = doc({ id: 'x', title: 'X', site_role: 'footer-content' })
    expect(selectMainMenuDocs([sneaky, home]).map((d) => d.fileId)).toEqual(['home'])
  })

  it('behandelt unbekannte menu_area-Werte wie hidden', () => {
    const typo = doc({ id: 'typo', title: 'Typo', menu_area: 'footr' })
    expect(selectMainMenuDocs([typo])).toEqual([])
    expect(selectFooterLinkDocs([typo])).toEqual([])
  })
})

describe('selectFooterLinkDocs', () => {
  it('liefert nur menu_area=footer (ohne footer-content)', () => {
    expect(selectFooterLinkDocs(all).map((d) => d.fileId)).toEqual(['impressum'])
  })
})

describe('findFooterContentDoc', () => {
  it('findet das footer-content-Doc', () => {
    expect(findFooterContentDoc(all)?.fileId).toBe('footer')
  })

  it('gibt null zurueck, wenn keines existiert', () => {
    expect(findFooterContentDoc([home, impressum])).toBeNull()
  })

  it('waehlt bei mehreren Kandidaten deterministisch den kleinsten menu_order', () => {
    const second = doc({ id: 'footer2', title: 'Alt', site_role: 'footer-content', menu_order: 1 })
    expect(findFooterContentDoc([footerContent, second])?.fileId).toBe('footer2')
  })
})

describe('resolveSiteParamDoc', () => {
  it('loest einen persistierten Slug auf', () => {
    expect(resolveSiteParamDoc(all, 'impressum')?.fileId).toBe('impressum')
  })

  it('loest den synthetischen Slug (getSiteParamForDoc) auf', () => {
    const param = getSiteParamForDoc(home)
    expect(param).toBeTruthy()
    expect(resolveSiteParamDoc(all, param as string)?.fileId).toBe('home')
  })

  it('faellt auf fileId zurueck', () => {
    expect(resolveSiteParamDoc(all, 'kontakt')?.fileId).toBe('kontakt')
  })

  it('gibt null bei unbekanntem Param oder Leerstring', () => {
    expect(resolveSiteParamDoc(all, 'gibt-es-nicht')).toBeNull()
    expect(resolveSiteParamDoc(all, '  ')).toBeNull()
  })
})

describe('sortByMenuOrder', () => {
  it('sortiert fehlenden menu_order ans Ende, gleiche Werte nach Titel', () => {
    const a = doc({ id: 'a', title: 'Zebra' })
    const b = doc({ id: 'b', title: 'Apfel' })
    const c = doc({ id: 'c', title: 'Mitte', menu_order: 5 })
    expect([a, b, c].sort(sortByMenuOrder).map((d) => d.fileId)).toEqual(['c', 'b', 'a'])
  })
})
