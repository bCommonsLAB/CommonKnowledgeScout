'use client'

/**
 * @fileoverview Werkbank-Panel (F6, Welle W3): Master-Detail-Geruest.
 *
 * @description
 * Links Filterleiste + virtualisierte Vorhaben-Liste, rechts das Detail
 * (W3: Platzhalter — Bericht/Befunde/Familien kommen in W4). Filter, Suche,
 * Sortierung und Auswahl wohnen in der URL (`nuqs`, §F6: die Arbeits-
 * situation ist teilbar und uebersteht Reload, Akzeptanzkriterium 5);
 * Pane-Groessen in `uiPanePrefsAtom` (Jotai, nur UI-Praeferenz). Mobil wird
 * gestapelt: Auswahl wechselt in die Detail-Ansicht, „Zur Liste" fuehrt
 * zurueck. Reports aus Scans vor W1 werden sichtbar benannt.
 *
 * Welle A2: Die Liste ist ein Baum bis zum Artefakt (Bereich → Vorhaben →
 * Ordner → Artefakt); das gewaehlte Artefakt steht als `?artefakt=` mit in
 * der URL. Die Baum-Daten rechnet `useWerkbankBaum`.
 *
 * @module components/library/agent-view
 */

import { useMemo } from 'react'
import { useWerkbankBaum } from '@/hooks/agent-view/use-werkbank-baum'
import { useWerkbankListe } from '@/hooks/agent-view/use-werkbank-liste'
import { useWerkbankUrlState } from '@/hooks/agent-view/use-werkbank-url-state'
import type { CoverageReport } from '@/lib/agent-view/types'
import { karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'
import { filtereVorhaben, sortiereVorhaben, type BefundFilter } from '@/lib/agent-view/werkbank-filter'
import { beschreibeLeereWerkbankListe } from '@/lib/agent-view/werkbank-leer'
import { VorhabenListe } from './vorhaben-liste'
import type { TeilbaumScanProps } from './teilbaum-scan-knopf'
import { WerkbankDetail } from './werkbank-detail'
import { WerkbankFilterLeiste } from './werkbank-filter-leiste'
import { WerkbankLayout } from './werkbank-layout'
import { WerkbankListenBereich } from './werkbank-listen-bereich'

export interface WerkbankPanelProps {
  report: CoverageReport
  /** Zeitstempel des gespeicherten Reports (Fusszeile + Auftragskontext). */
  generatedAt: string
  libraryLabel: string
  /** `config.agentView.localRootPath` — absolute Pfade im Auftrag (F3). */
  localRootPath: string | null
  /** W8 (F10): Teilbaum-Scan aus dem Detail — merged in den Voll-Report. */
  teilbaumScan?: TeilbaumScanProps
}

export function WerkbankPanel({ report, generatedAt, libraryLabel, localRootPath, teilbaumScan }: WerkbankPanelProps) {
  const {
    vorhabenId, setVorhabenId, artefaktId, setArtefaktId, statusFilter, setStatusFilter,
    akteur, setAkteur, schritt, setSchritt, suche, setSuche, sortierung, setSortierung,
    gruppierung, setGruppierung, listeId, setListeId,
  } = useWerkbankUrlState()
  const baum = useWerkbankBaum(report)
  const arbeitsliste = useWerkbankListe({
    libraryId: report.libraryId,
    vorhaben: report.vorhaben,
    aktiv: statusFilter === 'liste',
    listeId,
  })

  const befundFilter: BefundFilter = useMemo(
    () => ({ akteur, zyklusSchritt: schritt }),
    [akteur, schritt],
  )
  const gefiltert = useMemo(
    () => filtereVorhaben(report.vorhaben, { statusFilter, befundFilter, suche, listenMitglieder: arbeitsliste.mitglieder }),
    [report.vorhaben, statusFilter, befundFilter, suche, arbeitsliste.mitglieder],
  )
  const sortiert = useMemo(
    () => sortiereVorhaben(gefiltert.zeilen, sortierung),
    [gefiltert.zeilen, sortierung],
  )
  const leerText = beschreibeLeereWerkbankListe({
    gefiltert: sortiert.length,
    gesamt: report.vorhaben.length,
    statusFilter,
    befundFilter,
    suche,
    nichtAuswertbar: gefiltert.nichtAuswertbar,
    scoped: report.scope.folderId !== null,
    scopePath: report.scope.path ?? null,
    liste:
      statusFilter === 'liste'
        ? {
            name: arbeitsliste.aktiveListe?.name ?? null,
            mitglieder: arbeitsliste.aktiveListe?.folders.length ?? 0,
            tote: arbeitsliste.kreuzung?.tote.length ?? 0,
          }
        : undefined,
  })
  const karte = vorhabenId === null
    ? null
    : report.vorhaben.find((k) => k.folderId === vorhabenId) ?? null

  const liste = (
    <div className="flex h-full min-h-0 flex-col">
      <WerkbankFilterLeiste
        statusFilter={statusFilter}
        onStatusFilter={(wert) => void setStatusFilter(wert)}
        befundFilter={befundFilter}
        onBefundFilter={(wert) => {
          void setAkteur(wert.akteur)
          void setSchritt(wert.zyklusSchritt)
        }}
        suche={suche}
        onSuche={(wert) => void setSuche(wert)}
        sortierung={sortierung}
        onSortierung={(wert) => void setSortierung(wert)}
        gruppierung={gruppierung}
        onGruppierung={(wert) => void setGruppierung(wert)}
      />
      {statusFilter === 'liste' && (
        <WerkbankListenBereich arbeitsliste={arbeitsliste} onWaehleListe={(id) => void setListeId(id)} />
      )}
      <div className="min-h-0 flex-1">
        <VorhabenListe
          karten={sortiert}
          gruppierung={gruppierung}
          leerText={leerText}
          auswahlId={vorhabenId}
          onSelect={(folderId) => {
            void setVorhabenId(folderId)
            void setArtefaktId(null)
          }}
          gepinnteIds={arbeitsliste.mitglieder}
          onPin={(card) => void arbeitsliste.pinToggle(card)}
          baum={{
            zeilenFuer: baum.zeilenFuer,
            zaehlerFuer: baum.zaehlerFuer,
            artefaktAuswahlId: artefaktId,
            onSelectArtefakt: (ownerId, familie) => {
              void setVorhabenId(ownerId)
              void setArtefaktId(familie.sourceId)
            },
          }}
        />
      </div>
    </div>
  )
  const detail = (
    <WerkbankDetail
      karte={karte}
      vorhabenId={vorhabenId}
      report={report}
      generatedAt={generatedAt}
      libraryLabel={libraryLabel}
      localRootPath={localRootPath}
      teilbaumScan={teilbaumScan}
    />
  )

  return (
    // Feste Hoehe: der Virtualizer braucht einen messbaren Scroll-Container,
    // der Panel-Wurzelcontainer waechst aber frei (overflow-auto am Tab).
    // A1: ueber der Arbeitsflaeche stehen nur noch Kopfzeile und Tab-Leiste —
    // der Abzug schrumpft entsprechend (vorher 16rem mit Kennzahlen-Bloecken).
    <div className="flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col gap-2">
      {report.vorhaben.some(karteOhneWerkbankFelder) && (
        <p className="text-xs text-muted-foreground">
          Dieser Report stammt aus einem Scan vor Werkbank-Welle W1 — Ampel, Bericht-Titel/-Status und Themen
          erscheinen nach &bdquo;Neu scannen&ldquo;; der Filter &bdquo;Zu tun&ldquo; ist bis dahin nicht auswertbar.
        </p>
      )}
      <WerkbankLayout
        liste={liste}
        detail={detail}
        detailAktiv={vorhabenId !== null}
        onZurListe={() => {
          void setVorhabenId(null)
          void setArtefaktId(null)
        }}
      />
    </div>
  )
}
