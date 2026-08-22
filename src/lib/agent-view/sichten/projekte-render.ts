/**
 * @fileoverview PROJEKTE.md rendern (Port von `Organisation/Tools/projekte.py`).
 *
 * @description
 * „Woran habe ich je gearbeitet": Abdeckung, Steckbriefe je Bereich (Status-
 * Reihenfolge aktiv → ruhend → abgeschlossen) und das Themenregister — der
 * Kontext, den ein Agent liest, bevor er etwas von aussen hereintraegt.
 * Wortlaut wie im Skript. Reine Funktion.
 *
 * @module agent-view/sichten
 */

import { sichtFrontmatter } from './aktuell-render'
import { berichtLink, datumKurz, datumLesbar, type ProjektDatensatz } from './types'

const BEREICH_TITEL: Record<string, string> = {
  'ökosozial': 'Ökosozialer Aktivismus',
  commoning: 'Commoning',
  prototyping: 'bCommonsLab — Prototypen und Plattformen',
  beruflich: 'Crystal Design (beruflich)',
  privat: 'Privat',
}
const BEREICH_ORDNUNG = ['prototyping', 'ökosozial', 'commoning', 'beruflich', 'privat']
const STATUS_ORDNUNG: Record<string, number> = { aktiv: 0, ruhend: 1, abgeschlossen: 2 }

function zeitraum(p: ProjektDatensatz): string {
  const von = p.begonnen ? datumLesbar(p.begonnen) : '?'
  const bis = p.letzteAktivitaet ? datumLesbar(p.letzteAktivitaet) : '?'
  return `${von} – ${bis}`
}

/** Thema → Vorhaben; Mehrfach-Themen zuerst (Querverbindungen), dann alphabetisch. */
export function themenregister(projekte: readonly ProjektDatensatz[]): Array<[string, string[]]> {
  const register = new Map<string, string[]>()
  for (const p of projekte) {
    for (const t of p.themen) register.set(t, [...(register.get(t) ?? []), p.projekt || p.ordner])
  }
  return [...register.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].toLowerCase().localeCompare(b[0].toLowerCase()),
  )
}

function steckbrief(p: ProjektDatensatz): string[] {
  const z: string[] = []
  const marken: string[] = []
  if (p.rolle && p.rolle !== '—') marken.push(p.rolle)
  marken.push(p.status ?? 'ohne Status')
  if (p.quelle === 'erschlossen') marken.push('⚠ erschlossen')
  z.push(`### ${p.titel || p.projekt || p.ordner}`, '')
  z.push(`\`${p.projekt}\` · ${marken.join(' · ')} · ${zeitraum(p)}`, '')
  z.push(berichtLink(p, 'Bericht öffnen'))
  if (p.repo.length > 0) z.push(`Repo: ${p.repo.map((r) => `\`${r}\``).join(', ')}`)
  if (p.plattform) z.push(`Plattform: ${p.plattform}`)
  z.push('')
  if (p.beschreibung) z.push(p.beschreibung, '')
  z.push(p.themen.length > 0 ? `**Themen.** ${p.themen.join(' · ')}` : '**Themen.** *(fehlen — ohne sie findet kein Text hierher)*', '')
  if (p.schritte.length > 0) {
    z.push('**Offene Fragen.**')
    for (const punkt of p.schritte) z.push(`- ${punkt}`)
    z.push('')
  }
  return z
}

export function renderProjekte(projekte: readonly ProjektDatensatz[], ordnerzahl: number, now: Date): string {
  const z: string[] = []
  z.push('# PROJEKTE — der Katalog', '')
  z.push(`Erzeugt am ${datumKurz(now)} aus den \`BERICHT.md\`-Dateien des Archivs — **nicht von Hand pflegen.**`)
  z.push('Gepflegt werden die Projektberichte; dieser Katalog wird daraus erzeugt')
  z.push('(KnowledgeScout, Werkzeug `sichten_regenerieren`). Das Verfahren steht in')
  z.push('`Zielbild Wissensarchiv.md`, Abschnitt 6b.', '')
  z.push('**Wozu.** `AKTUELL.md` beantwortet „woran arbeite ich gerade". Dieser')
  z.push('Katalog beantwortet „woran habe ich je gearbeitet" — und dient als')
  z.push('Kontext für alles, was von außen hereinkommt: Fachartikel, Angebote,')
  z.push('Gespräche. Die Zeile `Themen` je Vorhaben ist die Andockstelle.', '')

  const erschlossen = projekte.filter((p) => p.quelle === 'erschlossen').length
  z.push(
    `> **Abdeckung:** ${projekte.length} von ${ordnerzahl} Projektordnern haben einen Bericht` +
      (erschlossen > 0 ? `, davon ${erschlossen} erschlossen und noch unbestätigt` : '') + '.',
  )
  if (ordnerzahl > 0 && projekte.length < ordnerzahl) {
    z.push('> Solange diese Zahl schief steht, ist der Katalog eine Gegenwarts-,')
    z.push('> keine Gesamtsicht. Die Kurzform für ruhende Vorhaben und die')
    z.push('> Rollout-Reihenfolge stehen in `Aufraeumen/Konventionen.md`.')
  }
  z.push('', '---', '')

  const sortierung = (a: ProjektDatensatz, b: ProjektDatensatz) =>
    (STATUS_ORDNUNG[a.status ?? ''] ?? 3) - (STATUS_ORDNUNG[b.status ?? ''] ?? 3) ||
    a.projekt.localeCompare(b.projekt)
  for (const bereich of BEREICH_ORDNUNG) {
    const gruppe = projekte.filter((p) => p.bereich === bereich).sort(sortierung)
    if (gruppe.length === 0) continue
    z.push(`## ${BEREICH_TITEL[bereich] ?? bereich}`, '')
    for (const p of gruppe) z.push(...steckbrief(p))
    z.push('')
  }

  const ohneBereich = projekte.filter((p) => p.bereich === null || !BEREICH_ORDNUNG.includes(p.bereich))
  if (ohneBereich.length > 0) {
    z.push('## Ohne Bereich im Frontmatter', '')
    for (const p of ohneBereich) z.push(`- ${p.ordner}`)
    z.push('')
  }

  const register = themenregister(projekte)
  z.push('---', '', '## Themenregister', '')
  z.push('Wonach ein eingehender Text sucht. Begriffe, die in mehreren Vorhaben')
  z.push('vorkommen, stehen oben — sie sind die Querverbindungen des Archivs.', '')
  const mehrfach = register.filter(([, v]) => v.length > 1)
  const einfach = register.filter(([, v]) => v.length === 1)
  if (mehrfach.length > 0) {
    z.push('| Thema | Vorhaben |', '|---|---|')
    for (const [t, v] of mehrfach) z.push(`| **${t}** | ${[...new Set(v)].sort().join(', ')} |`)
    z.push('')
  }
  if (einfach.length > 0) {
    z.push('| Thema | Vorhaben |', '|---|---|')
    for (const [t, v] of einfach) z.push(`| ${t} | ${v[0]} |`)
    z.push('')
  }
  z.push(`*${register.length} Themen aus ${projekte.length} Vorhaben.*`, '')
  return sichtFrontmatter('projekte', now) + z.join('\n')
}
