/**
 * src/lib/gallery/sdg-meta.ts
 *
 * Generische Stammdaten + Helfer fuer das SDG-Profil (17 UN-Nachhaltigkeitsziele).
 * Library-uebergreifend nutzbar: liest die flachen Metadatenfelder
 * `sdg_1..sdg_17` (+ optional `sdg_begruendung`) aus `docMetaJson`.
 *
 * Reine Daten-/Logik-Schicht (kein React, kein Storage). Kein Silent Fallback:
 * fehlende oder ungueltige Werte ergeben `null` (= "keine Einschaetzung"),
 * nicht `0`.
 */

/** Anzahl der UN-Nachhaltigkeitsziele. */
export const SDG_COUNT = 17;

/** Ein Eintrag der SDG-Stammdaten. */
export interface SdgInfo {
  /** Ziel-Nummer 1..17. */
  id: number;
  /** Offizielle SDG-Farbe (Hex). */
  color: string;
  /** Metadatenschluessel des Unterstuetzungsgrads in `docMetaJson`. */
  metaKey: string;
  /** i18n-Key des Kurztitels (Block `sdgProfile`). */
  titleKey: string;
}

/**
 * Die 17 SDGs mit offiziellen UN-Farben. Reihenfolge = Ziel-Nummer.
 * Quelle der Farben: UN SDG Colour Guidelines.
 */
export const SDG_LIST: readonly SdgInfo[] = [
  { id: 1, color: "#E5243B", metaKey: "sdg_1", titleKey: "sdg1" },
  { id: 2, color: "#DDA63A", metaKey: "sdg_2", titleKey: "sdg2" },
  { id: 3, color: "#4C9F38", metaKey: "sdg_3", titleKey: "sdg3" },
  { id: 4, color: "#C5192D", metaKey: "sdg_4", titleKey: "sdg4" },
  { id: 5, color: "#FF3A21", metaKey: "sdg_5", titleKey: "sdg5" },
  { id: 6, color: "#26BDE2", metaKey: "sdg_6", titleKey: "sdg6" },
  { id: 7, color: "#FCC30B", metaKey: "sdg_7", titleKey: "sdg7" },
  { id: 8, color: "#A21942", metaKey: "sdg_8", titleKey: "sdg8" },
  { id: 9, color: "#FD6925", metaKey: "sdg_9", titleKey: "sdg9" },
  { id: 10, color: "#DD1367", metaKey: "sdg_10", titleKey: "sdg10" },
  { id: 11, color: "#FD9D24", metaKey: "sdg_11", titleKey: "sdg11" },
  { id: 12, color: "#BF8B2E", metaKey: "sdg_12", titleKey: "sdg12" },
  { id: 13, color: "#3F7E44", metaKey: "sdg_13", titleKey: "sdg13" },
  { id: 14, color: "#0A97D9", metaKey: "sdg_14", titleKey: "sdg14" },
  { id: 15, color: "#56C02B", metaKey: "sdg_15", titleKey: "sdg15" },
  { id: 16, color: "#00689D", metaKey: "sdg_16", titleKey: "sdg16" },
  { id: 17, color: "#19486A", metaKey: "sdg_17", titleKey: "sdg17" },
] as const;

/** Metadatenschluessel der gemeinsamen Begruendung. */
export const SDG_BEGRUENDUNG_KEY = "sdg_begruendung";

/**
 * Pfad zum offiziellen UN-SDG-Icon. Die Assets liegen unter `public/sdg-icons/`
 * mit den unveraenderten offiziellen Dateinamen `E-WEB-Goal-01.png` ..
 * `E-WEB-Goal-17.png` (zweistellig, fuehrende Null). Fehlt eine Datei, faellt
 * die UI auf eine farbige Kachel mit der Ziel-Nummer zurueck.
 */
export function sdgIconPath(id: number): string {
  const padded = String(id).padStart(2, "0");
  return `/sdg-icons/E-WEB-Goal-${padded}.png`;
}

/** Ein gemessener SDG-Unterstuetzungsgrad (oder `null`, wenn nicht vorhanden). */
export interface SdgValue {
  id: number;
  /** Unterstuetzungsgrad im Bereich [0, 1] oder `null` (keine Einschaetzung). */
  value: number | null;
}

/**
 * Coerciert einen unbekannten Wert in einen SDG-Grad [0, 1] oder `null`.
 * Akzeptiert Zahlen und numerische Strings; clamped auf [0, 1].
 */
export function coerceSdgValue(raw: unknown): number | null {
  const num =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

/**
 * Extrahiert die 17 SDG-Werte aus `docMetaJson` in fester Reihenfolge (1..17).
 * Fehlende/ungueltige Werte werden zu `null`.
 */
export function extractSdgValues(
  docMetaJson: Record<string, unknown> | null | undefined,
): SdgValue[] {
  const meta = docMetaJson ?? {};
  return SDG_LIST.map((sdg) => ({
    id: sdg.id,
    value: coerceSdgValue(meta[sdg.metaKey]),
  }));
}

/** Liest die gemeinsame SDG-Begruendung (oder `null`, wenn leer/fehlend). */
export function extractSdgBegruendung(
  docMetaJson: Record<string, unknown> | null | undefined,
): string | null {
  const raw = (docMetaJson ?? {})[SDG_BEGRUENDUNG_KEY];
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

/**
 * True, wenn `docMetaJson` mindestens einen gueltigen SDG-Wert enthaelt.
 * Steuert, ob das SDG-Profil ueberhaupt gerendert wird.
 */
export function hasSdgData(
  docMetaJson: Record<string, unknown> | null | undefined,
): boolean {
  return extractSdgValues(docMetaJson).some((v) => v.value !== null);
}
