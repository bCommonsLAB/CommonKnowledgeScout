'use client'

/**
 * OverlapReportDialog — Anzeige + Anstoss des LLM-Synergie-Berichts
 * (Plan summen-und-synergie-aggregation, Stufe 3e).
 *
 * Laedt beim Oeffnen den juengsten Bericht (`GET overlap-report/latest`,
 * member-only) und rendert ihn als Markdown. Owner koennen einen neuen Lauf
 * anstossen (`POST overlap-report/recompute` -> external-job, Ergebnis
 * erscheint nach Abschluss beim naechsten Oeffnen) und den Bericht als
 * .md-Datei herunterladen.
 */

import React from 'react'
import { FileText, Loader2, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'
import { md } from '@/components/library/markdown-preview/md-renderer'

interface LatestReport {
  markdown: string
  createdAt: string
  model: string
}

export interface OverlapReportDialogProps {
  libraryId: string
  /** Owner darf neu berechnen; Member sehen nur den Bericht. */
  canManage?: boolean
}

export function OverlapReportDialog({ libraryId, canManage }: OverlapReportDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [report, setReport] = React.useState<LatestReport | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadLatest = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/overlap-report/latest`, {
        cache: 'no-store',
      })
      if (res.status === 404) {
        setReport(null)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : res.statusText)
      setReport((data?.report ?? null) as LatestReport | null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [libraryId])

  React.useEffect(() => {
    if (open) void loadLatest()
  }, [open, loadLatest])

  const handleRecompute = React.useCallback(async () => {
    setStarting(true)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/overlap-report/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : res.statusText)
      toast({ title: t('gallery.sums.reportStarted') })
    } catch (e) {
      toast({
        title: t('gallery.sums.reportError'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }, [libraryId, t])

  const handleDownload = React.useCallback(() => {
    if (!report) return
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `synergie-bericht-${report.createdAt.slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [report])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        {t('gallery.sums.reportButton')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>{t('gallery.sums.reportTitle')}</DialogTitle>
            <DialogDescription>
              {report
                ? t('gallery.sums.reportMeta', { date: report.createdAt.slice(0, 10), model: report.model })
                : t('gallery.sums.reportDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/10 p-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('gallery.loading')}
              </div>
            ) : error ? (
              <div className="text-sm text-destructive">
                {t('gallery.sums.reportError')}: {error}
              </div>
            ) : report ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none [&_table]:block [&_table]:overflow-x-auto"
                // Bericht stammt aus unserem eigenen Backend (Markdown-Renderer wie Vorschau).
                dangerouslySetInnerHTML={{ __html: md.render(report.markdown) }}
              />
            ) : (
              <div className="text-sm text-muted-foreground">{t('gallery.sums.reportEmpty')}</div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 gap-2">
            {report && (
              <Button type="button" variant="outline" onClick={handleDownload} className="gap-1.5">
                <Download className="h-4 w-4" aria-hidden />
                {t('gallery.sums.reportDownload')}
              </Button>
            )}
            {canManage && (
              <Button type="button" onClick={handleRecompute} disabled={starting} className="gap-1.5">
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                {t('gallery.sums.reportRecompute')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
