"use client";

import * as React from "react";
import { STAKEHOLDER_KONSENT } from "@/lib/gallery/stakeholder-meta";

/**
 * src/components/library/gallery/stakeholder-positions.tsx
 *
 * SCHEMATISCHES Mockup des Konsent-Vergleichs ("Schachbrett") der einzelnen
 * Interessengruppen (OHNE Landesverwaltung — die ist die Schlussredaktion und
 * hat einen eigenen Abschnitt). Die Akteur-Kacheln sind aktuell nur ausgegraut
 * angedeutet (noch ohne Funktion); darunter ein Konsens/Consent-Text (vorerst
 * leer).
 *
 * Vollausbau siehe docs/architecture/massnahmen-positionen-wahlomat-zielbild.md
 */

interface StakeholderPositionsProps {
  /** Konsens/Consent-Text (vorerst meist leer). */
  konsens?: string | null;
  /** Eingebettet (z.B. im Accordion): ohne eigene Card + Ueberschrift. */
  embedded?: boolean;
}

export function StakeholderPositions({
  konsens,
  embedded = false,
}: StakeholderPositionsProps): React.JSX.Element {
  const body = (
    <>
      {/* Schachbrett der Akteure (alle schematisch/ausgegraut) */}
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

      {/* Konsens / Consent (vorerst leer) */}
      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Konsens / Consent
        </h3>
        <p className="text-xs text-muted-foreground italic">
          {konsens ||
            "Noch kein Konsens-Text — entsteht aus den Positionen der Akteure und der Diskussion."}
        </p>
      </div>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Konsent der Interessengruppen
        </h2>
        <span className="text-[10px] text-muted-foreground">Schematisch</span>
      </div>
      {body}
    </section>
  );
}
