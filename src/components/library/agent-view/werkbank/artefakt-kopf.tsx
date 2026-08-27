'use client'

/**
 * @fileoverview Abnahme-Kopf des Artefakts (Welle A4, Mockup Zustand B).
 *
 * @description
 * Zeile 1 traegt Titel · Zustands-Chip · „stimmt nicht" · „Verifizieren" ·
 * Menue `⋯`; Zeile 2 den Breadcrumb. Beide Aktionen betreffen das Artefakt
 * des AKTIVEN Tabs (Transkript ODER Zusammenfassung); auf dem Original-Tab
 * sind sie benannt gesperrt — das Original ist die Referenz.
 *
 * ADR 0006 (Modell B): Der Chip ist eine AUSKUNFT, keine Mahnung —
 * „angenommen" (Maschinenarbeit, niemand hat widersprochen), „geprueft"
 * (ein Mensch hat hingesehen) oder „stimmt nicht" (markierter Fehler,
 * sperrt die Abnahme). Verifizieren bleibt moeglich, ist aber freiwillig.
 * Nach jeder Aktion meldet `onKuriert` den frischen Zustand nach oben.
 *
 * @module components/library/agent-view
 */

import { ClipboardCopy, ExternalLink, Loader2 } from 'lucide-react'
import { Button, useToast } from '@ks/ui'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'
import { twinStatusLabel, verificationLabel } from '@/lib/agent-view/labels'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import { artefaktKey, artefaktZustand } from '@/lib/agent-view/werkbank-baum'
import type { PruefbareArt } from '@/lib/agent-view/werkbank-abnahme'
import { TWIN_STATUS_VALUES } from '@/lib/shadow-twin/twin-core-fields'
import { AbnahmeKopfRahmen, KopfBreadcrumb, KopfChip, KopfMenue } from './abnahme-kopf'
import { MarkierHinweis, MarkierKnopf } from './artefakt-markieren'
import type { ArtefaktTab } from './werkbank-artefakt-dokument'

