import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * Erzeugt nach jedem E2E-Lauf automatisch den Prosa-Abnahmebericht
 * docs/settings-ux/06-testdrehbuch-ergebnis.md aus den Schritt-Protokollen
 * (tmp/e2e-results/*.json). So ist das Ergebnis ohne Tool-Kenntnis lesbar.
 */
interface StepResult { id: string; titel: string; status: 'PASS' | 'FAIL' | 'MANUELL'; detail: string }

const AKTE: Array<{ datei: string; titel: string }> = [
  { datei: 'akt1-quelle', titel: 'Akt 1 — meSpace: Quelle (1.1–1.5)' },
  { datei: 'akt1-verarbeitung', titel: 'Akt 1 — meSpace: Verarbeitung & Darstellung (1.6–1.12)' },
  { datei: 'akt2-cloud', titel: 'Akt 2 — Cloud-Quelle / Re-Auth (2.1–2.4)' },
  { datei: 'akt3-publish', titel: 'Akt 3 — weSpace / usSpace (3.1–3.9)' },
  { datei: 'spotchecks', titel: 'Sicherheits-Spotchecks (S1–S4)' },
]

const ICON: Record<StepResult['status'], string> = { PASS: '✅', FAIL: '❌', MANUELL: '🔵' }

function ladeAkt(name: string): StepResult[] {
  const pfad = `tmp/e2e-results/${name}.json`
  if (!existsSync(pfad)) return []
  try {
    return JSON.parse(readFileSync(pfad, 'utf8')) as StepResult[]
  } catch {
    return []
  }
}

export default function globalTeardown(): void {
  const alle: StepResult[] = []
  const bloecke: string[] = []

  for (const akt of AKTE) {
    const steps = ladeAkt(akt.datei)
    if (steps.length === 0) {
      bloecke.push(`## ${akt.titel}\n\n_Keine Ergebnisse (Akt nicht gelaufen)._\n`)
      continue
    }
    alle.push(...steps)
    const zeilen = steps.map(
      s => `| ${s.id} | ${ICON[s.status]} ${s.status} | ${s.titel} | ${s.detail.replace(/\|/g, '\\|')} |`,
    )
    bloecke.push(
      `## ${akt.titel}\n\n| # | Status | Soll-Verhalten | Beobachtung |\n|---|---|---|---|\n${zeilen.join('\n')}\n`,
    )
  }

  const zaehl = (st: StepResult['status']): number => alle.filter(s => s.status === st).length
  const pass = zaehl('PASS')
  const fail = zaehl('FAIL')
  const manuell = zaehl('MANUELL')

  const fails = alle.filter(s => s.status === 'FAIL')
  const failBlock = fails.length
    ? fails.map(s => `- **${s.id}** ${s.titel}: ${s.detail}`).join('\n')
    : '_Keine._'
  const manuellBlock = alle.filter(s => s.status === 'MANUELL').map(s => `- **${s.id}** ${s.titel} — ${s.detail}`).join('\n')

  const md = `# Test-Drehbuch — Automatischer Abnahmebericht

> Automatisch erzeugt vom E2E-Lauf (\`pnpm test:e2e\`) aus den Schritt-Protokollen
> unter \`tmp/e2e-results/\`. Spezifikation: [06-testdrehbuch.md](06-testdrehbuch.md).
> Nur Owner-Sicht, headless. OneDrive-Login, zweiter Account und echtes
> Inkognito sind als 🔵 MANUELL markiert.

**Zusammenfassung:** ✅ ${pass} PASS · ❌ ${fail} FAIL · 🔵 ${manuell} MANUELL (von ${alle.length} Schritten)

## Offene Fehlschläge (❌)

${failBlock}

## Manuell nachzutesten (🔵)

${manuellBlock || '_Keine._'}

${bloecke.join('\n')}
## Hinweise

- Test-Engine zum Zusehen: \`pnpm test:e2e:ui\` (Szenarien-Baum, Live-Browser,
  Zeitreise) · sichtbarer Lauf: \`pnpm test:e2e:headed\` · HTML-Report:
  \`pnpm test:e2e:report\`.
- Angelegte Testdaten (Präfix \`TEST-Drehbuch\`) werden zu Beginn von Akt 1
  automatisch gelöscht; bei Bedarf manuell über Settings entfernen.
`

  writeFileSync('docs/settings-ux/06-testdrehbuch-ergebnis.md', md, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`\n📄 Bericht geschrieben: docs/settings-ux/06-testdrehbuch-ergebnis.md (✅${pass} ❌${fail} 🔵${manuell})\n`)
}
