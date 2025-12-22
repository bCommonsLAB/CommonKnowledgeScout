'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DebugPanel } from './debug-panel'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import type { QueryLog } from '@/types/query-log'

interface QueryDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  queryId: string
}

/**
 * Dialog zur Anzeige von Debug-Informationen für eine Chat-Query
 */
export function QueryDetailsDialog({
  open,
  onOpenChange,
  libraryId,
  queryId,
}: QueryDetailsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryLog, setQueryLog] = useState<QueryLog | null>(null)

  // Daten-Lade-Funktion für Debug-Daten
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const debugRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`)
      if (!debugRes.ok) {
        const errorText = await debugRes.text()
        throw new Error(`Fehler beim Laden der Debug-Daten: ${debugRes.status} - ${errorText}`)
      }
      const debugData = await debugRes.json() as QueryLog
      setQueryLog(debugData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      console.error('[QueryDetailsDialog] Fehler beim Laden:', e)
    } finally {
      setLoading(false)
    }
  }, [libraryId, queryId])

  // Lade Daten automatisch, wenn Dialog geöffnet wird
  useEffect(() => {
    if (open && !queryLog) {
      loadData()
    }
    // Reset beim Schließen
    if (!open) {
      setQueryLog(null)
      setError(null)
    }
  }, [open, queryLog, loadData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Query Details</DialogTitle>
          <DialogDescription>
            Debug-Informationen zur Antwortgenerierung
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">Lade Daten...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-destructive p-4 bg-destructive/10 rounded border border-destructive/20 my-4">
            <p className="font-medium mb-2">Fehler beim Laden</p>
            <p className="text-xs whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {!loading && !error && queryLog && (
          <ScrollArea className="h-[500px] mt-4">
            <DebugPanel log={queryLog} />
          </ScrollArea>
        )}

        {!loading && !error && !queryLog && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Keine Daten verfügbar</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

