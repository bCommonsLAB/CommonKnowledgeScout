"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCw, Trash2 } from "lucide-react"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { StorageProvider } from "@/lib/storage/types"

/**
 * Einheitliche Datenstruktur für Testimonials
 */
export interface TestimonialItem {
  /** Eindeutige ID des Testimonials (Ordner-Name) */
  testimonialId: string
  /** Sprecher-Name */
  speakerName: string | null
  /** Erstellungsdatum (ISO-String) */
  createdAt: string | null
  /** Text-Inhalt (Markdown) */
  text: string | null
  /** Ob Audio vorhanden ist */
  hasAudio: boolean
  /** Audio-Dateiname (falls vorhanden) */
  audioFileName: string | null
  /** Optional: Folder-ID für Lösch-Operationen */
  folderId?: string
}

interface TestimonialListProps {
  /** Testimonials zum Anzeigen */
  items: TestimonialItem[]
  /** Loading-State */
  isLoading?: boolean
  /** Callback für Refresh */
  onRefresh?: () => void
  /** Callback für Löschen (optional, nur wenn canDelete=true) */
  onDelete?: (testimonialId: string) => Promise<void>
  /** Ob Löschen erlaubt ist */
  canDelete?: boolean
  /** Storage Provider für MarkdownPreview */
  provider?: StorageProvider | null
  /** Current Folder ID für MarkdownPreview */
  currentFolderId?: string
  /** Variante: 'list' für Session Detail, 'select' für Wizard */
  variant?: 'list' | 'select'
  /** Callback für Auswahl-Änderung (nur bei variant='select') */
  onSelectionChange?: (selectedIds: Set<string>) => void
  /** Initial ausgewählte IDs (nur bei variant='select') */
  initialSelectedIds?: Set<string>
}

/**
 * Gemeinsame Komponente zur Anzeige von Testimonials.
 * 
 * Unterstützt zwei Varianten:
 * - 'list': Einfache Liste mit Lösch-Funktion (für Session Detail)
 * - 'select': Liste mit Checkboxen für Auswahl (für Wizard)
 */
export function TestimonialList({
  items,
  isLoading = false,
  onRefresh,
  onDelete,
  canDelete = false,
  provider = null,
  currentFolderId = 'root',
  variant = 'list',
  onSelectionChange,
  initialSelectedIds,
}: TestimonialListProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    initialSelectedIds || new Set(items.map(it => it.testimonialId))
  )

  // Synchronisiere selectedIds mit items-Änderungen
  React.useEffect(() => {
    if (variant === 'select' && initialSelectedIds) {
      setSelectedIds(initialSelectedIds)
    }
  }, [variant, initialSelectedIds])

  // Benachrichtige Parent über Auswahl-Änderungen
  React.useEffect(() => {
    if (variant === 'select' && onSelectionChange) {
      onSelectionChange(selectedIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, variant]) // onSelectionChange absichtlich nicht in Dependencies

  const handleToggle = React.useCallback((testimonialId: string) => {
    if (variant !== 'select') return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(testimonialId)) {
        next.delete(testimonialId)
      } else {
        next.add(testimonialId)
      }
      return next
    })
  }, [variant])

  const handleDelete = React.useCallback(async (testimonialId: string) => {
    if (!onDelete) return
    try {
      await onDelete(testimonialId)
      toast.success('Testimonial gelöscht')
    } catch (error) {
      toast.error(`Fehler beim Löschen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    }
  }, [onDelete])

  const formatDate = React.useCallback((dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      const date = new Date(dateStr)
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date)
    } catch {
      return dateStr
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testimonials</CardTitle>
          <CardDescription>Lade Testimonials...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Testimonials</CardTitle>
              <CardDescription>
                {variant === 'select' 
                  ? 'Es wurden keine Testimonials gefunden.'
                  : 'Noch keine Testimonials vorhanden.'}
              </CardDescription>
            </div>
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onRefresh()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Testimonials</CardTitle>
            <CardDescription>
              {variant === 'select'
                ? `${items.length} Testimonial(s) gefunden. Du kannst einzelne Testimonials ausschließen, wenn sie nicht verwendet werden sollen.`
                : `${items.length} Testimonial(s)`}
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRefresh()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((it) => {
            const isSelected = variant === 'select' ? selectedIds.has(it.testimonialId) : true
            
            return (
              <div
                key={it.testimonialId}
                className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                  variant === 'select' && !isSelected ? 'opacity-50' : ''
                }`}
              >
                {variant === 'select' && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(it.testimonialId)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm whitespace-normal break-words">
                        <span className="font-medium">{it.speakerName || 'Unbekannt'}</span>
                        {it.createdAt && (
                          <>
                            {' '}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(it.createdAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {variant === 'list' && canDelete && onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            aria-label="Testimonial löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Testimonial löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Dieses Testimonial wird aus dem Event entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void handleDelete(it.testimonialId)}
                            >
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  
                  {it.text?.trim() && (
                    <div className="text-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownPreview
                          content={it.text.length > 600 ? `${it.text.slice(0, 600)}…` : it.text}
                          provider={provider}
                          currentFolderId={currentFolderId}
                          compact={true}
                          className="min-h-0"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
                    <span className="rounded border px-2 py-0.5">
                      {it.text?.trim() ? 'Text' : 'Kein Text'}
                    </span>
                    <span className="rounded border px-2 py-0.5">
                      {it.hasAudio ? (it.audioFileName ? `Audio: ${it.audioFileName}` : 'Audio') : 'Kein Audio'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {variant === 'select' && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedIds.size} von {items.length} Testimonial(s) ausgewählt
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
