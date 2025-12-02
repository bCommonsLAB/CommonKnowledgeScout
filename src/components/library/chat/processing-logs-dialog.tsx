'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProcessingStatus } from './processing-status'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import type { ChatProcessingStep } from '@/types/chat-processing'

interface ProcessingLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  queryId: string
}

/**
 * Dialog zur Anzeige der Verarbeitungsschritte einer Chat-Antwort
 * Lädt die Logs direkt aus dem Query-Dokument beim Öffnen des Dialogs
 */
export function ProcessingLogsDialog({
  open,
  onOpenChange,
  libraryId,
  queryId,
}: ProcessingLogsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<ChatProcessingStep[]>([])

  // Daten-Lade-Funktion mit useCallback
  const loadLogs = useCallback(async () => {
    if (!queryId || !libraryId) {
      setError('Query-ID oder Library-ID fehlt')
      return
    }

    setLoading(true)
    setError(null)


    try {
      // Lade Query-Dokument aus dem API-Endpoint
      const url = `/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`
      
      const res = await fetch(url, { cache: 'no-store' })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[ProcessingLogsDialog] Response Error:', errorText)
        throw new Error(`Fehler beim Laden der Logs: ${res.status} - ${errorText}`)
      }
      
      const queryData = await res.json()
      
      if (Array.isArray(queryData.processingLogs) && queryData.processingLogs.length > 0) {
        setSteps(queryData.processingLogs)
      } else {
        console.warn('[ProcessingLogsDialog] Keine Logs gefunden oder leer:', queryData.processingLogs)
        setSteps([])
        setError('Keine Verarbeitungsprotokolle verfügbar')
      }
    } catch (e) {
      console.error('[ProcessingLogsDialog] Fehler beim Laden:', e)
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden der Logs')
      setSteps([])
    } finally {
      setLoading(false)
    }
  }, [libraryId, queryId])

  // Lade Logs automatisch, wenn Dialog geöffnet wird
  useEffect(() => {
    if (open && queryId && libraryId) {
      loadLogs()
    } else if (!open) {
      // Reset beim Schließen
      setSteps([])
      setError(null)
    }
  }, [open, queryId, libraryId, loadLogs])


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Verarbeitungsschritte</DialogTitle>
          <DialogDescription>
            So wurde diese Antwort generiert
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">Lade Verarbeitungsprotokoll...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-destructive p-4 bg-destructive/10 rounded border border-destructive/20 my-4">
            <p className="font-medium mb-2">Fehler beim Laden</p>
            <p className="text-xs whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {!loading && !error && steps.length > 0 && (
          <ScrollArea className="flex-1 min-h-0 p-4">
            <ProcessingStatus steps={steps} isActive={false} />
          </ScrollArea>
        )}

        {!loading && !error && steps.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">Keine Verarbeitungsschritte verfügbar</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


