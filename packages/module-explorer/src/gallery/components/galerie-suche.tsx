'use client'

import { Input } from '@ks/ui'
import { Search } from 'lucide-react'

export interface GalerieSucheProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

/**
 * Suchfeld der Galerie als eigener Baustein (Plan galerie-buergeransicht, G4):
 * im geführten Profil steht es in der Leiste neben dem Fokus-Umschalter
 * (Figma), im Expertenmodus weiter in der Ansichtszeile des Kopfs. Schrumpft
 * zuerst, damit die Knopfzeile einzeilig bleibt (Owner-Regel 08.10.2026).
 */
export function GalerieSuche({ value, onChange, placeholder }: GalerieSucheProps) {
  return (
    <div className="relative min-w-[6rem] flex-1" data-galerie-suche>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 pl-8 text-sm"
        aria-label={placeholder}
      />
    </div>
  )
}
