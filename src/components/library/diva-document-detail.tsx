"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Package, Tag, Building2, Store, Calendar, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";

/**
 * Datenstruktur für DivaDocument Detail-Ansicht.
 * Zeigt Katalogdokumente (Preislisten, Produktdatenblätter, Materialkollektionen etc.)
 * aus der Möbelbranche.
 */
export interface DivaDocumentDetailData {
  // Basis-Felder
  title: string;
  summary?: string;
  markdown?: string;
  coverImageUrl?: string;

  // Katalog-spezifische Felder (aus Template divaKatalog-detail-de.md)
  /** Dokumenttyp (preisliste, produktdatenblatt, materialkollektion, optiontree, etc.) */
  dokumentTyp?: string;
  /** Dokumentformat (pdf, xlsx, docx, csv, etc.) */
  dokumentFormat?: string;
  /** Produktname / Modellname (z.B. "AIRNESS", "BIVIO") */
  produktname?: string;
  /** Lieferant / Hersteller (z.B. "Conform", "Lyra Group") */
  lieferant?: string;
  /** Händler / Retail-Marke (z.B. "Livique") */
  haendler?: string;
  /** Produktkategorien (z.B. ["Sessel", "Hocker"]) */
  produktkategorien?: string[];
  /** Materialgruppen (z.B. ["Stoffgruppe A", "Ledergruppe 20"]) */
  materialgruppen?: string[];
  /** Farbvarianten (z.B. ["Cream 03", "Beige 62"]) */
  farbvarianten?: string[];
  /** Technische Daten (z.B. ["Martindale", "Composition"]) */
  technischeDaten?: string[];
  /** Konfigurationsoptionen (z.B. ["Kopfteil", "Fußvariante"]) */
  konfigurationsoptionen?: string[];
  /** Gültigkeitsdatum (YYYY-MM-DD) */
  gueltigAb?: string;
  /** Währung (CHF, EUR) */
  waehrung?: string;
  /** Preistyp (ek_netto, ek_brutto, vk, gemischt) */
  preistyp?: string;
  /** Ob eine VK-Gegenversion existiert */
  hatVkGegenstueck?: boolean;
  /** Ob das Dokument veraltet ist (aus ALT-Ordner) */
  istVeraltet?: boolean;
  /** Zertifizierungen (z.B. ["FSC", "Oeko-Tex"]) */
  zertifizierungen?: string[];
  /** Schlagwörter */
  tags?: string[];
  /** Jahr */
  year?: number | string;

  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface DivaDocumentDetailProps {
  data: DivaDocumentDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

/** Mapping für lesbare Dokumenttyp-Labels */
const DOKUMENT_TYP_LABELS: Record<string, string> = {
  preisliste: "Preisliste",
  produktdatenblatt: "Produktdatenblatt",
  materialkollektion: "Materialkollektion",
  optiontree: "Optiontree",
  prozessdokumentation: "Prozessdokumentation",
  sonstiges: "Sonstiges",
};

/** Mapping für lesbare Preistyp-Labels */
const PREISTYP_LABELS: Record<string, string> = {
  ek_netto: "EK Netto",
  ek_brutto: "EK Brutto",
  vk: "Verkaufspreis",
  gemischt: "Gemischt",
};

/**
 * Detail-Ansicht für Diva-Katalogdokumente (Möbelbranche).
 * Zeigt strukturierte Metadaten aus Preislisten, Produktdatenblättern,
 * Materialkollektionen und weiteren Katalogdokumenten.
 */
export function DivaDocumentDetail({
  data,
  backHref = "/library",
  showBackLink = false,
}: DivaDocumentDetailProps) {
  const title = data.title || "—";
  const produktkategorien = Array.isArray(data.produktkategorien) ? data.produktkategorien : [];
  const materialgruppen = Array.isArray(data.materialgruppen) ? data.materialgruppen : [];
  const technischeDaten = Array.isArray(data.technischeDaten) ? data.technischeDaten : [];
  const konfigurationsoptionen = Array.isArray(data.konfigurationsoptionen) ? data.konfigurationsoptionen : [];
  const farbvarianten = Array.isArray(data.farbvarianten) ? data.farbvarianten : [];
  const zertifizierungen = Array.isArray(data.zertifizierungen) ? data.zertifizierungen : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];

  // Lesbarer Dokumenttyp
  const dokumentTypLabel = data.dokumentTyp
    ? DOKUMENT_TYP_LABELS[data.dokumentTyp] || data.dokumentTyp
    : undefined;

  // Lesbarer Preistyp
  const preistypLabel = data.preistyp
    ? PREISTYP_LABELS[data.preistyp] || data.preistyp
    : undefined;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {showBackLink && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Zurück</span>
        </Link>
      )}

      {/* Header: Dokumenttyp → Titel → Badges */}
      <div className="mb-6">
        {/* Dokumenttyp als Kategorie-Label */}
        {dokumentTypLabel && (
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-2">
            {dokumentTypLabel}
          </span>
        )}

        {/* Titel */}
        <h1 className="text-2xl font-bold text-foreground mb-3 text-balance">{title}</h1>

