import {
  Landmark,
  Palette,
  Briefcase,
  Wheat,
  Mountain,
  Leaf,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

/**
 * src/lib/gallery/stakeholder-meta.ts
 *
 * Feste Taxonomie der Interessengruppen fuer den Konsent-Vergleich
 * (Schachbrett). Die Landesverwaltung ist KEIN Akteur unter vielen, sondern die
 * "Schlussredaktion" (Zustaendigkeit/Umsetzbarkeit) und wird in einem EIGENEN
 * Detail-Abschnitt gezeigt, nicht im Schachbrett (`STAKEHOLDER_KONSENT`).
 *
 * SCHEMATISCH: die Akteur-Kacheln sind aktuell nur ausgegraut angedeutet (noch
 * ohne Funktion). Reine Daten (kein Storage/DB). Vollausbau siehe
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
}

/** Sonderrolle: die Landesverwaltung (eigener Abschnitt, Schlussredaktion). */
export const LANDESVERWALTUNG: StakeholderInfo = {
  key: "landesverwaltung",
  label: "Landesverwaltung",
  color: "#64748b",
  icon: Landmark,
};

/**
 * Stakeholder fuer das Konsent-Schachbrett. OHNE Landesverwaltung (eigener
 * Abschnitt, Schlussredaktion) sowie OHNE Politik, Wissenschaft und Buerger:
 * Politik/Wissenschaft sind keine Stakeholder im engeren Sinn (Wissenschaft =
 * eigener Einschaetzungs-Abschnitt), Buerger werden ueber den Kommentarbereich
 * abgebildet.
 */
export const STAKEHOLDER_KONSENT: readonly StakeholderInfo[] = [
  { key: "kultur", label: "Kultur", color: "#a855f7", icon: Palette },
  { key: "wirtschaft", label: "Wirtschaft", color: "#f59e0b", icon: Briefcase },
  { key: "landwirtschaft", label: "Landwirtschaft", color: "#22c55e", icon: Wheat },
  { key: "tourismus", label: "Tourismus", color: "#06b6d4", icon: Mountain },
  { key: "umweltverbaende", label: "Umweltverbände", color: "#10b981", icon: Leaf },
  { key: "sozial", label: "Sozialbereich", color: "#f43f5e", icon: HeartHandshake },
] as const;
