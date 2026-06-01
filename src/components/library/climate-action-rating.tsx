"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Erklaerungen je Parameter (entsprechen dem an das LLM gesendeten Prompt).
 * Werden hinter einem kleinen i-Symbol als Tooltip angezeigt.
 */
const PARAM_INFO: Record<string, string> = {
  wirkung:
    "Perspektive Wirkung / Emissionsminderung: Wie stark trägt die Maßnahme zur Reduktion von Treibhausgasen bei? Skala 0–100 % (qualitativ, nicht in Tonnen). Die absolute CO₂-Einsparung steht separat weiter unten.",
  soziales:
    "Perspektive Lebensqualität & Soziales: Wie stark verbessert die Maßnahme Lebensqualität und soziale Gerechtigkeit? Skala 0–100 %.",
  struktur:
    "Perspektive Struktur & Rahmenbedingungen: Wie stark stärkt die Maßnahme Strukturen, Institutionen und Rahmenbedingungen? Skala 0–100 %.",
  bewusstsein:
    "Perspektive Unterstützung & Bewusstsein: Wie stark fördert die Maßnahme Bewusstsein, Wissen und öffentliche Unterstützung? Skala 0–100 %.",
  durchsetzbarkeit:
    "Durchsetzbarkeit: Wie leicht ist die Maßnahme politisch und gesellschaftlich umsetzbar? Skala 0–100 % (0 = kaum durchsetzbar, 100 = breiter Konsens).",
  co2: "Geschätztes CO₂-Einsparpotenzial in Kilotonnen pro Jahr für Südtirol (absolute Größenordnung).",
  kosten:
    "Geschätzte Kosten in Euro (Größenordnung). 'Kosten unbekannt', wenn keine belastbare Schätzung möglich ist.",
  indikator:
    "Prioritäts-Indikator zum Sortieren der Maßnahmen: CO₂-Einsparpotenzial (kt/Jahr) × Durchsetzbarkeit ÷ Kosten (je Mio €). Höher = mehr Wirkung pro investiertem Euro. Nur berechenbar, wenn CO₂, Durchsetzbarkeit und Kosten vorliegen.",
};

