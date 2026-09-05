'use client'

/**
 * @fileoverview Randbereiche der Aktuell-Sicht (Welle A7): Ruhendes + Lücken.
 *
 * @description
 * Was nicht auf dem Tisch liegt, aber sichtbar bleiben muss: ruhende und
 * abgeschlossene Vorhaben (zusammengeklappt), Berichte OHNE `status:` (die
 * Sicht kann sie nicht einordnen) und Vorhaben ganz ohne `BERICHT.md` (die
 * Abdeckungslücke). Alle drei sind benannte Zustände, keine Leerstellen —
 * ein Vorhaben verschwindet hier nicht, nur weil sein Frontmatter dünn ist.
 *
 * @module components/library/agent-view
 */

import { Badge } from '@ks/ui'
import type { AktuellSicht } from '@/lib/agent-view/aktuell-sicht'
import { datumLesbar } from '@/lib/agent-view/sichten/types'

export interface AktuellRandbereicheProps {
  sicht: AktuellSicht
  onOeffnen: (folderId: string) => void
}

export function AktuellRandbereiche({ sicht, onOeffnen }: AktuellRandbereicheProps) {
  return (
    <div className="space-y-3">
      {sicht.ruhend.length > 0 && (
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Ruhend und abgeschlossen <Badge variant="secondary">{sicht.ruhend.length}</Badge>
          </summary>
          <ul className="mt-2 space-y-1">
            {sicht.ruhend.map((v) => (
              <li key={v.folderId} className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => onOeffnen(v.folderId)}
                  className="text-left underline-offset-2 hover:underline"
                >
                  {v.titel}
                </button>
                {' — '}
                {v.status}
                {v.letzteAktivitaet !== null && `, zuletzt ${datumLesbar(v.letzteAktivitaet)}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {sicht.ohneStatus.length > 0 && (
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Bericht ohne <code>status:</code> <Badge variant="secondary">{sicht.ohneStatus.length}</Badge>
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Diese Vorhaben haben einen Bericht, erklären aber nicht, ob sie laufen. Ohne das Feld
            kann die Sicht sie weder als aktiv noch als ruhend führen — <code>status:</code> im
            Frontmatter nachtragen.
          </p>
          <ul className="mt-1 space-y-1">
            {sicht.ohneStatus.map((v) => (
              <li key={v.folderId} className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => onOeffnen(v.folderId)}
                  className="text-left underline-offset-2 hover:underline"
                >
                  {v.titel}
                </button>
                {' · '}
                {v.path}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Abdeckung:</span> {sicht.mitBericht} Vorhaben
        haben einen Bericht
        {sicht.ohneBericht > 0 && (
          <>
            , {sicht.ohneBericht} nicht — diese erscheinen hier nicht. Der Befund{' '}
            <code>report_missing</code> führt sie in der Werkbank.
          </>
        )}
        {sicht.ohneBericht === 0 && '. Jedes erkannte Vorhaben ist erfasst.'}
      </p>
    </div>
  )
}
