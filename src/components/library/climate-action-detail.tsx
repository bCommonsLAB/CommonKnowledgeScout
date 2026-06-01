"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Tag, Check, X, Clock, HelpCircle, Bug } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { ClimateActionRating } from "./climate-action-rating";
import { StakeholderPositions } from "./gallery/stakeholder-positions";
import { SdgProfile } from "./gallery/sdg-profile";
import { AiText, OriginalQuote } from "./gallery/provenance-text";
import type { SdgValue } from "@/lib/gallery/sdg-meta";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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
  /** Positionen-Schachbrett (schematisch): Begründung der Landesverwaltung */
  position_landesverwaltung_begruendung?: string;
  /** Konsens/Consent-Text (vorerst meist leer) */
  konsens_text?: string;
  /** SDG-Profil: 17 Unterstuetzungsgrade (fuer das SDG-Rad). */
  sdgValues?: SdgValue[];
  /** Gemeinsame SDG-Begruendung. */
  sdgBegruendung?: string;

  // ─── Strukturierte Inhalts-Felder (Template) → Accordion-Abschnitte ────────
  /** Einleitung / Kontext. */
  einleitung?: string;
  /** Was wird vorgeschlagen (redaktioneller Text). */
  was_vorgeschlagen?: string;
  /** Originaltext des Vorschlags (Zitat). */
  vorschlag_text?: string;
  /** Quelle des Vorschlags (z.B. Stakeholder Forum Klima). */
  vorschlag_quelle?: string;
  /** Position der Landesverwaltung (redaktioneller Prosatext). */
  position_lv?: string;
  /** Originale Rückmeldung der Landesverwaltung (Zitat). */
  lv_rueckmeldung?: string;
  /** Fazit (laut Landesverwaltung). */
  fazit?: string;

  // ─── LLM-Bewertung (read-only, Welle "massnahmen-graph" 1) ───────────────
  /** CO₂-Einsparpotenzial in kt/Jahr (Südtirol). */
  co2_einsparung_kt?: number;
  co2_einsparung_kt_begruendung?: string;
  /** Durchsetzbarkeit 0..1. */
  durchsetzbarkeit?: number;
  durchsetzbarkeit_begruendung?: string;
  /** Kosten in EUR (Größenordnung). */
  kosten_eur?: number;
  kosten_eur_begruendung?: string;
  score_wirkung?: number;
  score_soziales?: number;
  score_struktur?: number;
  score_bewusstsein?: number;
  perspektiven_begruendung?: string;
  /** Argmax der Scores: wirkung | soziales | struktur | bewusstsein. */
  dominant_perspektive?: string;
  /** LLM-Modell der Bewertung (Transparenz). */
  bewertung_modell?: string;
  /** Datum der Bewertung (YYYY-MM-DD). */
  bewertung_stand?: string;

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
  const [debugOpen, setDebugOpen] = React.useState(false);
  // authors und topics sind für zukünftige Erweiterungen reserviert
  const actors = Array.isArray(data.actors) ? data.actors : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const hasSdg = (data.sdgValues ?? []).some((v) => v.value !== null);
  const hasRating = [
    data.co2_einsparung_kt, data.durchsetzbarkeit, data.kosten_eur,
    data.score_wirkung, data.score_soziales, data.score_struktur, data.score_bewusstsein,
  ].some((v) => typeof v === "number" && Number.isFinite(v));

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

      {/* Bericht als Fließtext (kein Accordion) – gut lesbar unter dem Bild */}
      {data.einleitung && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">Worum geht es?</h2>
          <AiText content={data.einleitung} />
        </section>
      )}

      {data.was_vorgeschlagen && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">Was wird vorgeschlagen?</h2>

          {/* Konsent der Stakeholder – eingebettet, auf-/zuklappbar (default offen) */}
          <div className="rounded-md border border-border px-3 mb-3">
            <Accordion type="multiple">
              <AccordionItem value="konsent" defaultOpen className="border-b-0">
                <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                  Konsent der Stakeholder
                </AccordionTrigger>
                <AccordionContent>
                  <StakeholderPositions embedded />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Konsens (KI-formuliert → blau) */}
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Konsens
          </div>
          <AiText content={data.was_vorgeschlagen} />
          {data.vorschlag_text && (
            <div className="mt-2">
              <OriginalQuote
                content={data.vorschlag_text}
                label={`Originaltext${data.vorschlag_quelle ? ` · ${data.vorschlag_quelle}` : ''}`}
              />
            </div>
          )}
        </section>
      )}

      {/* Position der Landesverwaltung – Resümee/Bericht (Fließtext) */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-2">Position der Landesverwaltung</h2>
        <div className="space-y-2 text-xs mb-2">
          {data.lv_bewertung && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Einschätzung:</span>
              <span>{data.lv_bewertung.replace(/_/g, ' ')}</span>
            </div>
          )}
          {data.lv_zustaendigkeit && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground flex-shrink-0">Zuständigkeit:</span>
              <span className="text-right">{data.lv_zustaendigkeit}</span>
            </div>
          )}
        </div>
        {data.position_lv && <AiText content={data.position_lv} />}
        {data.lv_rueckmeldung && (
          <div className="mt-2">
            <OriginalQuote content={data.lv_rueckmeldung} label="Originale Rückmeldung" />
          </div>
        )}
        {data.fazit && (
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Fazit laut Landesverwaltung
            </div>
            <AiText content={data.fazit} />
          </div>
        )}
      </section>

      {/* Aufklappbare Detail-Abschnitte (Accordion) – nach dem Bericht */}
      <div className="bg-card border border-border rounded-lg px-4 mb-6">
        <Accordion type="multiple">
          {/* Maßnahmen-Details */}
          <AccordionItem value="details" className="last:border-b-0">
            <AccordionTrigger className="py-4 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
              Maßnahmen-Details
            </AccordionTrigger>
            <AccordionContent>
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
                {data.region && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Region:</span>
                    <span>{data.region}</span>
                  </div>
                )}
              </div>
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
            </AccordionContent>
          </AccordionItem>

          {/* Beteiligte Akteure */}
          {actors.length > 0 && (
            <AccordionItem value="akteure" className="last:border-b-0">
              <AccordionTrigger className="py-4 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                Beteiligte Akteure
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1.5">
                  {actors.map((actor) => (
                    <Badge key={actor} variant="secondary" className="text-xs">
                      <Building2 className="w-2.5 h-2.5 mr-1" />{actor}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* KI-Einschätzung (statt wissenschaftlicher Einschätzung) */}
          {hasRating && (
            <AccordionItem value="ki" defaultOpen className="last:border-b-0">
              <AccordionTrigger className="py-4 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                KI-Einschätzung{' '}
                <span className="normal-case font-normal text-muted-foreground">(statt wissenschaftlicher Einschätzung)</span>
              </AccordionTrigger>
              <AccordionContent>
                <ClimateActionRating data={data} embedded />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* SDG-Einschätzung (Rad) */}
          {hasSdg && (
            <AccordionItem value="sdg" defaultOpen className="last:border-b-0">
              <AccordionTrigger className="py-4 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                SDG-Einschätzung
              </AccordionTrigger>
              <AccordionContent>
                <SdgProfile values={data.sdgValues ?? []} begruendung={data.sdgBegruendung} embedded />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>

      {/* KI-Hinweis */}
      <AIGeneratedNotice compact className="mt-6" />

      {/* Technische Infos / Debug – minimal, hinter einem kleinen Button (Anwender ignorieren das) */}
      <div className="mt-4 border-t pt-2">
        <button
          type="button"
          onClick={() => setDebugOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
          aria-expanded={debugOpen}
        >
          <Bug className="h-3 w-3" />Debug
        </button>
        {debugOpen && (
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {process.env.NODE_ENV === 'development' && (
              <div>ClimateActionDetail · Kategorie: {data.category || '—'} · Status: {data.status || '—'}</div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 break-all">
              {data.fileName && <span>Dateiname: {data.fileName}</span>}
              {typeof data.chunkCount === 'number' && <span>Chunks: {data.chunkCount}</span>}
              {data.fileId && <span>fileId: {data.fileId}</span>}
              {data.upsertedAt && <span>upsertedAt: {new Date(data.upsertedAt).toLocaleString('de-DE')}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClimateActionDetail;
