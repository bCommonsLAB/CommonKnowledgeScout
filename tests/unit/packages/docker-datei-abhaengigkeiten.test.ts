// @vitest-environment node
/**
 * Waechter fuer Abhaengigkeiten aus Dateien (`file:vendor/…tgz`; die erste war
 * `@commonux/player`, ausgebaut mit Welle T0b des Plans `teppich-der-dokumente`):
 * `pnpm install --frozen-lockfile` liest die Datei schon beim Install. Das Dockerfile kopiert vor
 * dem Install aber nur `package.json` und `pnpm-lock.yaml` (siehe docker-abhaengigkeiten.test.ts).
 * Fehlt der Ordner dort, bricht der Docker-Build mit ENOENT ab — erst in `ci-main`, nach dem Merge.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = process.cwd()

interface RootPaket {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** `file:`-Abhaengigkeiten der App: Name → Pfad relativ zum Repo. */
function dateiAbhaengigkeiten(): Array<{ name: string; pfad: string }> {
  const paket = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as RootPaket
  return Object.entries({ ...paket.dependencies, ...paket.devDependencies })
    .filter(([, spec]) => spec.startsWith('file:'))
    .map(([name, spec]) => ({ name, pfad: spec.slice('file:'.length) }))
}

/** Was das Dockerfile vor dem ersten `pnpm install` kopiert (Quellen der COPY-Zeilen). */
function vorDemInstallKopiert(): string[] {
  const zeilen = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf-8').split('\n')
  const install = zeilen.findIndex((z) => /^RUN .*pnpm install/.test(z.trim()))
  if (install < 0) throw new Error('Dockerfile ohne `RUN pnpm install`')
  return zeilen
    .slice(0, install)
    .filter((z) => /^COPY\s/.test(z.trim()) && !z.includes('--from='))
    .flatMap((z) => z.trim().split(/\s+/).slice(1, -1))
}

describe('Docker-Build: Abhaengigkeiten aus Dateien', () => {
  // Gegenrichtung: Ein COPY auf einen Ordner, den es nicht mehr gibt, bricht den Docker-Build
  // genauso ab — etwa wenn die letzte file:-Abhaengigkeit geht und die COPY-Zeile bleibt.
  it('alles, was das Dockerfile vor pnpm install kopiert, liegt im Repo', () => {
    for (const quelle of vorDemInstallKopiert()) {
      expect(existsSync(join(REPO_ROOT, quelle)), `COPY ${quelle}: fehlt im Repo`).toBe(true)
    }
  })

  it('jede file:-Abhaengigkeit liegt im Repo und wird vor pnpm install kopiert', () => {
    const kopiert = vorDemInstallKopiert()
    for (const { name, pfad } of dateiAbhaengigkeiten()) {
      expect(existsSync(join(REPO_ROOT, pfad)), `${name}: ${pfad} fehlt`).toBe(true)
      const ordner = pfad.split('/')[0]
      const gedeckt = kopiert.some((quelle) => quelle === pfad || quelle.replace(/\/$/, '') === ordner)
      expect(gedeckt, `${name}: ${ordner}/ wird vor pnpm install nicht kopiert`).toBe(true)
    }
  })
})
