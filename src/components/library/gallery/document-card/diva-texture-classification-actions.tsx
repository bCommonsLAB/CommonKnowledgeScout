'use client'

/**
 * @fileoverview Per-Material-Aktionen fuer die Stoffgruppen-Klassifikation (Stufe 4).
 *
 * @description
 * Kleines Drei-Punkte-Menue auf der DivaTextureCard mit den User-Aktionen:
 *  - Klassifikation **bestaetigen** (`classification_locked` toggeln) →
 *    schuetzt das Material vor Stoffgruppen-Propagation.
 *  - Klassifikation **verwerfen** (`classification_rejected` toggeln) →
 *    Stoffgruppen-Propagation ueberspringt das Material.
 *  - **Klasse / Typ korrigieren** — oeffnet einen Korrektur-Dialog;
 *    bei einem Wechsel von `material_class` / `material_type` setzt der
 *    Server automatisch `needs_visual_refresh=true` (Signal an Stufe 5).
 *  - **Refresh-Marker entfernen** — nur sichtbar bei `needs_visual_refresh`;
 *    setzt das Flag zurueck (z.B. wenn der User die alten Visuals
 *    wissentlich beibehalten will).
 *
 * Jede Aktion ruft `PATCH /api/diva-texture/material-classification` auf
 * (kein LLM-Call) und schreibt Markdown + docMetaJson konsistent zurueck.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Lock, Ban, Pencil, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { DocCardMeta } from '@/lib/gallery/types'
import { MaterialClassificationEditDialog } from './material-classification-edit-dialog'

export interface DivaTextureClassificationActionsProps {
  doc: DocCardMeta
  libraryId: string
  /** Wird nach erfolgreichem Patch gefeuert (z.B. damit die Galerie neu laedt). */
  onChanged?: () => void
}

interface PatchBody {
  material_class?: string
  material_type?: string
  confidence_class?: number
  classification_locked?: boolean
  classification_rejected?: boolean
  needs_human_review?: boolean
}

async function patchMaterial(
  libraryId: string,
  fileId: string,
  patch: PatchBody,
): Promise<{ triggersVisualRefresh: boolean }> {
  const res = await fetch('/api/diva-texture/material-classification', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId, fileId, patch }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(typeof err.error === 'string' ? err.error : `HTTP ${res.status}`)
  }
  const json = (await res.json()) as { triggersVisualRefresh?: boolean }
  return { triggersVisualRefresh: json.triggersVisualRefresh === true }
}

export function DivaTextureClassificationActions({
  doc,
  libraryId,
  onChanged,
}: DivaTextureClassificationActionsProps): React.ReactNode {
  const fileId =
    typeof doc.fileId === 'string' && doc.fileId.length > 0 ? doc.fileId : null

  const locked = doc.classification_locked === true
  const rejected = doc.classification_rejected === true
  const refresh = doc.needs_visual_refresh === true
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isBusy, setIsBusy] = React.useState(false)

  const callPatch = React.useCallback(
    async (patch: PatchBody, successMessage: string) => {
      if (fileId === null) return
      setIsBusy(true)
      try {
        const result = await patchMaterial(libraryId, fileId, patch)
        toast({
          title: successMessage,
          description: result.triggersVisualRefresh
            ? 'Klassen-Wechsel erkannt — needs_visual_refresh gesetzt (Korrektur-Lauf im Archiv noetig).'
            : undefined,
        })
        onChanged?.()
      } catch (err) {
        toast({
          title: 'Korrektur fehlgeschlagen',
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        })
      } finally {
        setIsBusy(false)
      }
    },
    [libraryId, fileId, onChanged],
  )

  if (fileId === null) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/60'
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label='Klassifikations-Aktionen'
            disabled={isBusy}
          >
            <MoreVertical className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel>Klassifikation</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => setIsEditOpen(true)}
            disabled={isBusy}
          >
            <Pencil className='mr-2 h-4 w-4' />
            Klasse / Typ korrigieren …
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={locked}
            disabled={isBusy}
            onCheckedChange={(checked) =>
              void callPatch(
                { classification_locked: checked === true },
                checked === true
                  ? 'Klassifikation bestaetigt (locked)'
                  : 'Sperre entfernt',
              )
            }
          >
            <Lock className='mr-2 h-4 w-4' />
            Bestaetigen (vor Gruppen-Propagation schuetzen)
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={rejected}
            disabled={isBusy}
            onCheckedChange={(checked) =>
              void callPatch(
                { classification_rejected: checked === true },
                checked === true ? 'Klassifikation verworfen' : 'Verwerfen aufgehoben',
              )
            }
          >
            <Ban className='mr-2 h-4 w-4' />
            Verwerfen
          </DropdownMenuCheckboxItem>
          {refresh ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
                <RefreshCw className='mr-2 inline h-3 w-3' />
                needs_visual_refresh: Stufe-5-Lauf im Archiv noetig.
              </DropdownMenuLabel>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <MaterialClassificationEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        libraryId={libraryId}
        fileId={fileId}
        currentMaterialClass={doc.material_class ?? ''}
        currentMaterialType={doc.material_type ?? ''}
        onApplied={() => {
          setIsEditOpen(false)
          onChanged?.()
        }}
      />
    </>
  )
}
