'use client'

/**
 * @fileoverview Dialog zum Erstellen einer Bild-Sammelanalyse (composite-multi).
 *
 * Wird aus der Datei-Liste-Toolbar geoeffnet, sobald >=2 Bilder selektiert sind.
 * Sammelt vom User: Dateiname (mit Default-Vorschlag) und optionalen Titel.
 * Ruft dann den Parent-Callback `onConfirm` mit den eingegebenen Werten auf.
 *
 * Hartes Limit aus der Secretary-Spec: max. 10 Bilder pro Composite. Der
 * Dialog zeigt die Anzahl der Quellen prominent an, damit der User sieht,
 * was tatsaechlich uebermittelt wird.
 *
 * Hinweis: Die eigentliche API-Anbindung passiert im Parent (file-list.tsx),
 * damit dieser Dialog wiederverwendbar bleibt.
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

export interface CompositeMultiCreateDialogProps {
  /** Sichtbarkeit des Dialogs (kontrolliert vom Parent). */
  open: boolean
  /** Wird aufgerufen, wenn der Dialog geschlossen werden soll. */
  onOpenChange: (open: boolean) => void
  /** Anzahl der ausgewaehlten Bilder (zur Anzeige). */
  imageCount: number
  /** Default-Vorschlag fuer den Dateinamen (z.B. "<praefix>_zusammenstellung.md"). */
  defaultFilename: string
  /** Wird mit dem finalen Filename + optionalem Titel aufgerufen, wenn der User bestaetigt. */
  onConfirm: (args: { filename: string; title?: string }) => Promise<void> | void
  /** Wenn true, ist der Bestaetigen-Button deaktiviert (z.B. waehrend des API-Calls). */
  isSubmitting?: boolean
}

export function CompositeMultiCreateDialog({
  open,
  onOpenChange,
  imageCount,
  defaultFilename,
  onConfirm,
  isSubmitting = false,
}: CompositeMultiCreateDialogProps) {
  // Lokaler State fuer die Eingabefelder. Wird beim Oeffnen mit dem Default
  // initialisiert (siehe useEffect unten).
  const [filename, setFilename] = React.useState(defaultFilename)
  const [title, setTitle] = React.useState('')

  // Reset bei jedem Oeffnen — sonst behaelt der Dialog alten State, wenn
  // der User mehrfach Composites in derselben Sitzung erstellt.
  React.useEffect(() => {
    if (open) {
      setFilename(defaultFilename)
      setTitle('')
    }
  }, [open, defaultFilename])

  const trimmedFilename = filename.trim()
  // Einfache Pflicht-Validierung: Filename muss gesetzt sein. Detail-Validierung
  // (Sonderzeichen etc.) macht die API-Route in einer 400-Antwort.
  const canSubmit = trimmedFilename.length > 0 && !isSubmitting && imageCount >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    await onConfirm({
      filename: trimmedFilename,
      title: title.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Bild-Sammelanalyse erstellen</DialogTitle>
            <DialogDescription>
              {imageCount} Bilder werden zu einer Sammeldatei zusammengefuehrt und
              koennen anschliessend gemeinsam analysiert werden.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="composite-multi-filename">Dateiname</Label>
              <Input
                id="composite-multi-filename"
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
              <Label htmlFor="composite-multi-title">Titel (optional)</Label>
              <Input
                id="composite-multi-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Bett CORTINA — Konfigurationsseiten"
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
 * Heuristik fuer den Default-Filename: gemeinsamer Praefix der Quellen +
 * "_zusammenstellung.md". Faellt auf "zusammenstellung.md" zurueck, wenn kein
 * Praefix erkennbar ist (z.B. bei sehr unterschiedlichen Namen).
 */
export function deriveCompositeMultiDefaultFilename(sourceNames: string[]): string {
  if (sourceNames.length === 0) return 'zusammenstellung.md'

  // Datei-Endungen abschneiden, dann gemeinsamen Praefix finden.
  const baseNames = sourceNames.map((n) => n.replace(/\.[^.]+$/, ''))
  let prefix = baseNames[0]
  for (const name of baseNames.slice(1)) {
    let i = 0
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++
    prefix = prefix.slice(0, i)
  }

  // Nachgestellte Trenner entfernen (z.B. "page_009__cortina" -> "page_" -> "page")
  prefix = prefix.replace(/[\s._-]+$/, '')

  // Mindestens 3 Zeichen, sonst lieber generisch.
  if (prefix.length < 3) return 'zusammenstellung.md'
  return `${prefix}_zusammenstellung.md`
}
