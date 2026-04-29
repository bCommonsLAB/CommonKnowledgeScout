"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Cpu, MemoryStick, HardDrive, MonitorSmartphone, Weight, Tag, Laptop, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";

/**
 * Datenstruktur fuer RefurbedDevice Detail-Ansicht.
 *
 * Zeigt gebrauchte PCs/Notebooks, die an Schueler, Lehrer und Familien verschenkt werden.
 * Fokus auf wenige laienverstaendliche Hardware-Felder + ehrlicher Eignungs-Text.
 *
 * Pflichtfelder: title, modell.
 * Alle anderen Felder sind optional und werden nur dargestellt, wenn ein Wert vorhanden ist.
 */
export interface RefurbedDeviceDetailData {
  // Basis-Felder
  title: string;
  summary?: string;
  markdown?: string;
  coverImageUrl?: string;
  /** Weitere Bilder vom Geraet (Vorderseite, Rueckseite, Tastatur, Anschluesse). */
  galleryImageUrls?: string[];

  // Geraete-Identitaet
  /** Marke + Modell in einer Zeile (z.B. "Lenovo ThinkPad T480") */
  modell?: string;
  /** "notebook" | "desktop-pc" | "mini-pc" | "all-in-one" */
  geraetetyp?: string;

  // Hardware (laienverstaendlich)
  prozessor?: string;
  arbeitsspeicher?: string;
  festplatte?: string;
  grafik?: string;
  gewicht?: string;
  betriebssystem?: string;

  // Generative Eignungs-Beschreibung (Pflicht-Body-Feld im Template)
  wofuerGeeignet?: string;

  // Tags und sonstige Felder
  tags?: string[];
  year?: number | string;

  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface RefurbedDeviceDetailProps {
  data: RefurbedDeviceDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

/**
 * Lesbare Labels fuer Geraetetyp - werden in Badge angezeigt.
 * Wenn ein neuer Geraetetyp im Template auftaucht (z.B. "tablet"),
 * wird der raw-Wert angezeigt (kein silent fallback).
 */
const GERAETETYP_LABELS: Record<string, string> = {
  notebook: "Notebook",
  "desktop-pc": "Desktop-PC",
  "mini-pc": "Mini-PC",
  "all-in-one": "All-in-One",
};

/**
 * Detail-Ansicht fuer gebrauchte PCs/Notebooks (refurbedDevice).
 *
 * Layout-Reihenfolge (von oben nach unten):
 * 1. Cover-Bild (wenn vorhanden)
 * 2. Titel + Geraetetyp-Badge
 * 3. Summary (wenn vorhanden)
 * 4. "Wofuer ist dieser Rechner gut?" - Pflicht-Body-Feld, das LLM aus Specs ableitet
 * 5. "Auf einen Blick" - Spec-Tabelle mit Icons
 * 6. Bilder-Galerie (wenn weitere Bilder vorhanden)
 * 7. Markdown-Body (wenn vorhanden)
 * 8. Tags (wenn vorhanden)
 */
export function RefurbedDeviceDetail({
  data,
  backHref = "/library",
  showBackLink = false,
}: RefurbedDeviceDetailProps) {
  const title = data.title || "—";
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const galleryImageUrls = Array.isArray(data.galleryImageUrls) ? data.galleryImageUrls : [];

  // Lesbarer Geraetetyp-Label, sonst rohen Wert anzeigen (kein silent fallback)
  const geraetetypLabel = data.geraetetyp
    ? GERAETETYP_LABELS[data.geraetetyp] || data.geraetetyp
    : undefined;

  // Spec-Items fuer "Auf einen Blick"-Tabelle
  // Pro Zeile: Icon, Label, Wert. Eintraege ohne Wert werden weggelassen (kein "-").
  const specItems: Array<{ icon: React.ReactNode; label: string; value: string }> = [];
  if (data.modell) specItems.push({ icon: <Laptop className="w-4 h-4" />, label: "Modell", value: data.modell });
  if (data.prozessor) specItems.push({ icon: <Cpu className="w-4 h-4" />, label: "Prozessor", value: data.prozessor });
  if (data.arbeitsspeicher) specItems.push({ icon: <MemoryStick className="w-4 h-4" />, label: "Arbeitsspeicher", value: data.arbeitsspeicher });
  if (data.festplatte) specItems.push({ icon: <HardDrive className="w-4 h-4" />, label: "Festplatte", value: data.festplatte });
  if (data.grafik) specItems.push({ icon: <MonitorSmartphone className="w-4 h-4" />, label: "Grafik", value: data.grafik });
  if (data.gewicht) specItems.push({ icon: <Weight className="w-4 h-4" />, label: "Gewicht", value: data.gewicht });
  if (data.betriebssystem) specItems.push({ icon: <ImageIcon className="w-4 h-4" />, label: "Betriebssystem", value: data.betriebssystem });

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

      {/* Cover-Bild (wenn vorhanden) */}
      {data.coverImageUrl && (
        <div className="mb-6 rounded-lg overflow-hidden border border-border bg-muted relative aspect-[4/3]">
          <Image
            src={data.coverImageUrl}
            alt={title}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 672px"
            unoptimized
          />
        </div>
      )}

      {/* Header: Geraetetyp-Badge + Titel */}
      <div className="mb-6">
        {geraetetypLabel && (
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-2">
            {geraetetypLabel}
          </span>
        )}
        <h1 className="text-2xl font-bold text-foreground mb-3 text-balance">{title}</h1>

        {/* Optionale Badges: Geraetetyp, Jahr */}
        {data.year && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {data.year}
            </Badge>
          </div>
        )}
      </div>

      {/* Zusammenfassung */}
      {data.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty mb-6">
          {data.summary}
        </p>
      )}

      {/* Wofuer ist dieser Rechner gut? - der wichtigste Inhalt fuer Laien */}
      {data.wofuerGeeignet && (
        <section className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
            Wofür ist dieser Rechner gut?
          </h2>
          <p className="text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed text-pretty">
            {data.wofuerGeeignet}
          </p>
        </section>
      )}

      {/* Spec-Tabelle "Auf einen Blick" */}
      {specItems.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Auf einen Blick
          </h2>
          <dl className="space-y-2">
            {specItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3 text-sm">
                <dt className="flex items-center gap-2 text-muted-foreground min-w-[140px] shrink-0">
                  {item.icon}
                  <span>{item.label}</span>
                </dt>
                <dd className="text-foreground font-medium break-words">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Bilder-Galerie (weitere Bilder neben Cover) */}
      {galleryImageUrls.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Weitere Bilder
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {galleryImageUrls.map((url) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
              >
                <Image
                  src={url}
                  alt={`Bild von ${title}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 50vw, 320px"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Markdown-Body (zusaetzliche Informationen vom Template) */}
      {data.markdown && (
        <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
          <MarkdownPreview
            content={data.markdown}
            compact={true}
            className="min-h-0 w-full"
          />
        </div>
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

      {/* KI-Hinweis */}
      <AIGeneratedNotice compact />

      {/* Debug (nur Development) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded">
          <div className="font-semibold text-emerald-800 dark:text-emerald-200 mb-1">Debug: RefurbedDeviceDetail</div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            <div><strong>Detailansicht:</strong> RefurbedDeviceDetail</div>
            <div><strong>Modell:</strong> {data.modell || "—"}</div>
            <div><strong>Gerätetyp:</strong> {data.geraetetyp || "—"}</div>
            <div><strong>Spec-Items:</strong> {specItems.length}</div>
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

export default RefurbedDeviceDetail;