        {/* Badges: Veraltet, Format, Preistyp */}
        <div className="flex flex-wrap gap-2">
          {data.istVeraltet && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" />
              Veraltet
            </Badge>
          )}
          {data.dokumentFormat && (
            <Badge variant="outline" className="text-xs gap-1">
              <FileText className="w-3 h-3" />
              {data.dokumentFormat.toUpperCase()}
            </Badge>
          )}
          {preistypLabel && (
            <Badge variant="secondary" className="text-xs">
              {preistypLabel}
            </Badge>
          )}
          {data.waehrung && (
            <Badge variant="secondary" className="text-xs">
              {data.waehrung}
            </Badge>
          )}
          {data.hatVkGegenstueck && (
            <Badge variant="outline" className="text-xs">
              VK-Version vorhanden
            </Badge>
          )}
        </div>
      </div>

      {/* Zusammenfassung */}
      {data.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty mb-6">
          {data.summary}
        </p>
      )}

      {/* Dokumentdetails: Lieferant, Händler, Produkt, Gültigkeit */}
      <section className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <Package className="w-3 h-3" />Dokumentdetails
        </h2>
        <div className="space-y-2 text-xs">
          {data.produktname && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Produktname:</span>
              <span className="font-semibold">{data.produktname}</span>
            </div>
          )}
          {data.lieferant && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />Lieferant:
              </span>
              <span>{data.lieferant}</span>
            </div>
          )}
          {data.haendler && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Store className="w-3 h-3" />Händler:
              </span>
              <span>{data.haendler}</span>
            </div>
          )}
          {data.gueltigAb && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />Gültig ab:
              </span>
              <span>{data.gueltigAb}</span>
            </div>
          )}
        </div>

        {/* Produktkategorien als Badges */}
        {produktkategorien.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground block mb-1.5">Produktkategorien:</span>
            <div className="flex flex-wrap gap-1.5">
              {produktkategorien.map((cat) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Materialgruppen (nur bei relevanten Dokumenten) */}
      {materialgruppen.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Materialgruppen
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {materialgruppen.map((mg) => (
              <Badge key={mg} variant="secondary" className="text-xs">{mg}</Badge>
            ))}
          </div>
        </section>
      )}

      {/* Technische Daten + Konfigurationsoptionen */}
      {(technischeDaten.length > 0 || konfigurationsoptionen.length > 0) && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Technische Details
          </h2>
          {technischeDaten.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-muted-foreground block mb-1.5">Kennwerte:</span>
              <div className="flex flex-wrap gap-1.5">
                {technischeDaten.map((td) => (
                  <Badge key={td} variant="outline" className="text-xs">{td}</Badge>
                ))}
              </div>
            </div>
          )}
          {konfigurationsoptionen.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1.5">Konfigurationsoptionen:</span>
              <div className="flex flex-wrap gap-1.5">
                {konfigurationsoptionen.map((ko) => (
                  <Badge key={ko} variant="outline" className="text-xs">{ko}</Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Farbvarianten (nur bei Materialkollektionen) */}
      {farbvarianten.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Farbvarianten
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {farbvarianten.slice(0, 30).map((fv) => (
              <Badge key={fv} variant="outline" className="text-xs">{fv}</Badge>
            ))}
            {farbvarianten.length > 30 && (
              <Badge variant="secondary" className="text-xs">
                +{farbvarianten.length - 30} weitere
              </Badge>
            )}
          </div>
        </section>
      )}

      {/* Zertifizierungen */}
      {zertifizierungen.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Zertifizierungen
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {zertifizierungen.map((z) => (
              <Badge key={z} variant="secondary" className="text-xs">{z}</Badge>
            ))}
          </div>
        </section>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="w-2.5 h-2.5 mr-1" />{tag}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Markdown-Body */}
      {data.markdown && (
        <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
          <MarkdownPreview
            content={data.markdown}
            compact={true}
            className="min-h-0 w-full"
          />
        </div>
      )}

      {/* KI-Hinweis */}
      <AIGeneratedNotice compact />

      {/* Debug (nur Development) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 mb-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
          <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Debug: DivaDocumentDetail</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <div><strong>Detailansicht:</strong> DivaDocumentDetail</div>
            <div><strong>Dokumenttyp:</strong> {data.dokumentTyp || "—"}</div>
            <div><strong>Produktname:</strong> {data.produktname || "—"}</div>
            <div><strong>Lieferant:</strong> {data.lieferant || "—"}</div>
          </div>
        </div>
      )}

      {/* Footer mit technischen Infos */}
      <div className="mt-6 text-xs text-muted-foreground border-t pt-2">
        <div className="flex flex-wrap gap-1">
          {data.fileName && <span>Dateiname: {data.fileName}</span>}
          {typeof data.chunkCount === "number" && <span>Chunks: {data.chunkCount}</span>}
          {data.fileId && <span>fileId: {data.fileId}</span>}
          {data.upsertedAt && (
            <span>upsertedAt: {new Date(data.upsertedAt).toLocaleString("de-DE")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default DivaDocumentDetail;
