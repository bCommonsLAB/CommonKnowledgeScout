"use client"

/**
 * Idee-F-Optionen im Dialog „Aufbereiten & Publizieren" (P6):
 * - Slides als Tabelle fuehren (Transform; nur bei Vorlagen mit Feld `slides`)
 * - Anhaenge als Text in die Suche (Ingest; Library-Voreinstellung vorbelegt)
 *
 * Reine Darstellung; Zustand und Wirkung haelt `PipelineSheet`.
 */

import { Label } from '@ks/ui'

interface SlidesProps {
  /** false = Vorlage hat kein Feld `slides` (oder unbekannt) → Option ausgeblendet. */
  visible: boolean
  checked: boolean
  onChange: (value: boolean) => void
}

function Slides({ visible, checked, onChange }: SlidesProps) {
  if (!visible) return null
  return (
    <div className="ml-[76px] pr-4">
      <div className="flex items-center gap-2">
        <div className="w-14" />
        <input
          type="checkbox"
          id="slides-as-table"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="slides-as-table" className="text-xs text-muted-foreground cursor-pointer">
          Slides als Tabelle fuehren
        </Label>
      </div>
      <p className="ml-16 text-[11px] text-muted-foreground">
        Ohne Haken wird das Feld <code>slides</code> fuer diesen Lauf aus der Vorlage genommen
        (kein Folien-Akkordeon, kuerzere Antwort).
      </p>
    </div>
  )
}

interface AnhangProps {
  checked: boolean
  onChange: (value: boolean) => void
  libraryDefault: boolean
}

function Anhang({ checked, onChange, libraryDefault }: AnhangProps) {
  return (
    <div className="ml-[76px] pr-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="appendix-in-search"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="appendix-in-search" className="text-xs text-muted-foreground cursor-pointer">
          Anhaenge als Text in die Suche
        </Label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Transkripte der verbundenen Quellen werden unsichtbar mit eingebettet. Der Chat findet
        Details, der Index waechst deutlich (Prueffall: 17 Chunks ohne, 239 mit Anhang).
        Voreinstellung der Library: {libraryDefault ? 'an' : 'aus'}.
      </p>
    </div>
  )
}

export const IdeeFOptionen = { Slides, Anhang }
