/**
 * `cn` — Klassen-Zusammenfuehrung der shadcn-Basis.
 *
 * Stammt aus `src/lib/utils.ts`; die dort ebenfalls beheimateten
 * Audio-/Video-Fehlertexte sind Fachlogik und in der App geblieben
 * (Welle M4b, `git log --follow` zeigt die Herkunft).
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
