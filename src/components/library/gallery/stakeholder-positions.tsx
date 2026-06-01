"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { STAKEHOLDER_LIST } from "@/lib/gallery/stakeholder-meta";

/**
 * src/components/library/gallery/stakeholder-positions.tsx
 *
 * SCHEMATISCHES Mockup des Positionen-Vergleichs ("Schachbrett"):
 * - nur die Kachel `landesverwaltung` ist aktiv und anklickbar
 *   (Auswahl -> Begruendung im Detail),
 * - die uebrigen Gruppen werden nur ausgegraut angedeutet (ohne Funktion),
 * - darunter ein Konsens/Consent-Abschnitt (vorerst leer).
 *
 * Vollausbau siehe docs/architecture/massnahmen-positionen-wahlomat-zielbild.md
 */

interface StakeholderPositionsProps {
  /** Position der Landesverwaltung (Kurztext). */
  position?: string | null;
  /** Begruendung der Landesverwaltung (Detail bei Auswahl). */
  begruendung?: string | null;
  /** Konsens/Consent-Text (vorerst meist leer). */
  konsens?: string | null;
}

export function StakeholderPositions({
  position,
  begruendung,
  konsens,
}: StakeholderPositionsProps): React.JSX.Element {
  const [selected, setSelected] = React.useState(false);

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Positionen der Interessengruppen
        </h2>
        <span className="text-[10px] text-muted-foreground">Schematisch</span>
      </div>

      {/* Schachbrett: 10 Kacheln, nur Landesverwaltung aktiv */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {STAKEHOLDER_LIST.map((group) => {
          const Icon = group.icon;
          if (group.active) {
            const isOpen = selected;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setSelected((v) => !v)}
                aria-pressed={isOpen}
                className={cn(
                  "flex flex-col gap-1 rounded-md border bg-background p-2 text-left transition-colors",
                  "hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isOpen ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border",
                )}
                style={{ borderLeftWidth: 3, borderLeftColor: group.color }}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: group.color }} />
                  <span className="text-xs font-medium truncate">{group.label}</span>
                </span>
                <span className="text-[11px] text-muted-foreground line-clamp-2">
                  {position || "Position folgt"}
                </span>
              </button>
            );
          }
          // Angedeutete, ausgegraute Kacheln (noch ohne Funktion)
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

      {/* Detail der ausgewaehlten (Landesverwaltung-)Kachel */}
      {selected && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Landesverwaltung · Begründung
          </h3>
          <p className="text-xs text-foreground/90 whitespace-pre-line">
            {begruendung || "Noch keine Begründung hinterlegt."}
          </p>
        </div>
      )}

      {/* Konsens / Consent (vorerst leer) */}
      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Konsens / Consent
        </h3>
        <p className="text-xs text-muted-foreground italic">
          {konsens || "Noch kein Konsens-Text — entsteht aus den Positionen und der Diskussion."}
        </p>
      </div>
    </section>
  );
}
