'use client'

/**
 * @fileoverview Listen-Bereich der linken Werkbank-Spalte (F7, Welle W6).
 *
 * @description
 * Buendel aus Listen-Leiste (Auswahl/Anlegen/Loeschen), Fortschrittskopf
 * und toten Eintraegen — sichtbar nur im Filter-Modus „Liste". Haelt das
 * Panel unter der 200-Zeilen-Grenze; alle Ableitungen kommen fertig aus
 * `use-werkbank-liste`.
 *
 * @module components/library/agent-view
 */

import type { useWerkbankListe } from '@/hooks/agent-view/use-werkbank-liste'
import { WerkbankFortschritt } from './werkbank-fortschritt'
import { WerkbankListenLeiste } from './werkbank-listen-leiste'
import { WerkbankToteEintraege } from './werkbank-tote-eintraege'

export function WerkbankListenBereich({
  arbeitsliste,
  onWaehleListe,
}: {
  arbeitsliste: ReturnType<typeof useWerkbankListe>
  onWaehleListe: (listId: string | null) => void
}) {
  return (
    <>
      <WerkbankListenLeiste
        lists={arbeitsliste.lists}
        aktiveListeId={arbeitsliste.aktiveListe?.listId ?? null}
        onWaehleListe={onWaehleListe}
        worklists={arbeitsliste.worklists}
        seedKandidaten={arbeitsliste.seedKandidaten}
      />
      {arbeitsliste.fortschritt !== null && <WerkbankFortschritt fortschritt={arbeitsliste.fortschritt} />}
      {arbeitsliste.kreuzung !== null && (
        <WerkbankToteEintraege
          tote={arbeitsliste.kreuzung.tote}
          onEntfernen={(folderId) => void arbeitsliste.entferneTot(folderId)}
        />
      )}
    </>
  )
}
