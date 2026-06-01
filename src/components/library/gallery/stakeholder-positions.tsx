"use client";

import * as React from "react";
import { STAKEHOLDER_KONSENT } from "@/lib/gallery/stakeholder-meta";

/**
 * src/components/library/gallery/stakeholder-positions.tsx
 *
 * SCHEMATISCHES Schachbrett der Stakeholder-Positionen (OHNE Landesverwaltung
 * — die ist die Schlussredaktion und hat einen eigenen Abschnitt). Die
 * Akteur-Kacheln sind aktuell nur ausgegraut angedeutet (noch ohne Funktion).
 * Der Konsens-/Consent-Text steht NICHT mehr hier, sondern im umgebenden
 * Abschnitt ("Was wird vorgeschlagen?").
 *
 * Vollausbau siehe docs/architecture/massnahmen-positionen-wahlomat-zielbild.md
 */

interface StakeholderPositionsProps {
  /** Eingebettet (z.B. im Accordion): ohne eigene Card + Ueberschrift. */
  embedded?: boolean;
}

export function StakeholderPositions({
  embedded = false,
}: StakeholderPositionsProps): React.JSX.Element {
  const grid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {STAKEHOLDER_KONSENT.map((group) => {
        const Icon = group.icon;
        return (
          <div
            key={group.key}
            aria-disabled
            title="In Vorbereitung"
            className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-2 opacity-50 cursor-not-allowed"
            style={{ borderLeftWidth: 3, borderLeftColor: group.color }}
          >
            <span className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground truncate">
                {group.label}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">In Vorbereitung</span>
          </div>
        );
      })}
    </div>
  );

  if (embedded) return grid;

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Konsent der Stakeholder
        </h2>
        <span className="text-[10px] text-muted-foreground">Schematisch</span>
      </div>
      {grid}
    </section>
  );
}