export function ArtefaktKopf({ familie, tab, kuration, libraryId, onKuriert }: {
  /** Effektive Familie (Report + Overrides). */
  familie: TwinFamilySummary
  tab: ArtefaktTab
  kuration: UseArtefaktKurationResult
  libraryId: string
  /** Nach jeder erfolgreichen Kuration: Art + frischer Zustand (Sprung). */
  onKuriert: (art: PruefbareArt, frisch: LeadingArtifactSummary) => void
}) {
  const { toast } = useToast()
  const art: PruefbareArt | null = tab === 'original' ? null : tab
  const artefakt: LeadingArtifactSummary | null | undefined = art === null ? null : familie[art]
  const key = art !== null && artefakt != null ? artefaktKey(familie.sourceId, artefakt) : null
  const pending = key !== null && kuration.pendingKey === key
  const fehler = key === null ? undefined : kuration.fehler.get(key)
  const zustand = artefakt == null ? null : artefaktZustand(artefakt)
  const geprueft = zustand === 'geprueft'
  const markiert = zustand === 'markiert'
  const archivHref = `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(familie.folderId)}`

  const verifizierenTitle =
    tab === 'original'
      ? 'Das Original traegt kein Haekchen — Transkript oder Zusammenfassung waehlen (Entscheidung 4).'
      : artefakt === undefined
        ? 'Report aus einem Scan vor A2 — erst „Neu scannen".'
        : artefakt === null
          ? `Kein ${tab === 'transkript' ? 'Transkript' : 'Zusammenfassung'} vorhanden — hier fehlt das Artefakt, nicht die Pruefung.`
          : geprueft
            ? `Bereits geprueft von ${artefakt.verifiedBy ?? '—'}.`
            : markiert
              ? 'Verifizieren loest die Fehler-Markierung auf — erst reparieren (lassen), dann bestaetigen.'
              : 'Freiwillig: bestaetigt, dass du diesen Teil wirklich angesehen hast (verified_by + verified_at).'

  const verifiziere = async () => {
    if (art === null || artefakt == null) return
    const frisch = await kuration.verifiziere(familie, artefakt)
    if (frisch !== null) onKuriert(art, frisch)
  }

  const markiere = async (notiz: string) => {
    if (art === null || artefakt == null) return
    const frisch = await kuration.markiere(familie, artefakt, notiz)
    if (frisch !== null) onKuriert(art, frisch)
  }

  const copySourceId = async () => {
    try {
      await navigator.clipboard.writeText(familie.sourceId)
      toast({ title: 'sourceId kopiert', description: 'Fuer MCP-/Twin-Werkzeuge.' })
    } catch (error) {
      toast({ title: 'Kopieren fehlgeschlagen', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    }
  }

  return (
    <AbnahmeKopfRahmen
      zeile1={
        <>
          <h2 className="min-w-0 truncate text-base font-semibold" title={familie.sourceName}>{familie.sourceName}</h2>
          {tab === 'original' ? (
            <KopfChip ton="stand" title="Das Original ist die Referenz, gegen die geprueft wird — es traegt kein Haekchen.">
              Referenz
            </KopfChip>
          ) : artefakt == null ? (
            <KopfChip ton="stand">{artefakt === undefined ? 'Stand unbekannt' : 'kein Artefakt'}</KopfChip>
          ) : (
            <KopfChip
              ton={markiert ? 'blockiert' : geprueft ? 'ok' : 'open'}
              title={
                markiert
                  ? `Als fehlerhaft markiert: ${artefakt.flaggedNote ?? '(ohne Notiz)'}`
                  : geprueft
                    ? `verified_by: ${artefakt.verifiedBy ?? '—'}`
                    : `Von der Maschine erzeugt (${artefakt.generatedBy ?? '—'}), von niemandem beanstandet — Vertrauensstufe: ${verificationLabel(artefakt.verification)}`
              }
            >
              {markiert ? 'stimmt nicht' : geprueft ? 'geprueft' : 'angenommen'}
            </KopfChip>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {!markiert && art !== null && (
              <MarkierKnopf artefakt={artefakt} pending={pending} onMarkiere={markiere} />
            )}
            <span title={verifizierenTitle} className="inline-flex">
              <Button size="sm" className="h-7" disabled={artefakt == null || geprueft || pending} onClick={() => void verifiziere()}>
                {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
                Verifizieren
              </Button>
            </span>
            <KopfMenue label={`Menue zu ${familie.sourceName}`}>
              {artefakt != null && (
                <select
                  aria-label={`twin_status von ${familie.sourceName}`}
                  value={artefakt.twinStatus ?? ''}
                  disabled={pending}
                  onChange={(event) => {
                    if (event.target.value !== '') void kuration.setzeTwinStatus(familie, artefakt, event.target.value)
                  }}
                  className="h-7 w-full rounded-md border bg-background px-1.5 text-xs text-muted-foreground"
                >
                  {artefakt.twinStatus === null && <option value="" disabled>{twinStatusLabel(null)}</option>}
                  {artefakt.twinStatus !== null && !(TWIN_STATUS_VALUES as readonly string[]).includes(artefakt.twinStatus) && (
                    <option value={artefakt.twinStatus} disabled>{twinStatusLabel(artefakt.twinStatus)}</option>
                  )}
                  {TWIN_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>twin_status: {twinStatusLabel(status)}</option>
                  ))}
                </select>
              )}
              <a href={archivHref} className="flex items-center gap-1 px-1 py-0.5 underline-offset-2 hover:underline">
                Im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-xs" onClick={() => void copySourceId()}>
                <ClipboardCopy className="mr-1 h-3 w-3" aria-hidden /> sourceId kopieren
              </Button>
            </KopfMenue>
          </span>
        </>
      }
      zeile2={
        <>
          <KopfBreadcrumb path={familie.path} />
          <span className="ml-auto">
            <KopfChip ton="stand" title="ADR 0006: Der Sprung sucht den naechsten markierten Fehler. Ist keiner mehr offen, bleibt die Auswahl stehen — Lesen erzeugt keine Schuld.">
              Sprung: naechster Widerstand
            </KopfChip>
          </span>
        </>
      }
      kinder={
        <>
          {markiert && artefakt != null && <MarkierHinweis artefakt={artefakt} />}
          {fehler && (
            <p className="rounded-md bg-red-600/10 px-2 py-1.5 text-sm text-red-700 dark:text-red-400" role="alert">
              {fehler}
            </p>
          )}
        </>
      }
    />
  )
}
