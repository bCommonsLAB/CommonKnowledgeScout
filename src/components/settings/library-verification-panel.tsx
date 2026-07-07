'use client'

/**
 * Experten-Panel „Verifikation" (Welle A2).
 *
 * Zeigt den aktuellen Status der aktiven Library und erlaubt Prüfen bzw.
 * Reparieren (auto-fixbare Fälle) mit Live-Fortschritt (SSE). Nach einem Lauf
 * wird der persistierte Status neu geladen. Die UI kennt nur die API.
 */

import { useAtomValue } from 'jotai'
import { Loader2, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activeLibraryAtom } from '@/atoms/library-atom'
import { LibraryVerificationBadgeView } from '@/components/library/library-verification-badge'
import { LibraryVerificationDetails } from '@/components/settings/library-verification-details'
import { useLibraryVerificationStatus } from '@/hooks/library-verification/use-library-verification-status'
import { useLibraryVerificationRun } from '@/hooks/library-verification/use-library-verification-run'
import type { VerificationSummary } from '@/lib/library-verification/types'

function SummaryView({ summary }: { summary: VerificationSummary }) {
  const codes = Object.entries(summary.issuesByCode)
  return (
    <div className="rounded-md border p-3 text-sm space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>Geprüft: <strong className="text-foreground">{summary.scanned}</strong></span>
        <span>Sauber: <strong className="text-foreground">{summary.ok}</strong></span>
        <span>Mit Befund: <strong className="text-foreground">{summary.withIssues}</strong></span>
        <span>Auto-fixbar: <strong className="text-foreground">{summary.autoFixable}</strong></span>
        {summary.repairedDocuments > 0 && (
          <span>Repariert: <strong className="text-foreground">{summary.repairedDocuments}</strong></span>
        )}
      </div>
      {codes.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {codes.map(([code, count]) => (
            <li key={code}>{code}: {count}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function LibraryVerificationPanel() {
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryId = activeLibrary?.id
  const { status, summary, documents, lastRunAt, isLoading, error, refresh } =
    useLibraryVerificationStatus(libraryId, !!libraryId)
  const { state, run } = useLibraryVerificationRun(libraryId)

  if (!activeLibrary) {
    return <p className="text-sm text-muted-foreground">Keine aktive Bibliothek gewählt.</p>
  }

  const busy = state.isRunning
  const effectiveSummary = state.resultSummary ?? summary

  async function handleRun(mode: 'check' | 'repair') {
    await run(mode)
    await refresh()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Prüft alle Dokumente gegen Basis-Felder, die Pflichtfelder ihres Inhaltstyps
        und die Facetten-Stimmigkeit. „Reparieren“ normalisiert nur eindeutig
        auto-fixbare Fälle — fehlende Pflichtwerte bleiben für die manuelle Korrektur.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Status:</span>
        {status ? <LibraryVerificationBadgeView status={status} /> : (
          <span className="text-sm text-muted-foreground">{isLoading ? 'lädt…' : '—'}</span>
        )}
        {lastRunAt && (
          <span className="text-xs text-muted-foreground">
            zuletzt: {new Date(lastRunAt).toLocaleString('de-DE')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => handleRun('check')}>
          {busy && state.mode === 'check' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Prüfen{busy && state.mode === 'check' ? ` (${state.current}/${state.total})` : ''}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => handleRun('repair')}>
          {busy && state.mode === 'repair' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wrench className="h-4 w-4 mr-2" />
          )}
          Reparieren{busy && state.mode === 'repair' ? ` (${state.current}/${state.total})` : ''}
        </Button>
      </div>

      {(error || state.error) && (
        <p className="text-sm text-destructive">{state.error || error}</p>
      )}

      {effectiveSummary && <SummaryView summary={effectiveSummary} />}
      {/* Detail-Log: Befunde je Feld + betroffene Dokumente (nach refresh()). */}
      {effectiveSummary && (
        <LibraryVerificationDetails summary={effectiveSummary} documents={documents} />
      )}
    </div>
  )
}
