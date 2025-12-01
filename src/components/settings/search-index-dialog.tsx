'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Trash2, Plus } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface ExtendedIndexStatus {
  vectorIndex: {
    exists?: boolean
    expectedIndexName?: string
    indexName?: string
    vectorCount?: number
    metaCount?: number
    dimension?: number
    collectionName?: string
    indexStatus?: string
    error?: string
    indexDefinition?: Record<string, unknown> | null
    expectedIndexDefinition?: Record<string, unknown> | null
  }
  writeTest: {
    success?: boolean
    error?: string
    fileId?: string
  }
  readTest: {
    success?: boolean
    error?: string
    document?: {
      fileId: string
      fileName: string
      title: string
      hasFacets: boolean
    }
  }
  searchTest: {
    success?: boolean
    error?: string
    resultsCount?: number
    results?: Array<{
      id: string
      score: number
      kind: string
      fileId: string
    }>
  }
  facetTest: {
    success?: boolean
    error?: string
    facetsCount?: number
    facets?: Array<{
      metaKey: string
      valuesCount: number
      sampleValues: Array<{ value: string; count: number }>
    }>
    message?: string
  }
}

interface SearchIndexDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
}

/**
 * Dialog-Komponente für erweiterte Search-Index-Prüfung und Verwaltung.
 * Zeigt detaillierte Prüfergebnisse für Vector Index, Schreib-/Lese-Tests, Search-Tests und Facetten-Prüfung.
 */
