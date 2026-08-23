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
 * @module components/library/agent-view
 */

import { useMemo } from 'react'
import { useAtom } from 'jotai'
import { ArrowLeft } from 'lucide-react'
import { parseAsNumberLiteral, parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { uiPanePrefsAtom } from '@/atoms/ui-prefs-atom'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { CoverageReport } from '@/lib/agent-view/types'
import { karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'
import { filtereVorhaben, sortiereVorhaben, type BefundFilter } from '@/lib/agent-view/werkbank-filter'
import { beschreibeLeereWerkbankListe } from '@/lib/agent-view/werkbank-leer'
import { VorhabenListe } from './vorhaben-liste'
import { WerkbankDetail } from './werkbank-detail'
import { WerkbankFilterLeiste } from './werkbank-filter-leiste'

const STATUS_WERTE = ['alle', 'zu_tun', 'bereit'] as const
const SORT_WERTE = ['pfad', 'stand', 'befunde'] as const
const AKTEUR_WERTE = ['mensch', 'cowork', 'knowledgescout'] as const
const SCHRITT_WERTE = [1, 2, 3, 4] as const

export interface WerkbankPanelProps {
  report: CoverageReport
  /** Zeitstempel des gespeicherten Reports (Fusszeile + Auftragskontext). */
  generatedAt: string
  libraryLabel: string
  /** `config.agentView.localRootPath` — absolute Pfade im Auftrag (F3). */
  localRootPath: string | null
}

export function WerkbankPanel({ report, generatedAt, libraryLabel, localRootPath }: WerkbankPanelProps) {
  const [prefs, setPrefs] = useAtom(uiPanePrefsAtom)
  const [vorhabenId, setVorhabenId] = useQueryState('vorhaben', parseAsString)
  const [statusFilter, setStatusFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(STATUS_WERTE).withDefault('zu_tun'),
  )
  const [akteur, setAkteur] = useQueryState('akteur', parseAsStringLiteral(AKTEUR_WERTE))
  const [schritt, setSchritt] = useQueryState('schritt', parseAsNumberLiteral(SCHRITT_WERTE))
  const [suche, setSuche] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 300 }),
  )
  const [sortierung, setSortierung] = useQueryState(
    'sort',
    parseAsStringLiteral(SORT_WERTE).withDefault('pfad'),
  )

  const befundFilter: BefundFilter = useMemo(
    () => ({ akteur, zyklusSchritt: schritt }),
    [akteur, schritt],
  )
  const gefiltert = useMemo(
    () => filtereVorhaben(report.vorhaben, { statusFilter, befundFilter, suche }),
    [report.vorhaben, statusFilter, befundFilter, suche],
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
      />
      <div className="min-h-0 flex-1">
        <VorhabenListe
          karten={sortiert}
          leerText={leerText}
          auswahlId={vorhabenId}
          onSelect={(folderId) => void setVorhabenId(folderId)}
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
    />
  )

  return (
    // Feste Hoehe: der Virtualizer braucht einen messbaren Scroll-Container,
    // der Panel-Wurzelcontainer waechst aber frei (overflow-auto am Tab).
    <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col gap-2">
      {report.vorhaben.some(karteOhneWerkbankFelder) && (
        <p className="text-xs text-muted-foreground">
          Dieser Report stammt aus einem Scan vor Werkbank-Welle W1 — Ampel, Bericht-Titel/-Status und Themen
          erscheinen nach &bdquo;Neu scannen&ldquo;; der Filter &bdquo;Zu tun&ldquo; ist bis dahin nicht auswertbar.
        </p>
      )}

      <div className="hidden min-h-0 flex-1 md:block">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full rounded-lg border"
          onLayout={(sizes) => setPrefs({ werkbankListeSize: sizes[0] })}
        >
          <ResizablePanel defaultSize={prefs.werkbankListeSize} minSize={20} className="min-h-0">
            {liste}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={100 - prefs.werkbankListeSize} minSize={30} className="min-h-0 overflow-y-auto">
            {detail}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border md:hidden">
        {vorhabenId === null ? (
          liste
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b p-1">
              <Button variant="ghost" size="sm" onClick={() => void setVorhabenId(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Zur Liste
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </div>
        )}
      </div>
    </div>
  )
}
