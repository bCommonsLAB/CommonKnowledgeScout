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
 * @module components/library/agent-view
 */

import type { AktuellVorhaben } from '@/lib/agent-view/aktuell-sicht'

export interface AktuellSchritteProps {
  vorhaben: readonly AktuellVorhaben[]
  /** Aktive Vorhaben insgesamt — Nenner des Hinweises „x ohne offenen Punkt". */
  aktivGesamt: number
  onOeffnen: (folderId: string) => void
}

export function AktuellSchritte({ vorhaben, aktivGesamt, onOeffnen }: AktuellSchritteProps) {
  const ohnePunkte = aktivGesamt - vorhaben.length

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Was als Nächstes ansteht</h2>

      {vorhaben.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein aktives Vorhaben hat offene Punkte unter &bdquo;## Nächste Schritte&ldquo; — im Zweifel
          sind die Berichte nicht nachgezogen, nicht die Arbeit erledigt.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vorhaben.map((v) => (
            <div key={v.folderId} className="rounded-md border p-3">
              <button
                type="button"
                onClick={() => onOeffnen(v.folderId)}
                className="text-left text-sm font-medium underline-offset-2 hover:underline"
              >
                {v.titel}
              </button>
              <ul className="mt-1 space-y-1">
                {v.offenePunkte.map((punkt) => (
                  <li key={punkt} className="text-xs text-muted-foreground">
                    &bull; {punkt}
                  </li>
                ))}
              </ul>
              {v.weiterePunkte > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{v.weiterePunkte} weitere im Bericht
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {ohnePunkte > 0 && (
        <p className="text-xs text-muted-foreground">
          {ohnePunkte} aktive Vorhaben führen keinen offenen Punkt.
        </p>
      )}
    </section>
  )
}
