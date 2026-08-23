/**
 * @fileoverview AKTUELL.md rendern (Port von `Organisation/Tools/aktuell.py`).
 *
 * @description
 * „Woran arbeite ich gerade": Terminleiste, Tabelle der aktiven Vorhaben,
 * die naechsten zwei Schritte je Vorhaben, Ruhendes und Berichte ohne
 * Status. Wortlaut und Reihenfolge wie im Skript — nur die Herkunftszeile
 * nennt jetzt KnowledgeScout. Reine Funktion.
 *
 * Abend-Befund 22.08. (B2): Das Skript fuehrte vergangene `naechster_termin`
 * kommentarlos als „naechste Termine". Termine vor dem Erzeugungstag tragen
 * jetzt die Marke *ueberfaellig* — der Hinweis, dass der Bericht nachzuziehen
 * ist (nicht die Sicht). Explizit statt still.
 *
 * @module agent-view/sichten
 */

import { berichtLink, datumKurz, datumLesbar, isoHeute, istUeberfaellig, type ProjektDatensatz } from './types'

/** Flaches Frontmatter der erzeugten Sicht (AGENTS.md: snake_case, eine Ebene). */
export function sichtFrontmatter(sicht: 'aktuell' | 'projekte', now: Date): string {
  return [
    '---',
    'type: sicht',
    `sicht: ${sicht}`,
    'generated_by: knowledgescout/sichten',
    `generated_at: ${now.toISOString()}`,
    '---',
    '',
  ].join('\n')
}

export function renderAktuell(projekte: readonly ProjektDatensatz[], now: Date): string {
  const aktiv = projekte
    .filter((p) => p.status === 'aktiv')
    .sort((a, b) =>
      `${a.naechsterTermin ?? '9999'}|${a.letzteAktivitaet ?? ''}`.localeCompare(
        `${b.naechsterTermin ?? '9999'}|${b.letzteAktivitaet ?? ''}`,
      ),
    )
  const ruhend = projekte.filter((p) => p.status !== null && p.status !== 'aktiv')
  const ohne = projekte.filter((p) => p.status === null)
  const heute = isoHeute(now)
  const z: string[] = []

  z.push('# AKTUELL', '')
  z.push(
    `Erzeugt am ${datumKurz(now)} aus den \`BERICHT.md\`-Dateien des Archivs — **nicht von Hand pflegen.**`,
  )
  z.push('Gepflegt werden die Projektberichte; diese Übersicht wird daraus')
  z.push('erzeugt (KnowledgeScout, Werkzeug `sichten_regenerieren`).', '', '---', '')

  const termine = aktiv.filter((p) => p.naechsterTermin !== null)
  if (termine.length > 0) {
    z.push('## Die nächsten Termine', '')
    for (const p of termine) {
      const offen = p.schritte.length > 0 ? ` — ${p.schritte[0]}` : ''
      const marke = p.terminFixiert ? '' : '  ⚠️ *noch nicht fixiert*'
      const verzug = istUeberfaellig(p.naechsterTermin, heute) ? '  ⚠️ *überfällig*' : ''
      z.push(`- **${datumLesbar(p.naechsterTermin)}** · ${p.titel || p.projekt}${marke}${verzug}${offen}`)
    }
    z.push('')
    if (termine.some((p) => !p.terminFixiert)) {
      z.push('> Termine mit ⚠️ sind noch nicht vereinbart — bis dahin ist alles,')
      z.push('> was daran hängt, unsicher.', '')
    }
    if (termine.some((p) => istUeberfaellig(p.naechsterTermin, heute))) {
      z.push('> Termine mit ⚠️ *überfällig* liegen vor dem Erzeugungstag — `naechster_termin`')
      z.push('> im jeweiligen BERICHT.md nachziehen (Befund `bericht_veraltet`).', '')
    }
  }

  z.push('## Aktive Projekte', '', '| Projekt | Rolle | Zuletzt | Nächster Termin |', '|---|---|---|---|')
  for (const p of aktiv) {
    let termin = p.naechsterTermin ? datumLesbar(p.naechsterTermin) : '—'
    if (p.naechsterTermin && !p.terminFixiert) termin += ' ⚠️'
    if (istUeberfaellig(p.naechsterTermin, heute)) termin += ' ⚠️ überfällig'
    const zuletzt = p.letzteAktivitaet ? datumLesbar(p.letzteAktivitaet) : '—'
    z.push(`| ${berichtLink(p, p.projekt)} | ${p.rolle ?? '—'} | ${zuletzt} | ${termin} |`)
  }
  z.push('')

  z.push('## Was als Nächstes ansteht', '')
  for (const p of aktiv) {
    if (p.schritte.length === 0) continue
    z.push(`**${p.titel || p.projekt}**`)
    for (const s of p.schritte.slice(0, 2)) z.push(`- ${s}`)
    z.push('')
  }

  if (ruhend.length > 0) {
    z.push('## Ruhend und abgeschlossen', '')
    for (const p of ruhend) {
      const zuletzt = p.letzteAktivitaet ? `, zuletzt ${datumLesbar(p.letzteAktivitaet)}` : ''
      z.push(`- ${p.projekt} — ${p.status}${zuletzt}`)
    }
    z.push('')
  }

  if (ohne.length > 0) {
    z.push('## Ohne Status im Frontmatter', '')
    for (const p of ohne) z.push(`- ${p.ordner}`)
    z.push('')
  }

  z.push('---', '')
  z.push(`**Abdeckung:** ${projekte.length} Projekte haben einen Bericht. Projekte ohne \`BERICHT.md\` erscheinen hier nicht —`)
  z.push('die Reihenfolge des Nachziehens steht in `Aufraeumen/Konventionen.md`.', '')
  return sichtFrontmatter('aktuell', now) + z.join('\n')
}
