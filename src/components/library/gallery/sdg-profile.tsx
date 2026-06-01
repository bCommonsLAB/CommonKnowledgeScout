"use client";

import * as React from "react";
import { useTranslation } from "@/lib/i18n/hooks";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";
import { SdgWheelLabeled } from "./sdg-wheel-labeled";

/**
 * src/components/library/gallery/sdg-profile.tsx
 *
 * Generischer Anzeigeblock fuer das SDG-Profil: (optional) Ueberschrift +
 * SDG-Rad (Tortensegmente + offizieller Icon-Ring, Detail per Tooltip) +
 * gemeinsame Begruendung. Reiner Renderer (Props -> JSX), library-unabhaengig.
 *
 * `embedded`: ohne eigene Card + Ueberschrift (z.B. innerhalb eines Accordions).
 */

interface SdgProfileProps {
  values: SdgValue[];
  begruendung?: string | null;
  embedded?: boolean;
}

/** SDG-Profil-Sektion (Rad + Begruendung). */
export function SdgProfile({
  values,
  begruendung,
  embedded = false,
}: SdgProfileProps): React.JSX.Element {
  const { t } = useTranslation();
  const titleById = new Map(
    SDG_LIST.map((sdg) => [sdg.id, t(`sdgProfile.${sdg.titleKey}`)]),
  );

  const inner = (
    <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-12">
      <SdgWheelLabeled
        values={values}
        labelForId={(id) => titleById.get(id) ?? `SDG ${id}`}
        noDataText={t("sdgProfile.noData")}
        size={380}
        className="mx-auto lg:mx-0"
      />
      {begruendung ? (
        <div className="min-w-0 flex-1 lg:pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("sdgProfile.begruendungLabel")}
          </h3>
          <p className="text-xs whitespace-pre-line text-blue-800 dark:text-blue-300">
            {begruendung}
          </p>
        </div>
      ) : null}
    </div>
  );

  if (embedded) return inner;

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t("sdgProfile.title")}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {t("sdgProfile.aiNotice")}
        </span>
      </div>
      {inner}
    </section>
  );
}
