"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf, Users, Building2, Tag, Check, X, Clock, HelpCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";
import { cn } from "@/lib/utils";

// Status-Mapping (wie im Teaser)
type StatusKey = 'aktiv' | 'geplant' | 'abgelehnt' | 'offen';
interface StatusConfig {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  icon: 'Check' | 'Clock' | 'X' | 'HelpCircle';
}

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  aktiv: { label: 'In Umsetzung', color: 'green', icon: 'Check' },
  geplant: { label: 'Geplant', color: 'yellow', icon: 'Clock' },
  abgelehnt: { label: 'Abgelehnt', color: 'red', icon: 'X' },
  offen: { label: 'Offen', color: 'gray', icon: 'HelpCircle' },
};

const iconMap = { Check, Clock, X, HelpCircle };

function mapBewertungToStatus(bewertung?: string): StatusKey {
  if (!bewertung) return 'offen';
  const lower = bewertung.toLowerCase();
  
  // WICHTIG: "nicht_umsetzbar" muss VOR "umsetzbar" geprüft werden!
  // Sonst matcht "umsetz" auch "nicht_umsetzbar"
  if (lower.includes('nicht_umsetzbar') || lower.includes('nicht umsetzbar') || lower === 'abgelehnt') {
    return 'abgelehnt';
  }
  
  // Positive Bewertungen (Umsetzung aktiv oder geplant)
  if (lower.includes('in_umsetzung') || lower.includes('bereits') || lower.includes('klimaplan') || lower.includes('fachplänen')) {
    return 'aktiv';
  }
  
  // Neu und umsetzbar = geplant (nicht aktiv)
  if (lower.includes('neu_umsetzbar') || lower.includes('neu umsetzbar')) {
    return 'geplant';
  }
  
  // Noch zu prüfen
  if (lower.includes('prüf') || lower.includes('vertieft') || lower.includes('unklar')) {
    return 'geplant';
  }
  
  return 'offen';
}

/**
 * Datenstruktur für ClimateAction Detail-Ansicht.
 * Basiert auf BookDetailData, erweitert um klimaspezifische Felder.
 */
export interface ClimateActionDetailData {
  // Basis-Felder (wie Book)
  title: string;
  summary?: string;
  markdown?: string;
  coverImageUrl?: string;
  url?: string;
  
  // Klima-spezifische Felder (Template: klimamassnahme-detail)
  /** Kategorie für Facettenfilter (z.B. Handlungsfeld) */
  category?: string;
  /** Maßnahmen-Nummer */
  massnahme_nr?: string;
  /** Bewertung der Landesverwaltung */
  lv_bewertung?: string;
  /** Arbeitsgruppe (Energie, Mobilität, Wohnen, etc.) */
  arbeitsgruppe?: string;
  /** Zuständigkeit (Ressort/Gemeinde) */
  lv_zustaendigkeit?: string;
  
