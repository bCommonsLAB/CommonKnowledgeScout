'use client'

/**
 * @fileoverview Agentensicht: Aktuell + Werkbank + Baum + Zyklus-Board, read-only.
 *
 * @description
 * Konsumiert AUSSCHLIESSLICH die Coverage-API — kein Provider, kein
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
 * Seit Welle A1 traegt der Bildschirm ueber der Arbeitsflaeche hoechstens
 * zwei Zeilen: den einzeiligen {@link AgentViewKopf} und die Tab-Leiste. Die
 * frueheren Bloecke „Wessen Arbeit?" und die acht Kennzahlen sind aufgeloest
 * — Akteur-Zahlen in den Werkbank-Leerzustand, Konventionen und Gap-Budget
 * in das Aufklapp-Element des Kopfes.
 *
 * @module components/library/agent-view
 */

import { parseAsStringLiteral, useQueryState } from 'nuqs'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ks/ui'
import { useCoverageReport } from '@/hooks/agent-view/use-coverage-report'
import { AgentViewKopf } from './agent-view-kopf'
import { AktuellPanel } from './aktuell/aktuell-panel'
import { CoverageTree } from './coverage-tree'
import { TodoListsPanel } from './todo-lists-panel'
import { WerkbankPanel } from './werkbank/werkbank-panel'
import { ZyklusBoard } from './zyklus-board'

const TAB_WERTE = ['aktuell', 'werkbank', 'baum', 'board', 'todos'] as const
type AgentViewTab = (typeof TAB_WERTE)[number]

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
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TAB_WERTE).withDefault('aktuell'))

  if (!libraryId) {
    return <p className="p-6 text-sm text-muted-foreground">Bitte zuerst eine Library auswaehlen.</p>
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      <AgentViewKopf daten={data} isLoading={isLoading} isScanning={isScanning} onScan={() => void scan()} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Coverage nicht verfuegbar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data?.gapsTruncated && (
        <Alert>
          <AlertTitle>Befundliste gekappt</AlertTitle>
          <AlertDescription>
            Gespeichert sind {data.report.gaps.length} von {data.totalGaps} Befunden. Die Zaehler des Reports
            (Karten im Leerzustand, &bdquo;Scan-Details&ldquo; im Kopf) sind vollstaendig; nur die Befundliste ist gekappt.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !data && <p className="text-sm text-muted-foreground">Lade juengsten Report...</p>}

      {neverScanned && !data && (
        <Alert>
          <AlertTitle>Noch kein Scan</AlertTitle>
          <AlertDescription>
            Fuer diese Library gibt es noch keinen Coverage-Report. &bdquo;Neu scannen&ldquo; berechnet ihn &mdash; der Report ist
            abgeleitet und jederzeit wegwerfbar.
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <Tabs value={tab} onValueChange={(wert) => void setTab(wert as AgentViewTab)} className="flex-1">
          <TabsList>
            <TabsTrigger value="aktuell">Aktuell</TabsTrigger>
            <TabsTrigger value="werkbank">Werkbank</TabsTrigger>
            <TabsTrigger value="baum">Baum</TabsTrigger>
            <TabsTrigger value="board">Zyklus-Board</TabsTrigger>
            <TabsTrigger value="todos">Todos &amp; Auftrag</TabsTrigger>
          </TabsList>
          <TabsContent value="aktuell" className="mt-3">
            <AktuellPanel report={data.report} generatedAt={data.generatedAt} />
          </TabsContent>
          <TabsContent value="werkbank" className="mt-3">
            <WerkbankPanel
              report={data.report}
              generatedAt={data.generatedAt}
              libraryLabel={libraryLabel ?? libraryId}
              localRootPath={localRootPath ?? null}
              teilbaumScan={{ onScan: (folderId) => void scan(folderId), isScanning, hinweis: scanHinweis }}
              konfigurierteThemen={konfigurierteThemen}
            />
          </TabsContent>
          <TabsContent value="baum" className="mt-3">
            <CoverageTree report={data.report} />
          </TabsContent>
          <TabsContent value="board" className="mt-3">
            <ZyklusBoard report={data.report} />
          </TabsContent>
          <TabsContent value="todos" className="mt-3">
            <TodoListsPanel
              report={data.report}
              generatedAt={data.generatedAt}
              libraryLabel={libraryLabel ?? libraryId}
              localRootPath={localRootPath ?? null}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
