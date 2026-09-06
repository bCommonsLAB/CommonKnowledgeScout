'use client'

/**
 * @fileoverview Die zwei Termin-Marken der Aktuell-Sicht — EINE Quelle.
 *
 * @description
 * Termin-Leiste und Vorhaben-Tabelle zeigen dieselben zwei Marken. Vor
 * dieser Datei stand dafuer in der Leiste „noch nicht fixiert" und in der
 * Tabelle „offen" — zwei Woerter fuer `termin_fixiert: nein` (Live-Befund
 * 06.09.2026). In der Tabelle las sich „22. September 2026 offen" ausserdem,
 * als sei irgendetwas anderes offen.
 *
 * Beide Stellen rendern jetzt diese Komponente. Wer den Wortlaut aendert,
 * aendert ihn ueberall.
 *
 * @module components/library/agent-view
 */

import { Badge } from '@ks/ui'
import type { AktuellVorhaben } from '@/lib/agent-view/aktuell-sicht'

export interface AktuellTerminMarkenProps {
  vorhaben: AktuellVorhaben
  /** `klein` fuer die Tabellenzelle, `normal` fuer die Termin-Leiste. */
  groesse?: 'normal' | 'klein'
}

export function AktuellTerminMarken({ vorhaben, groesse = 'normal' }: AktuellTerminMarkenProps) {
  const klasse = groesse === 'klein' ? 'h-4 px-1 text-[10px]' : 'h-4 px-1.5 text-[10px]'
  return (
    <>
      {!vorhaben.terminFixiert && (
        <Badge variant="outline" className={klasse} title="termin_fixiert: nein im BERICHT.md">
          noch nicht fixiert
        </Badge>
      )}
      {vorhaben.ueberfaellig && (
        <Badge
          variant="destructive"
          className={klasse}
          title="Der Termin liegt vor heute — naechster_termin im BERICHT.md nachziehen."
        >
          überfällig
        </Badge>
      )}
    </>
  )
}
