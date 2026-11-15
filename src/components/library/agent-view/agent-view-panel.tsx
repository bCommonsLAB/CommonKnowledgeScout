'use client'

/**
 * @fileoverview Agentensicht: Aktuell + Werkbank + Baum + Zyklus-Board + Todos + Sitzungen.
 *
 * @description
 * Konsumiert AUSSCHLIESSLICH die Coverage-API und (Reiter „Sitzungen") die
 * Sitzungs-Route — kein Provider, kein
 * `primaryStore`, kein Storage-Backend (Akzeptanzkriterium 5). Der Scan ist
 * ein expliziter Vorgang (Knopf), kein Watcher. Seit Welle W3 ist die
 * Werkbank (F6) der Default-Tab; der Tab-Zustand wohnt in der URL (`?tab=`,
 * nuqs) statt in einem unkontrollierten `defaultValue` — Deep-Links wie
 * `?tab=werkbank&vorhaben=…` ueberstehen Reload (v2-Akzeptanzkriterium 5).
 * Welle A7 stellt „Aktuell" davor und macht sie zum Default: Der Einstieg
 * beantwortet erst „woran arbeite ich gerade?", bevor er „was ist zu tun?"
 * zeigt. Die Werkbank bleibt einen Klick entfernt, `?tab=werkbank` unveraendert
 * gueltig.
 *
 * Welle R3 (W8): Die Reiterleiste haengt nicht mehr am Report. Nur die
 * Report-Reiter warten auf ihn ({@link ReportGate}); der Reiter „Sitzungen"
 * liest das Sitzungs-Register ueber seine eigene Route und steht auch ohne
 * Scan zur Verfuegung.
 *
 * Seit Welle A1 traegt der Bildschirm ueber der Arbeitsflaeche hoechstens
 * zwei Zeilen: den einzeiligen {@link AgentViewKopf} und die Tab-Leiste. Die
 * frueheren Bloecke „Wessen Arbeit?" und die acht Kennzahlen sind aufgeloest
 * — Akteur-Zahlen in den Werkbank-Leerzustand, Konventionen und Gap-Budget
 * in das Aufklapp-Element des Kopfes.
 *
 * @module components/library/agent-view
 */

import type { ReactNode } from 'react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ks/ui'
import { useCoverageReport, type CoverageResponse } from '@/hooks/agent-view/use-coverage-report'
import { AgentViewKopf } from './agent-view-kopf'
import { ReportGate } from './agent-view-report-gate'
import { AGENT_VIEW_TABS, type AgentViewTab } from './agent-view-tabs'
import { AktuellPanel } from './aktuell/aktuell-panel'
import { CoverageTree } from './coverage-tree'
import { SitzungenPanel } from './sitzungen/sitzungen-panel'
import { TodoListsPanel } from './todo-lists-panel'
import { WerkbankPanel } from './werkbank/werkbank-panel'
import { ZyklusBoard } from './zyklus-board'

export interface AgentViewPanelProps {
  libraryId: string | undefined
  /** Anzeigename der Library (Kontextkopf des Auftrags-Generators). */
  libraryLabel?: string
  /** `config.agentView.localRootPath` — absolute Pfade im Auftrag (F3). */
  localRootPath?: string | null
  /** A6: kuratiertes Themen-Vokabular (`config.agentView.themen`). */
  konfigurierteThemen?: string[]
}

export function AgentViewPanel({ libraryId, libraryLabel, localRootPath, konfigurierteThemen }: AgentViewPanelProps) {
  const { data, isLoading, isScanning, neverScanned, error, scanHinweis, scan } = useCoverageReport(libraryId)
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(AGENT_VIEW_TABS).withDefault('aktuell'))

  if (!libraryId) {
    return <p className="p-6 text-sm text-muted-foreground">Bitte zuerst eine Library auswaehlen.</p>
  }

  const mitReport = (inhalt: (daten: CoverageResponse) => ReactNode) => (
    <ReportGate daten={data} isLoading={isLoading} neverScanned={neverScanned} error={error}>{inhalt}</ReportGate>
  )

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <AgentViewKopf daten={data} isLoading={isLoading} isScanning={isScanning} onScan={() => void scan()} />

      <Tabs value={tab} onValueChange={(wert) => void setTab(wert as AgentViewTab)} className="flex-1">
        <TabsList>
          <TabsTrigger value="aktuell">Aktuell</TabsTrigger>
          <TabsTrigger value="werkbank">Werkbank</TabsTrigger>
          <TabsTrigger value="baum">Baum</TabsTrigger>
          <TabsTrigger value="board">Zyklus-Board</TabsTrigger>
          <TabsTrigger value="todos">Todos &amp; Auftrag</TabsTrigger>
          <TabsTrigger value="sitzungen" className="gap-1.5">
            Sitzungen
            <span className="rounded bg-orange-50 px-1.5 text-[10px] font-medium leading-[15px] text-orange-700 dark:bg-orange-500/10 dark:text-orange-400">neu</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="aktuell" className="mt-3">
          {mitReport((d) => <AktuellPanel report={d.report} />)}
        </TabsContent>
        <TabsContent value="werkbank" className="mt-3">
          {mitReport((d) => (
            <WerkbankPanel
              report={d.report}
              generatedAt={d.generatedAt}
              libraryLabel={libraryLabel ?? libraryId}
              localRootPath={localRootPath ?? null}
              teilbaumScan={{ onScan: (folderId) => void scan(folderId), isScanning, hinweis: scanHinweis }}
              konfigurierteThemen={konfigurierteThemen}
            />
          ))}
        </TabsContent>
        <TabsContent value="baum" className="mt-3">
          {mitReport((d) => <CoverageTree report={d.report} />)}
        </TabsContent>
        <TabsContent value="board" className="mt-3">
          {mitReport((d) => <ZyklusBoard report={d.report} />)}
        </TabsContent>
        <TabsContent value="todos" className="mt-3">
          {mitReport((d) => (
            <TodoListsPanel
              report={d.report}
              generatedAt={d.generatedAt}
              libraryLabel={libraryLabel ?? libraryId}
              localRootPath={localRootPath ?? null}
            />
          ))}
        </TabsContent>
        <TabsContent value="sitzungen" className="mt-3">
          <SitzungenPanel libraryId={libraryId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
