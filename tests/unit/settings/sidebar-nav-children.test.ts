/**
 * Teil B: zweite Ebene im Seitenmenue (SidebarNavItem.children).
 * Ein Eintrag mit Kindern ist offen, sobald der Pfad mit seinem href beginnt;
 * die Gruppen-Aufloesung im Layout sieht Eltern und Kinder flach.
 */
import { describe, it, expect } from 'vitest'
import { flattenNavItems, isNavItemOpen, type SidebarNavItem } from '@/components/settings/sidebar-nav'

const erweitert: SidebarNavItem = {
  title: 'Erweitert',
  href: '/settings/advanced',
  children: [
    { title: 'Suche & KI', href: '/settings/advanced/suche-ki' },
    { title: 'Wartung', href: '/settings/advanced/wartung' },
  ],
}
const story: SidebarNavItem = { title: 'Story', href: '/settings/story' }

describe('isNavItemOpen', () => {
  it('oeffnet den Elternteil auf einer Unterseite und auf der eigenen Route', () => {
    expect(isNavItemOpen('/settings/advanced/wartung', erweitert)).toBe(true)
    expect(isNavItemOpen('/settings/advanced', erweitert)).toBe(true)
  })

  it('bleibt auf fremden Seiten, ohne Pfad und bei Eintraegen ohne Kinder geschlossen', () => {
    expect(isNavItemOpen('/settings/story', erweitert)).toBe(false)
    expect(isNavItemOpen('/settings/advancedx', erweitert)).toBe(false)
    expect(isNavItemOpen(null, erweitert)).toBe(false)
    expect(isNavItemOpen('/settings/story', story)).toBe(false)
  })
})

describe('flattenNavItems', () => {
  it('liefert Eltern und Kinder in Reihenfolge', () => {
    expect(flattenNavItems([story, erweitert]).map((i) => i.href)).toEqual([
      '/settings/story',
      '/settings/advanced',
      '/settings/advanced/suche-ki',
      '/settings/advanced/wartung',
    ])
  })
})
