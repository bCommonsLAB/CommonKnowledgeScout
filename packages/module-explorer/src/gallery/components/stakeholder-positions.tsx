"use client";

import * as React from "react";
import { useTranslation } from "@ks/i18n/react";
import { STAKEHOLDER_KONSENT } from "../lib/stakeholder-meta";

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
  const { t } = useTranslation();
  const inVorbereitung = t("climateDetail.inVorbereitung");
  const grid = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {STAKEHOLDER_KONSENT.map((group) => {
        const Icon = group.icon;
        return (
          <div
            key={group.key}
            aria-disabled
            title={inVorbereitung}
            className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-2 opacity-50 cursor-not-allowed"
            style={{ borderLeftWidth: 3, borderLeftColor: group.color }}
          >
            <span className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground truncate">
                {t(`climateDetail.stakeholder.${group.key}`)}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground">{inVorbereitung}</span>
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
          {t("climateDetail.konsentStakeholder")}
        </h2>
        <span className="text-[10px] text-muted-foreground">{t("climateDetail.schematisch")}</span>
      </div>
      {grid}
    </section>
  );
}
