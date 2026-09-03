'use client'

/**
 * @fileoverview Was die Abnahme blockiert — aufklappbar unter dem Kopf.
 *
 * @description
 * Befund aus dem Live-Test (27.08.2026): Der Chip sagte „2 Widerstaende
 * offen", der Baum zeigte lauter Haken — die beiden Befunde hingen am
 * VORHABEN, nicht an einem Artefakt, und waren nur ueber das Menue `⋯`
 * erreichbar. Eine Zahl, die man nicht aufloesen kann, ist eine Sackgasse.
 *
 * Diese Liste nennt alle Arten von Widerstand an EINER Stelle: maschinelle
 * Befunde des Teilbaums (Cowork/KnowledgeScout), die vom Menschen gesetzten
 * Fehler-Markierungen und seine offenen Korrekturauftraege (K3). Alles, was
 * an einem Artefakt haengt, ist anklickbar — es fuehrt dorthin.
 *
 * Und sie sagt, WAS ZU TUN ist (Rueckfrage 27.08.2026: „muss ich neu scannen
 * oder in Cowork arbeiten?"). Der Handlungssatz kommt aus den bestehenden
 * {@link renderAuftragZeile} — dieselbe Quelle wie der kopierbare
 * Cowork-Auftrag, keine zweite Formulierung, die auseinanderlaufen kann.
 *
 * @module components/library/agent-view
 */

import { renderAuftragZeile } from '@/lib/agent-view/auftrag-templates'
import { actorLabel, gapLabel } from '@/lib/agent-view/labels'
import type { CoverageGap, LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import { artefaktKorrekturOffen, artefaktMarkiert, familienPruefstand } from '@/lib/agent-view/werkbank-baum'

/** Kurzer Ort fuer den Handlungssatz — der volle Pfad steht schon daneben. */
function kurzerOrt(gap: CoverageGap): string {
  const teile = gap.path.split('/')
  return teile[teile.length - 1] || gap.path
}

/** Artefakte einer Familie, die ein Praedikat erfuellen — mit ihrem Text. */
function teileVon(
  familie: TwinFamilySummary,
  trifft: (artefakt: LeadingArtifactSummary) => boolean,
  textVon: (artefakt: LeadingArtifactSummary) => string,
): { teil: string; text: string }[] {
  const teile: { teil: string; text: string }[] = []
  for (const [teil, artefakt] of [
    ['Transkript', familie.transkript],
    ['Zusammenfassung', familie.zusammenfassung],
  ] as const) {
    if (artefakt != null && trifft(artefakt)) teile.push({ teil, text: textVon(artefakt) })
  }
  return teile
}

export function WiderstandsListe({ befunde, familien, maschinellGesamt, onWaehleArtefakt }: {
  /** Befunde des Teilbaums (via `teilbaumBefunde`) — kann gekappt sein. */
  befunde: readonly CoverageGap[]
  /** Effektive Familien des Vorhabens; undefined = Report vor Welle 4. */
  familien: readonly TwinFamilySummary[] | undefined
  /** Gezaehlte maschinelle Befunde der Karte — mehr als gelistet ⇒ Kappung. */
  maschinellGesamt: number
  onWaehleArtefakt: (sourceId: string) => void
}) {
  const maschinell = befunde.filter((gap) => gap.actor !== 'mensch')
  const fehlend = Math.max(0, maschinellGesamt - maschinell.length)
  const markierte = (familien ?? []).filter((familie) => familienPruefstand(familie) === 'markiert')
  // K3: Auftraege haengen auch an Familien, die zugleich markiert sind — hier
  // wird nach dem Praedikat gefiltert, nicht nach dem Pruefstand (der zeigt
  // nur den strengeren der beiden).
  const beauftragte = (familien ?? []).filter((familie) =>
    [familie.transkript, familie.zusammenfassung].some(
      (artefakt) => artefakt != null && artefaktKorrekturOffen(artefakt),
    ),
  )

  if (maschinell.length === 0 && markierte.length === 0 && beauftragte.length === 0 && fehlend === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nichts sperrt die Abnahme — weder ein maschineller Befund noch eine Fehler-Markierung.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
      {markierte.length > 0 && (
        <div>
          <p className="font-medium">Von dir als fehlerhaft markiert</p>
          <p className="text-muted-foreground">
            Was tun: reparieren (lassen) und danach verifizieren — das loest die Markierung sofort auf,
            ohne Scan.
          </p>
          <ul className="mt-1 space-y-1">
            {markierte.map((familie) =>
              teileVon(familie, artefaktMarkiert, (a) => a.flaggedNote ?? '(ohne Notiz)').map(
                ({ teil, text }) => (
                  <li key={`${familie.sourceId}-${teil}`}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => onWaehleArtefakt(familie.sourceId)}
                    >
                      <span aria-hidden>⊘ </span>
                      {familie.sourceName} · {teil}: {text}
                    </button>
                  </li>
                ),
              ),
            )}
          </ul>
        </div>
      )}

      {beauftragte.length > 0 && (
        <div>
          <p className="font-medium">Von dir beauftragt — wartet auf Cowork</p>
          <p className="text-muted-foreground">
            Was tun: Der Auftrag steht im naechsten Aufraeumlauf als Cowork-Befund. Selbst
            erledigt oder hinfaellig? Verifizieren loest ihn auf.
          </p>
          <ul className="mt-1 space-y-1">
            {beauftragte.map((familie) =>
              teileVon(familie, artefaktKorrekturOffen, (a) => a.korrekturAuftrag ?? '').map(
                ({ teil, text }) => (
                  <li key={`${familie.sourceId}-${teil}-auftrag`}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => onWaehleArtefakt(familie.sourceId)}
                    >
                      <span aria-hidden>✎ </span>
                      {familie.sourceName} · {teil}: {text}
                    </button>
                  </li>
                ),
              ),
            )}
          </ul>
        </div>
      )}

      {fehlend > 0 && (
        <p className="font-medium">
          {fehlend} weitere(r) maschinelle(r) Befund(e) sind gezaehlt, aber nicht im gespeicherten Report
          gelistet (Gap-Budget) — &bdquo;Neu scannen&ldquo; holt sie.
        </p>
      )}

      {maschinell.length > 0 && (
        <div>
          <p className="font-medium">Maschinelle Befunde in diesem Vorhaben</p>
          <ul className="mt-1 space-y-1">
            {maschinell.map((gap, idx) => (
              <li key={`${gap.type}-${gap.path}-${idx}`} className="text-muted-foreground">
                <span className="text-foreground">{gapLabel(gap.type)}</span> · {gap.path}
                {gap.message ? ` — ${gap.message}` : ''}
                <p className="mt-0.5 pl-3">
                  <span className="font-medium text-foreground">Was tun ({actorLabel(gap.actor)}):</span>{' '}
                  {renderAuftragZeile(gap, kurzerOrt(gap))}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            Im Menue `⋯` liegt derselbe Text als kopierbarer Auftrag fuer Cowork. Erledigt? Der Befund
            verschwindet, sobald der Stand neu erhoben ist — dafuer genuegt &bdquo;Teilbaum neu scannen&ldquo;
            im Menue `⋯`, kein Voll-Scan.
          </p>
        </div>
      )}
    </div>
  )
}
