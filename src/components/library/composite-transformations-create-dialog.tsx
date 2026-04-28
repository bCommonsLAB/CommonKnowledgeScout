'use client'

/**
 * @fileoverview Dialog zum Erstellen einer Sammel-Transformations-Datei.
 *
 * Wird aus der Datei-Liste-Toolbar geoeffnet, sobald >=2 Dateien selektiert
 * sind. Beim Oeffnen wird per GET-Pre-Fetch ermittelt, welche
 * Transformations-Templates bei den markierten Quellen verfuegbar sind.
 *
 * Ein Template + Sprache pro Sammeldatei (Determinismus-Contract aus
 * shadow-twin-contracts.mdc — kein "pick latest"). Quellen, die das
 * gewaehlte Template nicht haben, werden inline als Warnung angezeigt;
 * der Submit ist in dem Fall deaktiviert (die API wuerde sonst 400 melden).
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Eintrag aus dem Pool-Lookup (siehe `composite-transformations-pool.ts`). */
export interface DialogTemplateEntry {
  templateName: string
  coveredSources: string[]
  missingSources: string[]
}

export interface CompositeTransformationsCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Anzahl der ausgewaehlten Quellen (zur Anzeige). */
  sourceCount: number
  /** Default-Vorschlag fuer den Dateinamen. */
  defaultFilename: string
  /** Verfuegbare Templates (vom GET-Endpoint geliefert). */
  templates: DialogTemplateEntry[]
  /** Wird beim Oeffnen vom Parent gesetzt, falls der Pre-Fetch noch laeuft. */
  isLoadingTemplates: boolean
  /** Bestaetigung. */
  onConfirm: (args: {
    filename: string
    templateName: string
    title?: string
  }) => Promise<void> | void
  /** Wenn true, ist der Bestaetigen-Button deaktiviert (waehrend POST-Call). */
  isSubmitting?: boolean
}

export function CompositeTransformationsCreateDialog({
  open,
  onOpenChange,
  sourceCount,
  defaultFilename,
  templates,
  isLoadingTemplates,
  onConfirm,
  isSubmitting = false,
}: CompositeTransformationsCreateDialogProps) {
  const [filename, setFilename] = React.useState(defaultFilename)
  const [title, setTitle] = React.useState('')
  const [templateName, setTemplateName] = React.useState('')

  // Reset bei jedem Oeffnen — sonst behaelt der Dialog alten State.
  React.useEffect(() => {
    if (!open) return
    setFilename(defaultFilename)
    setTitle('')
    // Default-Template: das mit den meisten covered Sources (= erstes in der Liste,
    // weil der Pool-Helper bereits danach sortiert).
    const fullCoverage = templates.find(t => t.missingSources.length === 0)
    setTemplateName(fullCoverage?.templateName ?? templates[0]?.templateName ?? '')
  }, [open, defaultFilename, templates])

  const selected = templates.find(t => t.templateName === templateName)
  const trimmedFilename = filename.trim()
  const hasFullCoverage = selected ? selected.missingSources.length === 0 : false

  const canSubmit =
    trimmedFilename.length > 0 &&
    !isSubmitting &&
    sourceCount >= 2 &&
    !!templateName &&
    hasFullCoverage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    await onConfirm({
      filename: trimmedFilename,
      templateName,
      title: title.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Sammel-Transformationen erstellen</DialogTitle>
            <DialogDescription>
              {sourceCount} Quellen werden zu einer Sammeldatei zusammengefuehrt,
              die auf die Transformations-Artefakte zeigt. Diese Datei laesst sich
              danach wie jedes andere Sammeltranskript weiterverarbeiten.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="composite-tx-template">Transformation</Label>
              {isLoadingTemplates ? (
                <p className="text-sm text-muted-foreground">Lade verfuegbare Templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-destructive">
                  Keine Transformationen bei den markierten Quellen gefunden.
                  Bitte zuerst die Quellen mit einem Template analysieren.
                </p>
              ) : (
                <Select
                  value={templateName}
                  onValueChange={setTemplateName}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="composite-tx-template">
                    <SelectValue placeholder="Template waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.templateName} value={t.templateName}>
                        {t.templateName} ({t.coveredSources.length}/
                        {t.coveredSources.length + t.missingSources.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selected && selected.missingSources.length > 0 && (
                <p className="text-xs text-destructive">
                  Fehlt bei: {selected.missingSources.join(', ')}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="composite-tx-filename">Dateiname</Label>
              <Input
                id="composite-tx-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="zusammenstellung.md"
                autoFocus
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Endung <code>.md</code> wird automatisch ergaenzt. Keine Pfad-Trenner.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="composite-tx-title">Titel (optional)</Label>
              <Input
                id="composite-tx-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Steckbriefe Produktreihe X"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Erstelle...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Heuristik fuer den Default-Filename — analog `deriveCompositeMultiDefaultFilename`,
 * nur mit anderem Suffix.
 */
export function deriveCompositeTransformationsDefaultFilename(sourceNames: string[]): string {
  if (sourceNames.length === 0) return 'sammel-transformationen.md'

  const baseNames = sourceNames.map((n) => n.replace(/\.[^.]+$/, ''))
  let prefix = baseNames[0]
  for (const name of baseNames.slice(1)) {
    let i = 0
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++
    prefix = prefix.slice(0, i)
  }
  prefix = prefix.replace(/[\s._-]+$/, '')

  if (prefix.length < 3) return 'sammel-transformationen.md'
  return `${prefix}_transformationen.md`
}
