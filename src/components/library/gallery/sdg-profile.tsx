"use client";

import * as React from "react";
import { useTranslation } from "@/lib/i18n/hooks";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";
import { SdgWheelLabeled } from "./sdg-wheel-labeled";

/**
 * src/components/library/gallery/sdg-profile.tsx
 *
 * Generischer Anzeigeblock fuer das SDG-Profil: Ueberschrift + SDG-Rad
 * (Tortensegmente + offizieller Icon-Ring, Detail per Tooltip) + gemeinsame
 * Begruendung. Bewusst schlank gehalten. Reiner Renderer (Props -> JSX),
 * library-unabhaengig.
 */

interface SdgProfileProps {
  values: SdgValue[];
  begruendung?: string | null;
}

/** SDG-Profil-Sektion (Rad + Begruendung). */
export function SdgProfile({
  values,
  begruendung,
}: SdgProfileProps): React.JSX.Element {
  const { t } = useTranslation();
  const titleById = new Map(
    SDG_LIST.map((sdg) => [sdg.id, t(`sdgProfile.${sdg.titleKey}`)]),
  );

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
          noDataText={t("sdgProfile.noData")}
          className="mx-auto lg:mx-0"
        />
        {begruendung ? (
          <div className="min-w-0 flex-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {t("sdgProfile.begruendungLabel")}
            </h3>
            <p className="text-xs text-foreground/90 whitespace-pre-line">
              {begruendung}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
