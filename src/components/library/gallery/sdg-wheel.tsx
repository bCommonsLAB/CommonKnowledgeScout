"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";

/**
 * src/components/library/gallery/sdg-wheel.tsx
 *
 * Generisches SDG-Rad: 17 radiale Speichen, je in offizieller SDG-Farbe, von
 * innen nach aussen proportional zum Unterstuetzungsgrad [0, 1] gefuellt. Reiner
 * SVG-Renderer (kein DB-/Storage-Zugriff). Fehlende Werte (`null`) bleiben leer.
 *
 * Die Geometrie-Helfer sind als pure Funktionen exportiert (Unit-testbar).
 */

/** Winkel (Grad) einer Speiche; Index 0 oben (-90deg), im Uhrzeigersinn. */
export function spokeAngleDeg(index: number, count: number): number {
  return -90 + (index * 360) / count;
}

/** Polar -> Kartesisch (SVG-Koordinaten, y nach unten). */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/**
 * Aeusserer Fuellradius einer Speiche fuer einen Wert. `null` -> innerRadius
 * (leer). Werte ausserhalb [0, 1] werden geklemmt.
 */
export function fillRadius(
  value: number | null,
  innerRadius: number,
  outerRadius: number,
): number {
  if (value === null || !Number.isFinite(value)) return innerRadius;
  const v = value < 0 ? 0 : value > 1 ? 1 : value;
  return innerRadius + v * (outerRadius - innerRadius);
}

interface SdgWheelProps {
  values: SdgValue[];
  /** Kantenlaenge des SVG in px. Default 240. */
  size?: number;
  /** Liefert den Anzeigetitel je SDG-Id (fuer Tooltip/a11y). */
  labelForId?: (id: number) => string;
  className?: string;
}

/** Read-only SVG-Rad der 17 SDG-Unterstuetzungsgrade. */
export function SdgWheel({
  values,
  size = 240,
  labelForId,
  className,
}: SdgWheelProps): React.JSX.Element {
  const center = size / 2;
  const outerRadius = center - 14;
  const innerRadius = Math.max(12, size * 0.11);
  const count = SDG_LIST.length;
  // Speichenbreite so, dass benachbarte Speichen sich nicht beruehren.
  const strokeWidth = ((2 * Math.PI * outerRadius) / count) * 0.62;

  const byId = new Map(values.map((v) => [v.id, v.value]));

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn("max-w-full", className)}
      role="img"
      aria-label="SDG-Profil"
    >
      {SDG_LIST.map((sdg, index) => {
        const angle = spokeAngleDeg(index, count);
        const value = byId.get(sdg.id) ?? null;
        const inner = polarToCartesian(center, center, innerRadius, angle);
        const outer = polarToCartesian(center, center, outerRadius, angle);
        const filled = polarToCartesian(
          center,
          center,
          fillRadius(value, innerRadius, outerRadius),
          angle,
        );
        const label = labelForId ? labelForId(sdg.id) : `SDG ${sdg.id}`;
        const valueText = value === null ? "–" : `${Math.round(value * 100)}%`;

        return (
          <g key={sdg.id}>
            <title>{`SDG ${sdg.id}: ${label} · ${valueText}`}</title>
            {/* Track (volle Laenge, blass) */}
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={sdg.color}
              strokeOpacity={0.15}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Gefuellter Anteil (innen -> aussen) */}
            {value !== null && value > 0 && (
              <line
                x1={inner.x}
                y1={inner.y}
                x2={filled.x}
                y2={filled.y}
                stroke={sdg.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
      {/* Nabe mit Ziel-Nummern aussen */}
      {SDG_LIST.map((sdg, index) => {
        const angle = spokeAngleDeg(index, count);
        const pos = polarToCartesian(center, center, outerRadius + 8, angle);
        return (
          <text
            key={`label-${sdg.id}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: Math.max(7, size * 0.038) }}
          >
            {sdg.id}
          </text>
        );
      })}
    </svg>
  );
}
