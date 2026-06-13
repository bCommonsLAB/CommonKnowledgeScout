"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SDG_LIST, type SdgValue } from "@/lib/gallery/sdg-meta";

/**
 * src/components/library/gallery/sdg-wheel.tsx
 *
 * Generisches SDG-Rad als reines SVG: 17 Tortensegmente (Wedges), je in
 * offizieller SDG-Farbe, von innen nach aussen proportional zum
 * Unterstuetzungsgrad [0, 1] gefuellt. Ein blasses Voll-Segment dient als
 * Track. Fehlende Werte (`null`) bleiben leer. Kein DB-/Storage-Zugriff.
 *
 * Die Geometrie-Helfer sind als pure Funktionen exportiert (Unit-testbar).
 */

/** Winkel (Grad) der Segment-Mitte; Index 0 oben (-90deg), im Uhrzeigersinn. */
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
 * Aeusserer Fuellradius eines Segments fuer einen Wert. `null` -> innerRadius
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

/** SVG-Pfad eines Ringsegments (Wedge) zwischen zwei Winkeln (Grad). */
export function wedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const s0 = polarToCartesian(cx, cy, innerR, startDeg);
  const s1 = polarToCartesian(cx, cy, outerR, startDeg);
  const e1 = polarToCartesian(cx, cy, outerR, endDeg);
  const e0 = polarToCartesian(cx, cy, innerR, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${s0.x} ${s0.y}`,
    `L ${s1.x} ${s1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${e0.x} ${e0.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${s0.x} ${s0.y}`,
    "Z",
  ].join(" ");
}

interface SdgWheelProps {
  values: SdgValue[];
  /** Kantenlaenge des SVG in px. Default 240. */
  size?: number;
  /** Liefert den Anzeigetitel je SDG-Id (fuer Tooltip/a11y). */
  labelForId?: (id: number) => string;
  className?: string;
}

/** Read-only SVG-Rad der 17 SDG-Unterstuetzungsgrade (Tortensegmente). */
export function SdgWheel({
  values,
  size = 240,
  labelForId,
  className,
}: SdgWheelProps): React.JSX.Element {
  const c = size / 2;
  const outerRadius = c - 4;
  const innerRadius = Math.max(10, size * 0.1);
  const count = SDG_LIST.length;
  const segWidth = 360 / count;
  const gap = 0; // Wedges fuellen die Zelle bis zu den Speichen (keine Zwischenraeume)
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
      {/* Farbige Tortensegmente (innen -> aussen gefuellt) */}
      {SDG_LIST.map((sdg, index) => {
        const mid = spokeAngleDeg(index, count);
        const start = mid - segWidth / 2 + gap / 2;
        const end = mid + segWidth / 2 - gap / 2;
        const value = byId.get(sdg.id) ?? null;
        const r = fillRadius(value, innerRadius, outerRadius);
        const label = labelForId ? labelForId(sdg.id) : `SDG ${sdg.id}`;
        const valueText = value === null ? "–" : `${Math.round(value * 100)}%`;

        // Leere/0-Segmente: nur der graue Rahmen bleibt sichtbar.
        if (value === null || value <= 0) return null;

        return (
          <g key={sdg.id}>
            <title>{`SDG ${sdg.id}: ${label} · ${valueText}`}</title>
            <path
              d={wedgePath(c, c, innerRadius, r, start, end)}
              fill={sdg.color}
            />
          </g>
        );
      })}

      {/* Grauer Rahmen ZULETZT (on top): Aussen-/Innenkreis + Speichen als
          Zell-Trenner, damit die Segmente sauber an die Speichen anschliessen. */}
      <g
        className="text-muted-foreground/40"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      >
        <circle cx={c} cy={c} r={outerRadius} />
        <circle cx={c} cy={c} r={innerRadius} />
        {SDG_LIST.map((_, i) => {
          const b = spokeAngleDeg(i, count) - segWidth / 2;
          const p1 = polarToCartesian(c, c, innerRadius, b);
          const p2 = polarToCartesian(c, c, outerRadius, b);
          return (
            <line key={`spoke-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
          );
        })}
      </g>
    </svg>
  );
}
