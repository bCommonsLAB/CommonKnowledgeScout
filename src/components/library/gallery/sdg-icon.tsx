"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { sdgIconPath } from "@/lib/gallery/sdg-meta";

/**
 * src/components/library/gallery/sdg-icon.tsx
 *
 * Quadratische SDG-Kachel mit offiziellem UN-Icon aus
 * `public/sdg-icons/E-WEB-Goal-NN.png`. Fehlt die Datei, bleibt die Ziel-Nummer
 * als Fallback sichtbar (kein Silent Fallback auf leer). Reiner Renderer.
 *
 * `muted`: Icon dezent in Graustufen + halbtransparent; faerbt sich bei Hover
 * auf dem umschliessenden `.group`-Element in die Echtfarbe (group-hover).
 */

interface SdgIconProps {
  /** Ziel-Nummer 1..17. */
  id: number;
  /** Offizielle SDG-Farbe (Hex) fuer Kachel/Fallback. */
  color: string;
  /** Kantenlaenge in px. Default 32. */
  size?: number;
  /** Dezent (Graustufen/transparent) mit Echtfarbe bei group-hover. */
  muted?: boolean;
  className?: string;
}

/** Farbige SDG-Kachel mit offiziellem Icon und Nummer-Fallback. */
export function SdgIcon({
  id,
  color,
  size = 32,
  muted = false,
  className,
}: SdgIconProps): React.JSX.Element {
  const [hasIcon, setHasIcon] = React.useState(true);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-[3px]",
        className,
      )}
      style={{
        backgroundColor: muted ? "transparent" : color,
        width: size,
        height: size,
      }}
    >
      {/* Fallback NUR wenn das Icon nicht laedt: Ziel-Nummer auf der Kachel.
          (Das offizielle Icon enthaelt seine Nummer bereits selbst.) */}
      {!hasIcon && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold leading-none",
            muted ? "text-muted-foreground" : "text-white",
          )}
          style={{ fontSize: Math.max(9, size * 0.42) }}
          aria-hidden
        >
          {id}
        </span>
      )}
      {/* Offizielles Icon. Im muted-Modus s/w + transparent, Echtfarbe bei Hover. */}
      {hasIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sdgIconPath(id)}
          alt=""
          width={size}
          height={size}
          className={cn(
            "relative h-full w-full object-contain",
            muted &&
              "opacity-40 grayscale transition-[opacity,filter] duration-150 group-hover:opacity-100 group-hover:grayscale-0",
          )}
          onError={() => setHasIcon(false)}
        />
      ) : null}
    </span>
  );
}
