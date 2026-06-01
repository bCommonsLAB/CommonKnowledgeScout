"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { sdgIconPath } from "@/lib/gallery/sdg-meta";

/**
 * src/components/library/gallery/sdg-icon.tsx
 *
 * Quadratische SDG-Kachel in offizieller Farbe. Laedt das offizielle UN-Icon
 * aus `public/sdg-icons/sdg-<id>.svg`. Fehlt die Datei, bleibt die farbige
 * Kachel mit der Ziel-Nummer als Fallback sichtbar (kein Silent Fallback auf
 * leer). Reiner Renderer (kein Storage-/DB-Zugriff).
 */

interface SdgIconProps {
  /** Ziel-Nummer 1..17. */
  id: number;
  /** Offizielle SDG-Farbe (Hex) fuer Kachel/Fallback. */
  color: string;
  /** Kantenlaenge in px. Default 32. */
  size?: number;
  className?: string;
}

/** Farbige SDG-Kachel mit offiziellem Icon und Nummer-Fallback. */
export function SdgIcon({
  id,
  color,
  size = 32,
  className,
}: SdgIconProps): React.JSX.Element {
  const [hasIcon, setHasIcon] = React.useState(true);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-[3px]",
        className,
      )}
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {/* Fallback (immer im Hintergrund): Ziel-Nummer auf farbiger Kachel. */}
      <span
        className="absolute inset-0 flex items-center justify-center font-bold leading-none text-white"
        style={{ fontSize: Math.max(9, size * 0.42) }}
        aria-hidden
      >
        {id}
      </span>
      {/* Offizielles Icon ueberlagert die Kachel, sobald es laedt. */}
      {hasIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sdgIconPath(id)}
          alt=""
          width={size}
          height={size}
          className="relative h-full w-full object-contain"
          onError={() => setHasIcon(false)}
        />
      ) : null}
    </span>
  );
}
