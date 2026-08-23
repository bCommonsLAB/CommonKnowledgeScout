'use client'

/**
 * @fileoverview Agentensicht: Werkbank + Baum + Zyklus-Board, read-only.
 *
 * @description
 * Konsumiert AUSSCHLIESSLICH die Coverage-API — kein Provider, kein
 * `primaryStore`, kein Storage-Backend (Akzeptanzkriterium 5). Der Scan ist
 * ein expliziter Vorgang (Knopf), kein Watcher. Seit Welle W3 ist die
 * Werkbank (F6) der Default-Tab; der Tab-Zustand wohnt in der URL (`?tab=`,
 * nuqs) statt in einem unkontrollierten `defaultValue` — Deep-Links wie
 * `?tab=werkbank&vorhaben=…` ueberstehen Reload (v2-Akzeptanzkriterium 5).
 *
 * @module components/library/agent-view
 */

import { Loader2, RefreshCw } from 'lucide-react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCoverageReport } from '@/hooks/agent-view/use-coverage-report'
import { CoverageSummary } from './coverage-summary'
import { CoverageProgress } from './coverage-progress'
import { CoverageTree } from './coverage-tree'
import { TodoListsPanel } from './todo-lists-panel'
import { WerkbankPanel } from './werkbank/werkbank-panel'
import { ZyklusBoard } from './zyklus-board'

const TAB_WERTE = ['werkbank', 'baum', 'board', 'todos'] as const
type AgentViewTab = (typeof TAB_WERTE)[number]

export interface AgentViewPanelProps {
  libraryId: string | undefined
  /** Anzeigename der Library (Kontextkopf des Auftrags-Generators). */
  libraryLabel?: string
  /** `config.agentView.localRootPath` — absolute Pfade im Auftrag (F3). */
  localRootPath?: string | null
}

export function AgentViewPanel({ libraryId, libraryLabel, localRootPath }: AgentViewPanelProps) {
  const { data, isLoading, isScanning, neverScanned, error, scan } = useCoverageReport(libraryId)
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TAB_WERTE).withDefault('werkbank'))

  if (!libraryId) {
    return <p className="p-6 text-sm text-muted-foreground">Bitte zuerst eine Library auswaehlen.</p>
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Agentensicht</h1>
          <p className="text-sm text-muted-foreground">
            Das Archiv zeigt die Dateien — diese Sicht zeigt, was ein Agent davon versteht und was ihm fehlt.
          </p>
        </div>
        <Button onClick={() => void scan()} disabled={isScanning || isLoading}>
          {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Neu scannen
        </Button>
      </header>

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
            Gespeichert sind {data.report.gaps.length} von {data.totalGaps} Befunden. Die Zaehler oben sind vollstaendig.
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
        <>
          {/* D1: Hauptanzeige zuerst — wessen Arbeit, welcher Schritt, was ist neu. */}
          <CoverageProgress report={data.report} delta={data.delta} deltaHinweis={data.deltaHinweis} />
          <CoverageSummary report={data.report} generatedAt={data.generatedAt} />
          <Tabs value={tab} onValueChange={(wert) => void setTab(wert as AgentViewTab)} className="flex-1">
            <TabsList>
              <TabsTrigger value="werkbank">Werkbank</TabsTrigger>
              <TabsTrigger value="baum">Baum</TabsTrigger>
              <TabsTrigger value="board">Zyklus-Board</TabsTrigger>
              <TabsTrigger value="todos">Todos &amp; Auftrag</TabsTrigger>
            </TabsList>
            <TabsContent value="werkbank" className="mt-3">
              <WerkbankPanel report={data.report} />
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
        </>
      )}
    </div>
  )
}
