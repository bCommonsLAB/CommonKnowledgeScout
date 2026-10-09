"use client";

/**
 * Kontext-Felder der Audio-Transkription (P3a): Sprecher-Erkennung,
 * Sprachen der Aufnahme, Thema/Anlass und Begriffe fuer diese Datei. Reine Eingabe-Komponente —
 * eingebunden im Dialog „Aufbereiten & Publizieren" (Schritt „Transkript
 * erstellen", Optionen; `flow/pipeline-sheet.tsx`). Die Werte gehen als
 * `speakerMode`, `audioLanguages`, `audioPrompt`, `audioKeywords` ueber `/api/pipeline/process`
 * an den Job; die bekannten Namen der Library ergaenzt der Server
 * (`resolveAudioJobContext`). Dieselben Feldnamen versteht
 * `/api/secretary/process-audio/job` (Erfassungs-Wizard).
 */

import { Input, Label, Switch, Textarea } from '@ks/ui'

export interface AudioTransformContextProps {
  speakerMode: boolean
  onSpeakerModeChange: (value: boolean) => void
  prompt: string
  onPromptChange: (value: string) => void
  /** Ein Begriff je Zeile (oder kommagetrennt). */
  keywordsText: string
  onKeywordsTextChange: (value: string) => void
  /** Sprachcodes als Text („de, it"). */
  languagesText: string
  onLanguagesTextChange: (value: string) => void
  /** Eintraege, die kein Sprachcode sind. */
  invalidLanguages: string[]
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
  const { speakerMode, prompt, keywordsText, languagesText, invalidLanguages, knownNamesCount, disabled } = props
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="audio-speaker-mode" className="text-sm">Sprecher erkennen</Label>
          <p className="text-xs text-muted-foreground">
            Ein Absatz je Sprecherwechsel (&bdquo;Sprecher A&ldquo;). Die Zuordnung zu Namen
            bestaetigt spaeter ein Mensch im Korrektur-Schritt.
          </p>
        </div>
        <Switch
          id="audio-speaker-mode"
          checked={speakerMode}
          onCheckedChange={props.onSpeakerModeChange}
          disabled={disabled}
          aria-label="Sprecher erkennen"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="audio-languages" className="text-sm">Sprachen der Aufnahme</Label>
        <Input
          id="audio-languages"
          value={languagesText}
          onChange={(e) => props.onLanguagesTextChange(e.target.value)}
          placeholder="z. B. de, it"
          className="h-8 text-xs"
          disabled={disabled}
        />
        {invalidLanguages.length > 0 ? (
          <p className="text-xs text-destructive">Kein Sprachcode: {invalidLanguages.join(', ')} &mdash; zwei Buchstaben, z. B. de, it.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Alle Sprachen, die gesprochen werden. Ohne Angabe waehlt das Modell je Abschnitt eine
            Sprache und uebersetzt den Rest hinein.
          </p>
        )}
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

      {speakerMode && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Im Sprecher-Modus nimmt die Transkription keinen Kontext an; Sprachen, Thema und
          Begriffe wirken erst im Korrektur-Schritt.
        </p>
      )}
    </div>
  )
}
