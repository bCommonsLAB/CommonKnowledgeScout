'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
 * Dialog zur Anzeige von Debug- und Explain-Informationen für eine Chat-Query
 */
export function QueryDetailsDialog({
  open,
  onOpenChange,
  libraryId,
  queryId,
}: QueryDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'explain' | 'debug'>('explain')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryLog, setQueryLog] = useState<QueryLog | null>(null)
  const [explanation, setExplanation] = useState<string>('')

  // Daten-Lade-Funktion mit useCallback, um stabile Referenz zu gewährleisten
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Debug-Daten laden
      const debugRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`)
      if (!debugRes.ok) {
        const errorText = await debugRes.text()
        throw new Error(`Fehler beim Laden der Debug-Daten: ${debugRes.status} - ${errorText}`)
      }
      const debugData = await debugRes.json() as QueryLog
      setQueryLog(debugData)

      // Explain-Daten laden
      const explainRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}/explain`)
      if (!explainRes.ok) {
        const errorText = await explainRes.text()
        throw new Error(`Fehler beim Laden der Erklärung: ${explainRes.status} - ${errorText}`)
      }
      const explainData = await explainRes.json() as { explanation: string }
      setExplanation(explainData.explanation)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      // Besseres Error-Logging für Debugging
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
  }, [open, queryLog, loadData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Query Details</DialogTitle>
          <DialogDescription>
            Debug-Informationen und Erklärung zur Antwortgenerierung
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'explain' | 'debug')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="explain">Erklärung</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>
            
            <TabsContent value="explain" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-[500px] rounded border p-4">
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {explanation || 'Keine Erklärung verfügbar'}
                  </p>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="debug" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-[500px]">
                <DebugPanel log={queryLog} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
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

