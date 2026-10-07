'use client'

/**
 * Block 1 des Reiters „Korrektur": Begleitdokumente desselben Ordners
 * (Einladung, Folien) waehlen und Vorschlaege beim Secretary holen.
 */

import { Button, Checkbox, Label } from '@ks/ui'
import { Sparkles } from 'lucide-react'
import type { Korrekturvorschlag } from '@/lib/transkript-korrektur/vorschlag'
import type { BegleitQuelle } from './audio-correction-types'

interface Props {
  quellen: BegleitQuelle[]
  onToggle: (id: string, gewaehlt: boolean) => void
  onHolen: () => void
  laeuft: boolean
  disabled: boolean
  vorschlag: Korrekturvorschlag | null
}

export function AudioCorrectionSources({ quellen, onToggle, onHolen, laeuft, disabled, vorschlag }: Props) {
  const gewaehlt = quellen.filter((q) => q.gewaehlt).length
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Begleitdokumente</div>
          <p className="text-xs text-muted-foreground">
            Transkripte aus demselben Ordner, gegen die der Secretary Namen, Zahlen und Begriffe prueft.
            Namen werden nur vorgeschlagen, wenn sie in einem Begleittext stehen.
          </p>
        </div>
        <Button size="sm" onClick={onHolen} disabled={disabled || laeuft}>
          <Sparkles className="h-4 w-4 mr-2" />
          {laeuft ? 'Secretary arbeitet …' : `Vorschlaege holen (${gewaehlt})`}
        </Button>
      </div>
      {quellen.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Begleitdokumente mit Transkript im Ordner. Vorschlaege sind auch ohne moeglich, dann nur aus dem Transkript selbst.</p>
      ) : (
        <ul className="space-y-1">
          {quellen.map((q) => (
            <li key={q.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`begleit-${q.id}`}
                checked={q.gewaehlt}
                disabled={!q.hatTranskript || disabled}
                onCheckedChange={(v) => onToggle(q.id, v === true)}
              />
              <Label htmlFor={`begleit-${q.id}`} className={q.hatTranskript ? 'cursor-pointer' : 'text-muted-foreground'}>
                {q.name}
                {!q.hatTranskript && <span className="ml-2 text-xs">(kein Transkript)</span>}
              </Label>
            </li>
          ))}
        </ul>
      )}
      {vorschlag && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Vorschlag: {vorschlag.ersetzungen.length} Ersetzungen, {vorschlag.sprecher.length} Sprecher
            {vorschlag.modell ? ` · ${vorschlag.modell}` : ''}
            {vorschlag.tokens !== null ? ` · ${vorschlag.tokens} Tokens` : ''}
            {vorschlag.dauer_ms !== null ? ` · ${Math.round(vorschlag.dauer_ms / 1000)} s` : ''}
            {vorschlag.verworfen.length > 0 ? ` · ${vorschlag.verworfen.length} verworfen` : ''}
          </summary>
          {vorschlag.verworfen.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {vorschlag.verworfen.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
        </details>
      )}
    </div>
  )
}
