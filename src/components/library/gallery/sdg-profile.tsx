"use client";

import * as React from "react";
import { useTranslation } from "@/lib/i18n/hooks";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";
import { SdgWheel } from "./sdg-wheel";

/**
 * src/components/library/gallery/sdg-profile.tsx
 *
 * Generischer Anzeigeblock fuer das SDG-Profil: Ueberschrift + SDG-Rad + die
 * gemeinsame Begruendung. Reiner Renderer (Props -> JSX). Wird flag-gesteuert
 * im gemeinsamen Detail-Container eingehaengt und ist library-unabhaengig.
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
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <SdgWheel
          values={values}
          labelForId={(id) => titleById.get(id) ?? `SDG ${id}`}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-3">
          {/* Legende: nur Ziele mit Einschaetzung, absteigend nach Grad */}
          <ul className="grid grid-cols-1 gap-1">
            {[...values]
              .filter((v) => v.value !== null)
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
              .map((v) => {
                const sdg = SDG_LIST.find((s) => s.id === v.id);
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 text-xs text-foreground/90"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: sdg?.color }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {titleById.get(v.id)}
                    </span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {Math.round((v.value ?? 0) * 100)}%
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
