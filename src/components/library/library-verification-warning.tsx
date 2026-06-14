'use client'

/**
 * Nicht-blockierende Veröffentlichungs-Warnung (Welle A1, Owner-Entscheidung
 * 2026-06-14): erscheint beim Veröffentlichen und beim Öffnen einer öffentlichen
 * Library, wenn der Verifikations-Status NICHT `verified` ist. KEIN Guard — die
 * Veröffentlichung wird nie verhindert, nur ein Hinweis angezeigt.
 *
 * `LibraryVerificationWarningView` ist rein (Status + Kontext → Alert) und damit
 * testbar. `LibraryVerificationWarning` verdrahtet Library + Rolle + Status und
 * zeigt den Hinweis NUR Mitgliedern (Owner/Co-Creator) — analog zum A2-Abzeichen
 * und zur authentifizierten Verify-API. Die UI kennt kein Storage-Backend.
 */

import { useAtomValue } from 'jotai'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useLibraryVerificationStatus } from '@/hooks/library-verification/use-library-verification-status'
import {
  getPublishVerificationWarning,
  type PublishWarningContext,
} from '@/lib/library-verification/publish-gate'
import type { LibraryVerificationStatus } from '@/lib/library-verification/types'

export function LibraryVerificationWarningView({
  status,
  context,
}: {
  status: LibraryVerificationStatus
  context: PublishWarningContext
}) {
  const warning = getPublishVerificationWarning(status, context)
  if (!warning) return null
  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{warning.title}</AlertTitle>
      <AlertDescription>{warning.message}</AlertDescription>
    </Alert>
  )
}

export interface LibraryVerificationWarningProps {
  /** Steuert den Wortlaut (Veröffentlichen vs. Öffnen). */
  context: PublishWarningContext
  /** Optional explizit; sonst aktive Library aus dem Atom. */
  libraryId?: string
}

export function LibraryVerificationWarning({
  context,
  libraryId: libraryIdProp,
}: LibraryVerificationWarningProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraryId = libraryIdProp || activeLibraryId
  const { isMember, isLoading: roleLoading } = useLibraryRole(libraryId)
  const { status } = useLibraryVerificationStatus(libraryId, isMember && !roleLoading)

  if (!libraryId || !isMember || !status) return null
  return <LibraryVerificationWarningView status={status} context={context} />
}
