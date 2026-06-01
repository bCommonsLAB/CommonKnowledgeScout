"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";
import { SdgWheel, spokeAngleDeg, polarToCartesian } from "./sdg-wheel";
import { SdgIcon } from "./sdg-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * src/components/library/gallery/sdg-wheel-labeled.tsx
 *
 * Voll beschriftetes SDG-Rad im Stil des offiziellen UN-Rads: zentrale radiale
 * Speichen (SdgWheel) plus ein aeusserer Ring aus 17 offiziellen SDG-Icon-
 * Kacheln. Jede Kachel ist Tooltip-Trigger (Kurztitel + Unterstuetzungsgrad als
 * Erklaerung). Reiner Renderer (Props -> JSX), library-unabhaengig.
 */

interface SdgWheelLabeledProps {
  values: SdgValue[];
  /** Liefert den Kurztitel je SDG-Id (i18n) fuer Tooltip/a11y. */
  labelForId: (id: number) => string;
  /** Gesamtkantenlaenge des Rads in px. Default 460. */
  size?: number;
  /** Text fuer "keine Einschaetzung" (i18n). */
  noDataText?: string;
  className?: string;
}

/** SDG-Rad mit offiziellem Icon-Ring und Tooltips. */
export function SdgWheelLabeled({
  values,
  labelForId,
  size = 460,
  noDataText = "–",
  className,
}: SdgWheelLabeledProps): React.JSX.Element {
  const center = size / 2;
  const tile = Math.round(size * 0.1);
  const ringRadius = center - tile / 2 - 4;
  const wheelSize = Math.round(size - tile * 2 - 24);
  const byId = new Map(values.map((v) => [v.id, v.value]));

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn("relative shrink-0 max-w-full", className)}
        style={{ width: size, height: size }}
      >
        {/* Zentrale radiale Speichen */}
        <div
          className="absolute"
          style={{
            left: (size - wheelSize) / 2,
            top: (size - wheelSize) / 2,
          }}
        >
          <SdgWheel values={values} size={wheelSize} labelForId={labelForId} />
        </div>

        {/* Aeusserer Ring: 17 offizielle SDG-Icons als Tooltip-Trigger */}
        {SDG_LIST.map((sdg, index) => {
          const angle = spokeAngleDeg(index, SDG_LIST.length);
          const pos = polarToCartesian(center, center, ringRadius, angle);
          const value = byId.get(sdg.id) ?? null;
          const valueText =
            value === null ? noDataText : `${Math.round(value * 100)}%`;
          const title = labelForId(sdg.id);

          return (
            <Tooltip key={sdg.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ left: pos.x, top: pos.y }}
                  aria-label={`SDG ${sdg.id}: ${title} – ${valueText}`}
                >
                  <SdgIcon id={sdg.id} color={sdg.color} size={tile} muted />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: sdg.color }}
                    aria-hidden
                  />
                  <span className="font-medium">SDG {sdg.id}</span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums">
                    {valueText}
                  </span>
                </div>
                <div className="mt-0.5 text-muted-foreground">{title}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
