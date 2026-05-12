'use client'

import React from 'react'
import { Send, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/i18n/hooks'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useSourceComments } from '@/hooks/gallery/use-source-comments'
import { SourceCommentItem } from './source-comment-item'

export interface SourceCommentsPanelProps {
  libraryId: string
  fileId: string
  /** true wenn dieses Panel aktuell sichtbar ist (lazy laden). */
  open: boolean
  /** Optional: callback wenn der Counter sich aendert (Add/Delete). */
  onCommentsChanged?: () => void
}

/**
 * Expandiertes Panel unterhalb einer Tabellen-Zeile.
 * - Member sehen alle Kommentare (Feedback inkl. Gast-Beitraege).
 * - Gaeste sehen nur ihre eigenen + Hinweis-Banner.
 * - Anonyme erhalten leeren Render-Fallback (Spalte ohnehin verborgen).
 */
export function SourceCommentsPanel({
  libraryId,
  fileId,
  open,
  onCommentsChanged,
}: SourceCommentsPanelProps) {
  const { t } = useTranslation()
  const { role, isSignedIn, isMember, userEmail } = useLibraryRole(libraryId)
  const {
    comments,
    filteredToOwn,
    isLoading,
    error,
    addComment,
    editComment,
    removeComment,
  } = useSourceComments(libraryId, fileId, { enabled: open })

  const [draft, setDraft] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)

  React.useEffect(() => {
    if (!open) setDraft('')
  }, [open])

  if (!isSignedIn) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('gallery.comments.onlySignedIn', {
          defaultValue: 'Anmelden, um Kommentare zu sehen oder zu hinterlassen.',
        })}
      </div>
    )
  }

  const showGuestHint = role === 'guest' || filteredToOwn

  const handleSubmit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSending) return
    setIsSending(true)
    try {
      await addComment(trimmed)
      setDraft('')
      onCommentsChanged?.()
    } catch {
      // Fehler wird vom Hook bereits geloggt + via `error` ausgegeben
    } finally {
      setIsSending(false)
    }
  }

  const handleEdit = async (commentId: string, body: string) => {
    await editComment(commentId, body)
    onCommentsChanged?.()
  }

  const handleDelete = async (commentId: string) => {
    await removeComment(commentId)
    onCommentsChanged?.()
  }

  return (
    <div className="space-y-3">
      {showGuestHint ? (
        <div className="flex items-start gap-2 rounded border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-2 text-xs text-amber-900 dark:text-amber-200">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            {t('gallery.comments.guestVisibilityHint', {
              defaultValue:
                'Nur Owner und Co-Kreatoren sehen alle Kommentare. Deine Beitraege sind nur fuer dich und das Team sichtbar.',
            })}
          </span>
        </div>
      ) : null}

      {isLoading && comments.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t('gallery.comments.loading', { defaultValue: 'Lade Kommentare...' })}
        </div>
      ) : null}

      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : null}

      {comments.length === 0 && !isLoading ? (
        <div className="text-sm text-muted-foreground">
          {t('gallery.comments.empty', {
            defaultValue: 'Noch keine Kommentare zu dieser Quelle.',
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id}>
              <SourceCommentItem
                comment={c}
                currentUserEmail={userEmail}
                canModerate={isMember}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('gallery.comments.placeholder', {
            defaultValue: 'Kommentar schreiben...',
          })}
          rows={2}
          disabled={isSending}
          className="text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            type="button"
            onClick={handleSubmit}
            disabled={isSending || !draft.trim()}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {t('gallery.comments.add', { defaultValue: 'Kommentar absenden' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
