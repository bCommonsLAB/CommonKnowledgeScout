"use client";

/**
 * Kontext-Felder der Audio-Transkription: Sprachen der Aufnahme,
 * Thema/Anlass und Begriffe fuer diese Datei. Reine Eingabe-Komponente —
 * eingebunden im Dialog „Aufbereiten & Publizieren" (Schritt „Transkript
 * erstellen", Optionen; `flow/pipeline-sheet.tsx`). Die Werte gehen als
 * `audioLanguages`/`sourceLanguage`, `audioPrompt`, `audioKeywords` ueber
 * `/api/pipeline/process` an den Job; die bekannten Namen der Library ergaenzt
 * der Server (`resolveAudioJobContext`).
 *
 * Owner-Entscheid 10.10.2026: Das Transkript bildet das Original ab — keine
 * Uebersetzung, kein Sprecher-Modus mehr (der Anbieter-Weg uebersetzte und
 * erfand Text). Sprecher entstehen im Korrektur-Schritt.
 */

import { Label, Textarea } from '@ks/ui'
import { SprachenAuswahl } from '@/components/shared/sprachen-auswahl'

export interface AudioTransformContextProps {
  /** Sprachen der Aufnahme; leer = automatisch erkennen. */
  sprachen: string[]
  onSprachenChange: (codes: string[]) => void
  prompt: string
  onPromptChange: (value: string) => void
  /** Ein Begriff je Zeile (oder kommagetrennt). */
  keywordsText: string
  onKeywordsTextChange: (value: string) => void
  /** Anzahl der `extractionKnownNames` der Library (werden automatisch ergaenzt). */
  knownNamesCount: number
  disabled?: boolean
}

/** Zeilen oder Kommas trennen; leere Eintraege fallen weg. */
export function parseKeywordsText(text: string): string[] {
  return text
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function AudioTransformContext(props: AudioTransformContextProps) {
  const { sprachen, prompt, keywordsText, knownNamesCount, disabled } = props
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label htmlFor="audio-sprachen" className="text-sm">Sprachen der Aufnahme</Label>
        <SprachenAuswahl id="audio-sprachen" value={sprachen} onChange={props.onSprachenChange} disabled={disabled} />
        <p className="text-xs text-muted-foreground">
          {sprachen.length > 1
            ? 'Gemischte Aufnahme: jede Sprache bleibt im Original stehen.'
            : 'Bei gemischten Aufnahmen alle gesprochenen Sprachen waehlen — sonst entscheidet das Modell je Abschnitt eine Sprache und uebersetzt den Rest hinein.'}
          {' '}Das Transkript wird nicht uebersetzt; Uebersetzen gehoert zur Transformation.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="audio-prompt" className="text-sm">Kontext (Thema, Anlass)</Label>
        <Textarea
          id="audio-prompt"
          rows={2}
          value={prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
          placeholder="z. B. Fortbildung fuer Medienschaffende zu Armut in Suedtirol, Vortrag mit Diskussion"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="audio-keywords" className="text-sm">Begriffe (Namen, Fachwoerter)</Label>
        <Textarea
          id="audio-keywords"
          rows={2}
          value={keywordsText}
          onChange={(e) => props.onKeywordsTextChange(e.target.value)}
          placeholder={"Ein Begriff je Zeile\nz. B. Caritas, Pastoralzentrum Bozen"}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          {knownNamesCount > 0
            ? `${knownNamesCount} bekannte Namen der Library werden automatisch ergaenzt.`
            : 'Die Library hat keine bekannten Namen hinterlegt (Einstellungen → Erweitert).'}
        </p>
      </div>
    </div>
  )
}