/** Kleines i-Symbol mit Erklärung als Tooltip. */
function InfoTip({ text }: { text: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Erklärung"
          className="ml-1 inline-flex align-middle text-muted-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="z-[70] max-w-xs text-xs font-normal normal-case tracking-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * src/components/library/climate-action-rating.tsx
 *
 * Read-only Anzeige der LLM-Bewertung einer Klimamassnahme:
 * Kennzahlen (CO₂, Durchsetzbarkeit, Kosten) + vier Perspektiven-Scores,
 * jeweils mit Begruendung. Reiner Renderer (Welle-3-III-Contract §1):
 * keine Schreib-/DB-/Storage-Logik, nur Props -> JSX.
 *
 * "Kosten unbekannt" wird explizit angezeigt (kein Silent Fallback).
 */

/** Eingangsdaten der Bewertungsanzeige (alle optional, LLM-geschaetzt). */
export interface ClimateActionRatingData {
  co2_einsparung_kt?: number;
  co2_einsparung_kt_begruendung?: string;
  durchsetzbarkeit?: number;
  durchsetzbarkeit_begruendung?: string;
  kosten_eur?: number;
  kosten_eur_begruendung?: string;
  score_wirkung?: number;
  score_soziales?: number;
  score_struktur?: number;
  score_bewusstsein?: number;
  perspektiven_begruendung?: string;
  dominant_perspektive?: string;
  bewertung_modell?: string;
  bewertung_stand?: string;
  /** Persistierter Prioritäts-Indikator (statt Laufzeitberechnung). */
  prioritaets_index?: number;
}

interface ClimateActionRatingProps {
  data: ClimateActionRatingData;
  /** Eingebettet (z.B. im Accordion): ohne eigene Card + Ueberschrift. */
  embedded?: boolean;
}

/** Perspektiven-Reihenfolge + Farb-Klassen (generische Knoten-Farbe spaeter). */
const PERSPECTIVES: Array<{ key: keyof ClimateActionRatingData; id: string }> = [
  { key: "score_wirkung", id: "wirkung" },
  { key: "score_soziales", id: "soziales" },
  { key: "score_struktur", id: "struktur" },
  { key: "score_bewusstsein", id: "bewusstsein" },
];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Eine Begruendungs-Zeile (nur rendern, wenn Text vorhanden). */
function Reason({ text }: { text?: string }) {
  if (!text || text.trim().length === 0) return null;
  return <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{text}</p>;
}

/**
 * Bewertungs-Sektion. Rendert nichts, wenn keinerlei Bewertungsdaten
 * vorliegen (bewusstes Conditional-Render — alte Maßnahmen ohne Bewertung).
 */
export function ClimateActionRating({ data, embedded = false }: ClimateActionRatingProps) {
  const { t } = useTranslation();

  const hasMetrics =
    isNum(data.co2_einsparung_kt) ||
    isNum(data.durchsetzbarkeit) ||
    isNum(data.kosten_eur);
  const hasScores = PERSPECTIVES.some((p) => isNum(data[p.key] as number | undefined));
  if (!hasMetrics && !hasScores) return null;

  const dominant = data.dominant_perspektive;

  // Prioritäts-Indikator: persistiertes Feld (beim Transform berechnet).
  const ratingIndex = typeof data.prioritaets_index === 'number' ? data.prioritaets_index : null;

  const body = (
    <TooltipProvider delayDuration={150}>
      {hasScores && (
        <div className="space-y-2 text-sm">
          {PERSPECTIVES.map((p) => {
            const value = data[p.key] as number | undefined;
            if (!isNum(value)) return null;
            const isDominant = dominant === p.id;
            return (
              <div key={p.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-muted-foreground", isDominant && "font-semibold text-foreground")}>
                    {t(`climateRating.perspective.${p.id}`, { defaultValue: p.id })}
                    {isDominant && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400">
                        {t("climateRating.dominant", { defaultValue: "dominant" })}
                      </span>
                    )}
                    <InfoTip text={PARAM_INFO[p.id]} />
                  </span>
                  <span className="font-mono">{Math.round(value * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded", isDominant ? "bg-green-600" : "bg-primary/60")}
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <Reason text={data.perspektiven_begruendung} />
        </div>
      )}

      {hasMetrics && (
        <div className={cn("space-y-3 text-sm", hasScores && "mt-4 pt-3 border-t border-border")}>
          {/* CO₂-Einsparung zuerst – immer sichtbar (auch ohne Wert). */}
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("climateRating.co2", { defaultValue: "CO₂-Einsparung (kt/Jahr)" })}
                <InfoTip text={PARAM_INFO.co2} />
              </span>
              <span className="font-mono">
                {isNum(data.co2_einsparung_kt) ? data.co2_einsparung_kt : "keine Angabe"}
              </span>
            </div>
            <Reason text={data.co2_einsparung_kt_begruendung} />
          </div>
          {isNum(data.durchsetzbarkeit) && (
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("climateRating.durchsetzbarkeit", { defaultValue: "Durchsetzbarkeit" })}
                  <InfoTip text={PARAM_INFO.durchsetzbarkeit} />
                </span>
                <span className="font-mono">
                  {Math.round(data.durchsetzbarkeit * 100)}%
                </span>
              </div>
              <Reason text={data.durchsetzbarkeit_begruendung} />
            </div>
          )}
          <div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("climateRating.kosten", { defaultValue: "Kosten (EUR)" })}
                <InfoTip text={PARAM_INFO.kosten} />
              </span>
              <span className="font-mono">
                {isNum(data.kosten_eur)
                  ? data.kosten_eur.toLocaleString("de-DE")
                  : t("climateRating.costUnknown", { defaultValue: "Kosten unbekannt" })}
              </span>
            </div>
            <Reason text={data.kosten_eur_begruendung} />
          </div>

          {/* Prioritäts-Indikator: kt × Durchsetzbarkeit ÷ Kosten (je Mio €) */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Prioritäts-Indikator
                <InfoTip text={PARAM_INFO.indikator} />
              </span>
              <span className="font-mono font-semibold">
                {ratingIndex !== null ? ratingIndex.toFixed(1) : "–"}
              </span>
            </div>
            {ratingIndex === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nicht berechenbar — CO₂-Einsparung und/oder Kosten fehlen.
              </p>
            )}
          </div>
        </div>
      )}

      {(data.bewertung_modell || data.bewertung_stand) && (
        <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground">
          {t("climateRating.aiNotice", { defaultValue: "KI-Schätzung" })}
          {data.bewertung_modell ? ` · ${data.bewertung_modell}` : ""}
          {data.bewertung_stand ? ` · ${data.bewertung_stand}` : ""}
        </p>
      )}
    </TooltipProvider>
  );

  if (embedded) return <div className="text-sm">{body}</div>;

  return (
    <section className="bg-card border border-border rounded-lg p-4 mb-6">
      <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
        {t("climateRating.title", { defaultValue: "KI-Bewertung (Südtirol)" })}
      </h2>
      {body}
    </section>
  );
}

export default ClimateActionRating;
