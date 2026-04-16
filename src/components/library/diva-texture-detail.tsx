"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";

/**
 * Daten für die Textur-Analyse-Detailansicht (Template Diva-Texture-Analysis).
 * Felder entsprechen dem Frontmatter; alles optional außer title (Fallback im Mapper).
 */
export interface DivaTextureDetailData {
  title: string;
  markdown?: string;
  coverImageUrl?: string;
  slug?: string;
  iln_nummer?: string;
  textur_code?: string;
  materialart?: string;
  visuelle_grundwirkung?: string;
  oberflaechencharakter?: string;
  verwechslungs_verbot?: string[];
  standard_prompt?: string;
  farbe?: string;
  farbvariation?: string;
  struktur_sichtbarkeit?: string;
  muster?: string;
  glanzeindruck?: string;
  prompt_zusatz?: string;
  confidence_value?: number;
  confidence_sources?: string[];
  confidence_reasoning?: string;
  sprache?: string;
  docType?: string;
  /** EXIF / technische Felder (Pipeline-injiziert) */
  breite_px?: number;
  hoehe_px?: number;
  dpi_horizontal?: number | null;
  dpi_vertikal?: number | null;
  bittiefe?: number | null;
  breite_cm?: number | null;
  hoehe_cm?: number | null;
  komprimierung?: string;
  farbraum?: string;
  erstellungsdatum?: string | null;
  erstellungsprogramm?: string;
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

/** Reihenfolge und deutsche Labels für die Metadaten-Tabelle */
const FIELD_ROWS: Array<{ key: keyof DivaTextureDetailData; label: string }> = [
  { key: "iln_nummer", label: "ILN / Herstellercode" },
  { key: "textur_code", label: "Textur-Code" },
  { key: "materialart", label: "Materialart" },
  { key: "visuelle_grundwirkung", label: "Grundwirkung" },
  { key: "oberflaechencharakter", label: "Oberflächencharakter" },
  { key: "farbe", label: "Farbe" },
  { key: "farbvariation", label: "Farbvariation" },
  { key: "struktur_sichtbarkeit", label: "Struktur-Sichtbarkeit" },
  { key: "muster", label: "Muster" },
  { key: "glanzeindruck", label: "Glanzeindruck" },
  { key: "standard_prompt", label: "Standard-Prompt (EN)" },
  { key: "prompt_zusatz", label: "Prompt-Zusatz (EN)" },
  { key: "confidence_value", label: "Konfidenz (%)" },
  { key: "confidence_sources", label: "Konfidenz-Quellen" },
  { key: "confidence_reasoning", label: "Begründung" },
  { key: "sprache", label: "Sprache" },
  { key: "docType", label: "Dokumenttyp" },
  { key: "breite_px", label: "Breite (px)" },
  { key: "hoehe_px", label: "Höhe (px)" },
  { key: "dpi_horizontal", label: "DPI horizontal" },
  { key: "dpi_vertikal", label: "DPI vertikal" },
  { key: "bittiefe", label: "Bittiefe" },
  { key: "breite_cm", label: "Breite (cm)" },
  { key: "hoehe_cm", label: "Höhe (cm)" },
  { key: "komprimierung", label: "Komprimierung" },
  { key: "farbraum", label: "Farbraum" },
  { key: "erstellungsdatum", label: "Erstellungsdatum" },
  { key: "erstellungsprogramm", label: "Erstellungsprogramm" },
];

interface DivaTextureDetailProps {
  data: DivaTextureDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

function formatCellValue(key: keyof DivaTextureDetailData, data: DivaTextureDetailData): string | null {
  const v = data[key];
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    const s = v.filter((x) => typeof x === "string" && x.trim()).join(", ");
    return s.length > 0 ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Detailansicht für PBR-/Material-Textur-Analysen (Diva-Texture-Analysis).
 * Galerie: Titel + optional coverImageUrl; hier: strukturierte Metadaten + Analyse-Text.
 */
export function DivaTextureDetail({
  data,
  backHref = "/library",
  showBackLink = false,
}: DivaTextureDetailProps) {
  const title = data.title || "—";
  const verbot = Array.isArray(data.verwechslungs_verbot) ? data.verwechslungs_verbot.filter((s) => typeof s === "string" && s.trim()) : [];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {showBackLink && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
      )}

      <AIGeneratedNotice />

      {data.coverImageUrl ? (
        <div className="rounded-lg overflow-hidden border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.coverImageUrl} alt="" className="w-full max-h-[420px] object-contain bg-neutral-950/5" />
        </div>
      ) : null}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {data.slug ? <p className="text-sm text-muted-foreground font-mono">{data.slug}</p> : null}
        {data.fileName ? (
          <p className="text-xs text-muted-foreground">Quelldatei: {data.fileName}</p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadaten</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm border rounded-md p-4 bg-card">
          {FIELD_ROWS.map(({ key, label }) => {
            const display = formatCellValue(key, data);
            if (!display) return null;
            return (
              <React.Fragment key={String(key)}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{display}</dd>
              </React.Fragment>
            );
          })}
        </dl>
        {verbot.length > 0 ? (
          <div className="text-sm border rounded-md p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/50">
            <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">Verwechslungs-Verbot</p>
            <p className="text-muted-foreground">{verbot.join(", ")}</p>
          </div>
        ) : null}
      </section>

      {data.markdown?.trim() ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Analyse</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none border rounded-md p-4">
            <MarkdownPreview content={data.markdown} compact className="min-h-0 w-full" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
