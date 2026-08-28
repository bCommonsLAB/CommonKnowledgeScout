/**
 * `cn` — Klassen-Zusammenfuehrung (clsx + tailwind-merge).
 *
 * Stammt aus `src/lib/utils.ts` (Welle M4b); die dort ebenfalls beheimateten
 * Audio-/Video-Fehlertexte sind Fachlogik und in der App geblieben. Lag
 * zunaechst in `@ks/ui` und liegt seit dem Build-Befund zu den Client-Grenzen
 * hier: `cn` wird auch serverseitig gebraucht und darf deshalb nicht an einem
 * Paket voller Client-Komponenten haengen.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