export function SearchIndexDialog({
  open,
  onOpenChange,
  libraryId,
}: SearchIndexDialogProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [status, setStatus] = useState<ExtendedIndexStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Automatisch Status laden wenn Dialog geöffnet wird
  useEffect(() => {
    if (open && libraryId) {
      handleCheck()
    } else {
      // Status zurücksetzen wenn Dialog geschlossen wird
      setStatus(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, libraryId])

  const handleCheck = async () => {
    setIsChecking(true)
    setError(null)
    setStatus(null)
    
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/index-status-extended`, {
        method: 'GET',
        cache: 'no-store'
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json() as ExtendedIndexStatus
      setStatus(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      setError(msg)
      toast({
        title: 'Fehler',
        description: msg,
        variant: 'destructive'
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleDeleteIndex = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/index`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()
      
      toast({
        title: data.status === 'not_found' ? 'Index existiert nicht' : 'Index gelöscht',
        description: data.status === 'not_found' 
          ? 'Der Index existiert bereits nicht mehr.'
          : 'Der Index wurde erfolgreich gelöscht. Er wird beim nächsten Zugriff automatisch neu erstellt.',
        variant: data.status === 'not_found' ? 'default' : 'default'
      })
      
      // Status neu laden nach Index-Löschung
      await handleCheck()
      setShowDeleteConfirm(false)
    } catch (e) {
      toast({
        title: 'Fehler beim Löschen',
        description: e instanceof Error ? e.message : 'Unbekannter Fehler',
        variant: 'destructive'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateIndex = async () => {
    setIsCreating(true)
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/index`, {
        method: 'POST'
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        // Detaillierte Fehlerinformationen anzeigen
        const errorMsg = data?.message || data?.error || 'Fehler beim Erstellen des Index'
        const firstLine = errorMsg.split('\n')[0]
        
        toast({
          title: 'Fehler',
          description: firstLine,
          variant: 'destructive',
          duration: 10000
        })
        
        console.error('[SearchIndexDialog] Fehler beim Anlegen des Index:', {
          status: res.status,
          code: data?.code,
          message: errorMsg,
          details: data?.details,
        })
        
        // Für kritische Fehler wie Quota-Limit: Alert-Dialog anzeigen
        if (res.status === 403 && errorMsg.includes('Index-Limit')) {
          alert(`Index konnte nicht erstellt werden:\n\n${errorMsg}`)
        }
        
        setShowCreateConfirm(false)
        return
      }
      
      toast({
        title: data.status === 'exists' ? 'Index existiert bereits' : 'Index erstellt',
        description: typeof data?.index === 'object' ? JSON.stringify(data.index) : undefined
      })
      
      // Status neu laden nach Index-Erstellung
      await handleCheck()
      setShowCreateConfirm(false)
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Unbekannter Fehler',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }


  const renderTestResult = (test: { success?: boolean; error?: string }, label: string) => {
    if (test.success === undefined) return null
    
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
        {test.success ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{label}</div>
          {test.success ? (
            <div className="text-xs text-muted-foreground mt-1">Erfolgreich</div>
          ) : (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">{test.error}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Search-Index Prüfung</DialogTitle>
            <DialogDescription>
              Detaillierte Prüfung des Vector Search Index mit Schreib-/Lese-Tests und Facetten-Prüfung
            </DialogDescription>
          </DialogHeader>
          
          {/* Action Buttons - außerhalb des ScrollArea */}
          <div className="shrink-0 px-6 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleCheck}
                disabled={isChecking}
                variant="outline"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Prüfe...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Index Status prüfen
                  </>
                )}
              </Button>
              
              {status && !status.vectorIndex?.exists && (
                <Button
                  onClick={() => setShowCreateConfirm(true)}
                  disabled={isCreating || isChecking}
                  variant="default"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Erstelle...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Index anlegen
                    </>
                  )}
                </Button>
              )}
              
              {status?.vectorIndex?.exists && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  variant="destructive"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Lösche...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Index löschen
                    </>
                  )}
                </Button>
              )}
              
              {status && !status.vectorIndex?.exists && (
                <div className="text-xs text-muted-foreground px-2">
                  Der Index wird automatisch beim nächsten Zugriff erstellt.
                </div>
              )}
            </div>
          </div>

          {/* Error Display - außerhalb des ScrollArea */}
          {error && (
            <div className="shrink-0 px-6 pb-4">
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-red-900 dark:text-red-100">Fehler</div>
                    <div className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Content Area */}
          <ScrollArea className="flex-1 overflow-auto px-6 pb-6" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            <div className="space-y-4">
              {status && (
                <>
                  {/* Vector Index Status */}
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Vector Search Index</div>
                    {status.vectorIndex.exists ? (
                      <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="text-sm font-medium text-green-900 dark:text-green-100">
                              Index vorhanden
                            </div>
                            <div className="text-xs space-y-1 text-green-700 dark:text-green-300">
                              <div><span className="font-medium">Collection:</span> <span className="break-all">{status.vectorIndex.collectionName || 'N/A'}</span></div>
                              <div><span className="font-medium">Index:</span> {status.vectorIndex.indexName || status.vectorIndex.expectedIndexName}</div>
                              <div><span className="font-medium">Vektoren:</span> {(status.vectorIndex.vectorCount || 0).toLocaleString('de-DE')}</div>
                              <div><span className="font-medium">Meta-Dokumente:</span> {(status.vectorIndex.metaCount || 0).toLocaleString('de-DE')}</div>
                              <div><span className="font-medium">Dimension:</span> {status.vectorIndex.dimension}</div>
                              <div><span className="font-medium">Status:</span> {status.vectorIndex.indexStatus || 'Unknown'}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Index Schema anzeigen - nebeneinander */}
                        {(status.vectorIndex.indexDefinition || status.vectorIndex.expectedIndexDefinition) && (
                          <div className="mt-3 space-y-3">
                            {/* Vergleich-Status */}
                            {status.vectorIndex.indexDefinition && status.vectorIndex.expectedIndexDefinition && (
                              <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                                <div className="text-xs font-medium mb-2">Vergleich:</div>
                                <div className="text-xs">
                                  {JSON.stringify(status.vectorIndex.indexDefinition) === JSON.stringify(status.vectorIndex.expectedIndexDefinition) ? (
                                    <div className="text-green-600 dark:text-green-400">✓ Schemas stimmen überein</div>
                                  ) : (
                                    <div className="text-orange-600 dark:text-orange-400">
                                      ⚠ Schemas unterscheiden sich - Index muss möglicherweise neu erstellt werden
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Schemas nebeneinander */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Aktuelles Schema */}
                              {status.vectorIndex.indexDefinition && (
                                <div className="p-3 rounded-lg border bg-muted/30">
                                  <div className="text-xs font-medium mb-2">Aktuelles Schema (MongoDB):</div>
                                  <pre className="text-xs overflow-auto max-h-96 p-2 bg-background rounded border break-words whitespace-pre-wrap">
                                    {JSON.stringify(status.vectorIndex.indexDefinition, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {/* Erwartetes Schema */}
                              {status.vectorIndex.expectedIndexDefinition && (
                                <div className="p-3 rounded-lg border bg-muted/30">
                                  <div className="text-xs font-medium mb-2">Erwartetes Schema (Facetten):</div>
                                  <pre className="text-xs overflow-auto max-h-96 p-2 bg-background rounded border break-words whitespace-pre-wrap">
                                    {JSON.stringify(status.vectorIndex.expectedIndexDefinition, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-900/20">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-orange-900 dark:text-orange-100">
                              Index nicht vorhanden
                            </div>
                            <div className="text-xs space-y-1 text-orange-700 dark:text-orange-300 mt-1">
                              {status.vectorIndex.collectionName && (
                                <div><span className="font-medium">Collection:</span> <span className="break-all">{status.vectorIndex.collectionName}</span></div>
                              )}
                              <div>{status.vectorIndex.error || 'Index existiert noch nicht'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Results */}
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Prüfergebnisse</div>
                    <div className="space-y-2">
                      {renderTestResult(status.writeTest, 'Schreib-Test (Meta-Dokument)')}
                      {renderTestResult(status.readTest, 'Lese-Test (Meta-Dokument)')}
                      {renderTestResult(status.searchTest, 'Search-Test (Vector Search)')}
                      {renderTestResult(status.facetTest, 'Facetten-Test (Aggregation)')}
                    </div>
                  </div>

                  {/* Detailed Results */}
                  {status.readTest.document && (
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="text-xs font-medium mb-2">Gelesenes Test-Dokument:</div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <div className="break-words overflow-hidden"><span className="font-medium">File-ID:</span> <span className="break-all">{status.readTest.document.fileId}</span></div>
                        <div className="break-words overflow-hidden"><span className="font-medium">Titel:</span> {status.readTest.document.title}</div>
                        <div><span className="font-medium">Facetten:</span> {status.readTest.document.hasFacets ? 'Vorhanden' : 'Nicht vorhanden'}</div>
                      </div>
                    </div>
                  )}

                  {status.searchTest.results && status.searchTest.results.length > 0 && (
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="text-xs font-medium mb-2">Search-Ergebnisse ({status.searchTest.resultsCount} gefunden):</div>
                      <div className="space-y-1">
                        {status.searchTest.results.map((r, i) => (
                          <div key={i} className="text-xs text-muted-foreground break-words overflow-hidden">
                            <Badge variant="outline" className="mr-2 shrink-0">{r.kind}</Badge>
                            <span className="break-all">{r.fileId}</span> (Score: {r.score.toFixed(3)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {status.facetTest.facets && status.facetTest.facets.length > 0 && (
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="text-xs font-medium mb-2">Facetten ({status.facetTest.facetsCount}):</div>
                      <div className="space-y-2">
                        {status.facetTest.facets.map((f, i) => (
                          <div key={i} className="text-xs">
                            <div className="font-medium">{f.metaKey}</div>
                            <div className="text-muted-foreground ml-2 break-words overflow-hidden">
                              {f.valuesCount} Werte
                              {f.sampleValues.length > 0 && (
                                <span className="ml-2 break-all">
                                  (Beispiele: {f.sampleValues.map(v => `${v.value} (${v.count})`).join(', ')})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Index wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der gesamte Vector Search Index wird gelöscht.
              Alle Vektoren und Meta-Dokumente bleiben erhalten, aber der Index muss neu erstellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteIndex}
              className="bg-red-600 hover:bg-red-700"
            >
              Index löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Index Confirmation Dialog */}
      <AlertDialog open={showCreateConfirm} onOpenChange={setShowCreateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Index wirklich anlegen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Vector Search Index wird für diese Library erstellt. Dies kann einige Minuten dauern.
              Der Index wird automatisch mit allen konfigurierten Facetten erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateIndex}>
              Index anlegen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}


