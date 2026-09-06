'use client'

/**
 * @fileoverview „Was als Nächstes ansteht" der Aktuell-Sicht (Welle A7).
 *
 * @description
 * Die offenen Punkte aus „## Nächste Schritte" der Berichte — wie in
 * `AKTUELL.md` die ersten zwei je Vorhaben. Anders als die Datei sagt die
 * Sicht, wenn sie kappt: „+3 weitere im Bericht" statt stillem Abschneiden
 * (`no-silent-fallbacks.mdc`).
 *
 * Seit dem Live-Bild vom 06.09.2026 zweigeteilt: Offen stehen nur die
 * Vorhaben MIT Termin — das ist, was diese Woche ansteht. Die übrigen
 * (dort 14 von 20 Kacheln) sind der Vorrat und liegen zusammengeklappt
 * darunter. Sie verschwinden nicht, sie drängen sich nur nicht mehr vor.
 *
 * @module components/library/agent-view
 */

import type { AktuellVorhaben } from '@/lib/agent-view/aktuell-sicht'
import { datumLesbar } from '@/lib/agent-view/sichten/types'

export interface AktuellSchritteProps {
  /** Vorhaben mit Termin UND offenen Punkten — der Vordergrund. */
  mitTermin: readonly AktuellVorhaben[]
  /** Vorhaben mit offenen Punkten, aber ohne Termin — der Vorrat. */
  ohneTermin: readonly AktuellVorhaben[]
  /** Aktive Vorhaben insgesamt — Nenner des Hinweises „x ohne offenen Punkt". */
  aktivGesamt: number
  onOeffnen: (folderId: string) => void
}

function Kachel({
  vorhaben,
  onOeffnen,
  mitDatum,
}: {
  vorhaben: AktuellVorhaben
  onOeffnen: (folderId: string) => void
  mitDatum: boolean
}) {
  return (
    <div className="rounded-md border p-3">
      <button
        type="button"
        onClick={() => onOeffnen(vorhaben.folderId)}
        className="text-left text-sm font-medium underline-offset-2 hover:underline"
      >
        {vorhaben.titel}
      </button>
      {mitDatum && vorhaben.naechsterTermin !== null && (
        <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
          {datumLesbar(vorhaben.naechsterTermin)}
        </span>
      )}
      <ul className="mt-1 space-y-1">
        {vorhaben.offenePunkte.map((punkt) => (
          <li key={punkt} className="text-xs text-muted-foreground">
            &bull; {punkt}
          </li>
        ))}
      </ul>
      {vorhaben.weiterePunkte > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">+{vorhaben.weiterePunkte} weitere im Bericht</p>
      )}
    </div>
  )
}

export function AktuellSchritte({ mitTermin, ohneTermin, aktivGesamt, onOeffnen }: AktuellSchritteProps) {
  const ohnePunkte = aktivGesamt - mitTermin.length - ohneTermin.length

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Was als Nächstes ansteht</h2>

      {mitTermin.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein Vorhaben mit Termin führt offene Punkte unter &bdquo;## Nächste Schritte&ldquo;. Im
          Zweifel sind die Berichte nicht nachgezogen, nicht die Arbeit erledigt.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mitTermin.map((v) => (
            <Kachel key={v.folderId} vorhaben={v} onOeffnen={onOeffnen} mitDatum />
          ))}
        </div>
      )}

      {ohneTermin.length > 0 && (
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            {ohneTermin.length} laufende Vorhaben ohne Termin
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              — offene Punkte, aber kein Datum, das sie einfordert
            </span>
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ohneTermin.map((v) => (
              <Kachel key={v.folderId} vorhaben={v} onOeffnen={onOeffnen} mitDatum={false} />
            ))}
          </div>
        </details>
      )}

      {ohnePunkte > 0 && (
        <p className="text-xs text-muted-foreground">
          {ohnePunkte} aktive Vorhaben führen keinen offenen Punkt.
        </p>
      )}
    </section>
  )
}
