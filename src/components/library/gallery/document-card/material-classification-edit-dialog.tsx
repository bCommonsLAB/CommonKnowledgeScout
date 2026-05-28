'use client'

/**
 * @fileoverview Korrektur-Dialog fuer material_class/material_type (Stufe 4).
 *
 * @description
 * Inline-Korrektur eines Einzelmaterials aus der Galerie. Bei Klassen-
 * oder Typ-Wechsel setzt der Server automatisch `needs_visual_refresh=true`
 * (siehe `applyMaterialPatch`) — der User wird mit einer expliziten
 * Hinweis-Zeile darauf aufmerksam gemacht.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

/** Materialklassen-Enum laut Template (`Diva-Texture-Analysis.md`). */
const MATERIAL_CLASSES = [
  'fabric',
  'leather',
  'wood',
  'metal',
  'glass',
  'stone',
  'ceramic',
  'plastic',
  'natural_fiber',
  'composite',
  'cork',
  'paper',
  'foam',
] as const

/** Klassen, fuer die material_type leer bleibt. */
const CLASSES_WITHOUT_TYPE = new Set(['ceramic', 'glass', 'plastic'])

export interface MaterialClassificationEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  fileId: string
  currentMaterialClass: string
  currentMaterialType: string
  onApplied?: () => void
}

export function MaterialClassificationEditDialog({
  open,
  onOpenChange,
  libraryId,
  fileId,
  currentMaterialClass,
  currentMaterialType,
  onApplied,
}: MaterialClassificationEditDialogProps): React.ReactNode {
  const [materialClass, setMaterialClass] = React.useState(currentMaterialClass)
  const [materialType, setMaterialType] = React.useState(currentMaterialType)
  const [isSaving, setIsSaving] = React.useState(false)

  // Bei (Neu-)Oeffnen Werte aus den Props uebernehmen — der User soll mit dem
  // aktuellen Stand starten, nicht mit alten Edit-Werten.
  React.useEffect(() => {
    if (open) {
      setMaterialClass(currentMaterialClass)
      setMaterialType(currentMaterialType)
    }
  }, [open, currentMaterialClass, currentMaterialType])

  const classChanged = materialClass.trim() !== currentMaterialClass.trim()
  const typeChanged = materialType.trim() !== currentMaterialType.trim()
  const hasChange = classChanged || typeChanged
  const classWithoutType = CLASSES_WITHOUT_TYPE.has(materialClass.trim())

  const handleSave = async (): Promise<void> => {
    if (!hasChange) {
      onOpenChange(false)
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/diva-texture/material-classification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          fileId,
          patch: {
            material_class: materialClass.trim(),
            material_type: classWithoutType ? '' : materialType.trim(),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(typeof err.error === 'string' ? err.error : `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { triggersVisualRefresh?: boolean }
      toast({
        title: 'Klassifikation korrigiert',
        description: json.triggersVisualRefresh
          ? 'needs_visual_refresh gesetzt — bitte Korrektur-Lauf im Archiv ausfuehren.'
          : undefined,
      })
      onApplied?.()
    } catch (err) {
      toast({
        title: 'Korrektur fehlgeschlagen',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Klasse / Typ korrigieren</DialogTitle>
          <DialogDescription>
            Aenderungen werden direkt ins Material-Frontmatter geschrieben.
            Bei Klassen- oder Typ-Wechsel setzt das System
            <em> needs_visual_refresh=true</em> — die visuellen Properties
            sollten dann via Korrektur-Lauf im Archiv neu bestimmt werden.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Material-Klasse</label>
            <Select value={materialClass} onValueChange={setMaterialClass}>
              <SelectTrigger>
                <SelectValue placeholder='Klasse waehlen …' />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              Material-Typ {classWithoutType ? '(nicht anwendbar)' : ''}
            </label>
            <Input
              value={classWithoutType ? '' : materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              placeholder='z.B. cord, smooth_leather, oak …'
              disabled={classWithoutType}
            />
            {classWithoutType ? (
              <p className='text-xs text-muted-foreground'>
                Klassen ceramic / glass / plastic werden ohne Typ klassifiziert.
              </p>
            ) : null}
          </div>

          {hasChange ? (
            <p className='rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-100'>
              Klasse oder Typ geaendert → needs_visual_refresh wird automatisch gesetzt.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!hasChange || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Speichere …
              </>
            ) : (
              'Speichern'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
