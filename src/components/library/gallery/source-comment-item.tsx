'use client'

import React from 'react'
import { Pencil, Trash2, History, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/i18n/hooks'
import { cn } from '@/lib/utils'
import type { SourceComment } from '@/types/source-comment'

export interface SourceCommentItemProps {
  comment: SourceComment
  /** Normalisierte E-Mail des aktuellen Users (fuer Author-Vergleich). */
  currentUserEmail: string
  /** true wenn aktueller User Owner/Co-Creator (darf fremde Kommentare loeschen). */
  canModerate: boolean
  onEdit: (commentId: string, body: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

/**
 * Einzelner Kommentar im Thread.
 * Zeigt Autor + Zeit + Body, optional "(bearbeitet)"-Marker mit
 * aufklappbarer Revisions-Liste und Edit/Delete-Buttons.
 */
export function SourceCommentItem({
  comment,
  currentUserEmail,
  canModerate,
  onEdit,
  onDelete,
}: SourceCommentItemProps) {
  const { t, locale } = useTranslation()
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(comment.body)
  const [showRevisions, setShowRevisions] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)

  const isAuthor = currentUserEmail !== '' && currentUserEmail === comment.authorEmail
  const isDeleted = Boolean(comment.deletedAt)
  const hasRevisions = (comment.revisions?.length ?? 0) > 0
  const canEdit = isAuthor && !isDeleted
  const canDelete = (isAuthor || canModerate) && !isDeleted

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  }

  const handleSaveEdit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === comment.body) {
      setIsEditing(false)
      setDraft(comment.body)
      return
    }
    setIsBusy(true)
    try {
      await onEdit(comment.id, trimmed)
      setIsEditing(false)
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (isBusy) return
    const confirmMsg = t('gallery.comments.confirmDelete', {
      defaultValue: 'Diesen Kommentar wirklich loeschen?',
    })
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return
    setIsBusy(true)
    try {
      await onDelete(comment.id)
    } finally {
      setIsBusy(false)
    }
  }

  if (isDeleted) {
    return (
      <div className="rounded border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground italic">
        {t('gallery.comments.deletedBy', {
          defaultValue: 'Kommentar geloescht von {author} am {date}',
          author: comment.deletedBy ?? '',
          date: formatTime(comment.deletedAt),
        })}
      </div>
    )
  }

  return (
    <div className="rounded border border-border/60 bg-background p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{comment.authorEmail}</span>
            <span>·</span>
            <span title={formatTime(comment.createdAt)}>{formatTime(comment.createdAt)}</span>
            {comment.editedAt ? (
              <>
                <span>·</span>
                <span className="italic">
                  {t('gallery.comments.edited', { defaultValue: '(bearbeitet)' })}
                </span>
              </>
            ) : null}
          </div>
        </div>
        {!isEditing && (canEdit || canDelete) ? (
          <div className="flex items-center gap-1 shrink-0">
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
                title={t('gallery.comments.edit', { defaultValue: 'Bearbeiten' })}
                aria-label={t('gallery.comments.edit', { defaultValue: 'Bearbeiten' })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={isBusy}
                title={t('gallery.comments.delete', { defaultValue: 'Loeschen' })}
                aria-label={t('gallery.comments.delete', { defaultValue: 'Loeschen' })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="text-sm"
            disabled={isBusy}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false)
                setDraft(comment.body)
              }}
              disabled={isBusy}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              {t('gallery.comments.cancelEdit', { defaultValue: 'Abbrechen' })}
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={isBusy || !draft.trim()}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {t('gallery.comments.saveEdit', { defaultValue: 'Speichern' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words text-foreground">{comment.body}</div>
      )}

      {hasRevisions && !isEditing ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowRevisions((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" aria-hidden />
            {showRevisions
              ? t('gallery.comments.revisionsHide', { defaultValue: 'Versionen ausblenden' })
              : t('gallery.comments.revisionsTitle', {
                  defaultValue: '{count} fruehere Version(en)',
                  count: comment.revisions.length,
                })}
          </button>
          {showRevisions ? (
            <ul className={cn('mt-2 space-y-1 border-l-2 border-border/40 pl-3')}>
              {comment.revisions.map((rev, idx) => (
                <li key={idx} className="text-xs">
                  <div className="text-muted-foreground">
                    <span className="font-mono">{formatTime(rev.editedAt)}</span>
                    {rev.editorEmail ? <span> · {rev.editorEmail}</span> : null}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-foreground/80">{rev.body}</div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
