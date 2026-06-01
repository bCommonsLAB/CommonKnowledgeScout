"use client";

import * as React from "react";
import { useTranslation } from "@/lib/i18n/hooks";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";
import { SdgWheelLabeled } from "./sdg-wheel-labeled";
import { SdgIcon } from "./sdg-icon";

/**
 * src/components/library/gallery/sdg-profile.tsx
 *
 * Generischer Anzeigeblock fuer das SDG-Profil: Ueberschrift + voll beschriftetes
 * SDG-Rad (offizielle Icons + Tooltips) + vollstaendige Legende (alle 17 Ziele)
 * + gemeinsame Begruendung. Reiner Renderer (Props -> JSX), library-unabhaengig.
 */

interface SdgProfileProps {
  values: SdgValue[];
  begruendung?: string | null;
}

/** SDG-Profil-Sektion (beschriftetes Rad + Legende + Begruendung). */
export function SdgProfile({
  values,
  begruendung,
}: SdgProfileProps): React.JSX.Element {
  const { t } = useTranslation();
  const titleById = new Map(
    SDG_LIST.map((sdg) => [sdg.id, t(`sdgProfile.${sdg.titleKey}`)]),
  );
  const valueById = new Map(values.map((v) => [v.id, v.value]));
  const noData = t("sdgProfile.noData");

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("sdgProfile.title")}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {t("sdgProfile.aiNotice")}
        </span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <SdgWheelLabeled
          values={values}
          labelForId={(id) => titleById.get(id) ?? `SDG ${id}`}
          noDataText={noData}
          className="mx-auto lg:mx-0"
        />
        <div className="min-w-0 flex-1 space-y-3">
          {/* Vollstaendige Legende: alle 17 Ziele in fester Reihenfolge. */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {SDG_LIST.map((sdg) => {
              const value = valueById.get(sdg.id) ?? null;
              return (
                <li
                  key={sdg.id}
                  className="flex items-center gap-2 text-xs text-foreground/90"
                >
                  <SdgIcon id={sdg.id} color={sdg.color} size={18} className="shrink-0" />
                  <span className="truncate">{titleById.get(sdg.id)}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {value === null ? noData : `${Math.round(value * 100)}%`}
                  </span>
                </li>
              );
            })}
          </ul>
          {begruendung ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("sdgProfile.begruendungLabel")}
              </h3>
              <p className="text-xs text-foreground/90 whitespace-pre-line">
                {begruendung}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
