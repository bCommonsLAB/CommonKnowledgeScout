/**
 * `documentsViaHrefFor` an `KnowledgeScoutSite`: Wer oeffnet ein Dokument der
 * eingebetteten Startseite (Banner-Karte, Beleg) — die eigene Detailansicht
 * oder die Container-Anwendung?
 */

import { describe, it, expect, vi } from 'vitest'
import { dokumentWeg } from '../../../../packages/embed/src/embed-site-dokument'
import { embedSiteNavigation } from '../../../../packages/embed/src/embed-site-navigation'
import type { KsZiel } from '../../../../packages/embed/src'

/** Container-Anwendung, die nur das Dokument `methode-a` selbst zeigt. */
function aufbau() {
  const hrefFor = vi.fn((ziel: KsZiel) => (ziel.art === 'dokument' && ziel.slug === 'methode-a' ? '/?view=v_md__methode-a' : null))
  const zu = vi.fn()
  return { hrefFor, zu, navigation: embedSiteNavigation(hrefFor, zu) }
}

describe('dokumentWeg', () => {
  it('ohne die Option: ein Typ mit eingebetteter Ansicht oeffnet dort, hrefFor wird nicht gefragt', () => {
    const { hrefFor, navigation } = aufbau()
    expect(dokumentWeg({ slug: 'methode-a', eingebettet: true, zuerstContainer: false, navigation })).toEqual({ art: 'eingebettet' })
    expect(hrefFor).not.toHaveBeenCalled()
  })

  it('mit der Option: hrefFor wird auch fuer Buch, Testimonial und Blog gefragt; die Adresse der Container-Anwendung gewinnt', () => {
    const { hrefFor, zu, navigation } = aufbau()
    const weg = dokumentWeg({ slug: 'methode-a', page: 3, eingebettet: true, zuerstContainer: true, navigation })
    expect(hrefFor).toHaveBeenCalledWith({ art: 'dokument', slug: 'methode-a', seitenzahl: 3 })
    expect(weg.art).toBe('container')
    expect(zu).not.toHaveBeenCalled()
    if (weg.art === 'container') weg.ausfuehren()
    expect(zu).toHaveBeenCalledWith('/?view=v_md__methode-a')
  })

  it('mit der Option und null aus hrefFor: die eigene Detailansicht oeffnet', () => {
    const { hrefFor, navigation } = aufbau()
    expect(dokumentWeg({ slug: 'anderes', eingebettet: true, zuerstContainer: true, navigation })).toEqual({ art: 'eingebettet' })
    expect(hrefFor).toHaveBeenCalledWith({ art: 'dokument', slug: 'anderes' })
  })

  it('mit der Option, aber ohne Slug: die eigene Detailansicht oeffnet, hrefFor wird nicht gefragt', () => {
    const { hrefFor, navigation } = aufbau()
    expect(dokumentWeg({ slug: null, eingebettet: true, zuerstContainer: true, navigation })).toEqual({ art: 'eingebettet' })
    expect(hrefFor).not.toHaveBeenCalled()
  })

  it('Typ ohne eingebettete Ansicht: wie bisher ueber hrefFor, mit und ohne die Option', () => {
    for (const zuerstContainer of [false, true]) {
      const { navigation } = aufbau()
      expect(dokumentWeg({ slug: 'methode-a', eingebettet: false, zuerstContainer, navigation }).art).toBe('container')
      const ohneAdresse = dokumentWeg({ slug: 'anderes', eingebettet: false, zuerstContainer, navigation })
      expect(ohneAdresse.art).toBe('nichts')
      expect(dokumentWeg({ slug: null, eingebettet: false, zuerstContainer, navigation }).art).toBe('nichts')
    }
  })
})
