import {
  Landmark,
  Vote,
  Building2,
  Briefcase,
  Wheat,
  Mountain,
  Leaf,
  HeartHandshake,
  GraduationCap,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * src/lib/gallery/stakeholder-meta.ts
 *
 * Feste Taxonomie der Interessengruppen fuer den Positionen-Vergleich
 * (Schachbrett). SCHEMATISCH: aktuell ist nur `landesverwaltung` aktiv, die
 * uebrigen Gruppen werden nur ausgegraut angedeutet (noch ohne Funktion).
 * Reine Daten (kein Storage/DB). Vollausbau siehe
 * docs/architecture/massnahmen-positionen-wahlomat-zielbild.md
 */

export interface StakeholderInfo {
  /** Stabiler Schluessel (Basis fuer flache Felder `position_<key>`). */
  key: string;
  /** Anzeige-Label (Deutsch; i18n folgt im Vollausbau). */
  label: string;
  /** Akzentfarbe (Hex) fuer schnelle mentale Zuordnung. */
  color: string;
  /** Icon (Lucide). */
  icon: LucideIcon;
  /** Schematik: nur aktive Kacheln sind anklickbar/befuellt. */
  active?: boolean;
}

/** Die 10 Interessengruppen. Reihenfolge = Anzeige im Raster. */
export const STAKEHOLDER_LIST: readonly StakeholderInfo[] = [
  { key: "landesverwaltung", label: "Landesverwaltung", color: "#64748b", icon: Landmark, active: true },
  { key: "politik", label: "Politik", color: "#6366f1", icon: Vote },
  { key: "gemeinden", label: "Gemeinden", color: "#14b8a6", icon: Building2 },
  { key: "wirtschaft", label: "Wirtschaft", color: "#f59e0b", icon: Briefcase },
  { key: "landwirtschaft", label: "Landwirtschaft", color: "#22c55e", icon: Wheat },
  { key: "tourismus", label: "Tourismus", color: "#06b6d4", icon: Mountain },
  { key: "umweltverbaende", label: "Umweltverbände", color: "#10b981", icon: Leaf },
  { key: "sozial", label: "Sozialbereich", color: "#f43f5e", icon: HeartHandshake },
  { key: "wissenschaft", label: "Wissenschaft", color: "#8b5cf6", icon: GraduationCap },
  { key: "buerger", label: "Bürger", color: "#f97316", icon: Users },
] as const;