  // Legacy-Felder (für andere Klima-Templates)
  // category ist bereits oben definiert (Klima-spezifische Felder)
  /** Sektor (z.B. "Öffentlich", "Privat", "Industrie") */
  sector?: string;
  /** Region/Ort der Umsetzung */
  region?: string;
  /** Jahr der Umsetzung oder Veröffentlichung */
  year?: number | string;
  /** Status der Maßnahme (z.B. "Geplant", "In Umsetzung", "Abgeschlossen") */
  status?: string;
  /** Beteiligte Akteure/Organisationen */
  actors?: string[];
  /** Zielgruppe */
  targetGroup?: string;
  /** CO2-Einsparungspotenzial */
  co2Savings?: string;
  /** Kosten/Budget */
  budget?: string;
  /** Zeithorizont */
  timeframe?: string;
  /** SDG-Bezüge (Sustainable Development Goals) */
  sdgs?: string[];
  /** Schlagwörter/Tags */
  tags?: string[];
  /** Themen */
  topics?: string[];
  /** Quelle */
  source?: string;
  /** Autor/Herausgeber */
  authors?: string[];
  
  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface ClimateActionDetailProps {
  data: ClimateActionDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

/**
 * Detail-Ansicht für Klimamaßnahmen.
 * Basiert auf BookDetail, optimiert für klimaspezifische Metadaten.
 */
export function ClimateActionDetail({ 
  data, 
  backHref = "/library", 
  showBackLink = false 
}: ClimateActionDetailProps) {
  const title = data.title || "—";
  // authors und topics sind für zukünftige Erweiterungen reserviert
  const actors = Array.isArray(data.actors) ? data.actors : [];
  const sdgs = Array.isArray(data.sdgs) ? data.sdgs : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];

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

      {/* Header: Kategorie → Titel → Status-Badge */}
      <div className="mb-6">
        {/* Kategorie als Text oben */}
        {data.category && (
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400 mb-2">
            {data.category}
          </span>
        )}
        
        {/* Titel */}
        <h1 className="text-2xl font-bold text-foreground mb-3 text-balance">{title}</h1>
        
        {/* Nur Status-Badge (LV-Bewertung) - andere Details sind in Maßnahmen-Details */}
        {(() => {
          const status = mapBewertungToStatus(data.lv_bewertung);
          const config = STATUS_CONFIG[status];
          const IconComponent = iconMap[config.icon];
          return (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                config.color === 'green' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                config.color === 'yellow' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                config.color === 'red' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                config.color === 'gray' && 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
              )}
            >
              <IconComponent className='w-3 h-3' />
              {config.label}
            </div>
          );
        })()}
      </div>

      {/* Zusammenfassung (ohne Rahmen) */}
      {data.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty mb-6">{data.summary}</p>
      )}
      
      {/* Cover-Bild in voller Breite (nach Zusammenfassung) */}
      {data.coverImageUrl && (
        <div className="mb-6 rounded-lg overflow-hidden border border-border">
          <Image
            src={data.coverImageUrl}
            alt={title}
            width={800}
            height={450}
            className="w-full h-auto object-cover aspect-video"
            unoptimized
          />
        </div>
      )}

      {/* Maßnahmen-Details mit den wichtigsten Klima-Metadaten */}
      <section className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
          <Leaf className="w-3 h-3" />Maßnahmen-Details
        </h2>
        <div className="space-y-2 text-xs">
          {data.massnahme_nr && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maßnahme Nr.:</span>
              <span className="font-mono">{data.massnahme_nr}</span>
            </div>
          )}
          {data.arbeitsgruppe && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arbeitsgruppe:</span>
              <span>{data.arbeitsgruppe}</span>
            </div>
          )}
          {data.category && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kategorie:</span>
              <span>{data.category}</span>
            </div>
          )}
          {data.lv_zustaendigkeit && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground flex-shrink-0">Zuständigkeit:</span>
              <span className="text-right">{data.lv_zustaendigkeit}</span>
            </div>
          )}
          {data.lv_bewertung && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">LV-Bewertung:</span>
              <span>{data.lv_bewertung.replace(/_/g, ' ')}</span>
            </div>
          )}
          {data.region && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Region:</span>
              <span>{data.region}</span>
            </div>
          )}
        </div>
        
        {/* Tags als Badges */}
        {tags.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="w-2.5 h-2.5 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Akteure (nur anzeigen wenn vorhanden) */}
      {actors.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-3 h-3" />Beteiligte Akteure
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {actors.map((actor) => (
              <Badge key={actor} variant="secondary" className="text-xs">
                <Building2 className="w-2.5 h-2.5 mr-1" />{actor}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* SDGs (nur anzeigen wenn vorhanden) */}
      {sdgs.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Nachhaltigkeitsziele (SDGs)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {sdgs.map((sdg) => (
              <Badge key={sdg} variant="outline" className="text-xs">{sdg}</Badge>
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

      {/* KI-Hinweis am Ende der Seite */}
      <AIGeneratedNotice compact />

      {/* Debug-Modus */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 mb-2 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
          <div className="font-semibold text-green-800 dark:text-green-200 mb-1">🌱 Debug: ClimateActionDetail</div>
          <div className="text-xs text-green-700 dark:text-green-300">
            <div><strong>Detailansicht:</strong> ClimateActionDetail</div>
            <div><strong>Kategorie:</strong> {data.category || '—'}</div>
            <div><strong>Status:</strong> {data.status || '—'}</div>
          </div>
        </div>
      )}

      {/* Footer mit technischen Infos */}
      <div className="mt-6 text-xs text-muted-foreground border-t pt-2">
        <div className="flex flex-wrap gap-1">
          {data.fileName && <span>Dateiname: {data.fileName}</span>}
          {typeof data.chunkCount === 'number' && <span>Chunks: {data.chunkCount}</span>}
          {data.fileId && <span>fileId: {data.fileId}</span>}
          {data.upsertedAt && <span>upsertedAt: {new Date(data.upsertedAt).toLocaleString('de-DE')}</span>}
        </div>
      </div>
    </div>
  );
}

export default ClimateActionDetail;
