import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  EXPLORER_API_PREFIXES,
  EXPLORER_API_EXCLUSIONS,
  classifyExplorerApiRoute,
} from '@ks/module-explorer'

/**
 * Beweis-Ziel der Welle M4: Der API-Schnitt aus Modul-Landkarte §3 ist keine
 * Prosa mehr, sondern eine Zusicherung. Dieser Test laeuft den ECHTEN
 * Route-Baum der App ab und prueft beide Richtungen — jede Explorer-Route ruft
 * das Gate, jede ausgenommene Route ruft es nicht.
 *
 * Eine neue Route unter `chat/[libraryId]/...` faellt hier auf, bis sie
 * entweder gegatet oder in `EXPLORER_API_EXCLUSIONS` mit Begruendung
 * ausgenommen ist. Genau das verhindert, dass der Namensraum still ausfranst.
 */

const API_ROOT = join(process.cwd(), 'src', 'app', 'api')

/** Alle Route-Verzeichnisse (relativ zu `src/app/api`), die eine `route.ts` haben. */
function collectRouteDirs(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectRouteDirs(full, found)
    } else if (entry === 'route.ts') {
      found.push(relative(API_ROOT, dir).split(sep).join('/'))
    }
  }
  return found
}

const ALL_ROUTES = collectRouteDirs(API_ROOT).sort()
const NAMESPACE_ROUTES = ALL_ROUTES.filter((r) => classifyExplorerApiRoute(r).inNamespace)

function routeSource(route: string): string {
  return readFileSync(join(API_ROOT, ...route.split('/'), 'route.ts'), 'utf-8')
}

describe('Explorer-API-Namensraum', () => {
  it('findet ueberhaupt Routen in den deklarierten Praefixen', () => {
    expect(EXPLORER_API_PREFIXES.length).toBeGreaterThan(0)
    expect(NAMESPACE_ROUTES.length).toBeGreaterThan(10)
  })

  it('ordnet Routen ausserhalb der Praefixe nicht dem Explorer zu', () => {
    const verdict = classifyExplorerApiRoute('libraries/[libraryId]/members')
    expect(verdict.inNamespace).toBe(false)
    expect(verdict.gated).toBe(false)
  })

  it('verwechselt Praefixe nicht mit Namens-Anfaengen', () => {
    // `publications` faengt mit `public` an, liegt aber nicht darunter.
    expect(classifyExplorerApiRoute('publications').inNamespace).toBe(false)
  })
})

describe('Gate-Abdeckung im echten Route-Baum', () => {
  const gated = NAMESPACE_ROUTES.filter((r) => classifyExplorerApiRoute(r).gated)
  const excluded = NAMESPACE_ROUTES.filter((r) => !classifyExplorerApiRoute(r).gated)

  it.each(gated)('%s ruft explorerGate auf', (route) => {
    expect(routeSource(route)).toContain('explorerGate(')
  })

  it.each(excluded)('%s ist begruendet ausgenommen und ruft das Gate NICHT', (route) => {
    const verdict = classifyExplorerApiRoute(route)
    expect(verdict.reason, `Ausnahme ohne Begruendung: ${route}`).toBeTruthy()
    expect(routeSource(route)).not.toContain('explorerGate(')
  })

  it('haelt die Ausnahmeliste frei von Karteileichen', () => {
    for (const exclusion of EXPLORER_API_EXCLUSIONS) {
      expect(ALL_ROUTES, `Ausnahme zeigt auf keine existierende Route: ${exclusion.route}`)
        .toContain(exclusion.route)
    }
  })

  it('gatet keine Route ausserhalb des Explorer-Namensraums', () => {
    const fremd = ALL_ROUTES.filter((r) => !classifyExplorerApiRoute(r).inNamespace)
      .filter((r) => routeSource(r).includes('explorerGate('))
    expect(fremd).toEqual([])
  })
})
