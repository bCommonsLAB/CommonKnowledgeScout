"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { EventSlides } from "@/components/event-slides";
import { EventSummary } from "@/components/event-summary";
import type { Slide } from "@/components/library/slide-accordion";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { useTranslation } from "@/lib/i18n/hooks";
import type { StorageProvider } from "@/lib/storage/types";
import QRCode from "react-qr-code";
import { useLibraryRole } from "@/hooks/use-library-role";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Interface für Session-Detail-Daten aus Event/Konferenz-Dokumenten
 */
export interface SessionDetailData {
  title: string;
  shortTitle?: string;
  teaser?: string;
  summary?: string; // Markdown-formatiert (für Retrieval)
  markdown?: string; // Markdown-Body für Detailansicht
  /** Optional: Slug für Public/Explorer URLs */
  slug?: string;
  /** Optional: Doc-Type aus Frontmatter (für Events: 'event') */
  docType?: string;
  /** Optional: Event-Status (open/finalDraft/finalPublished) */
  eventStatus?: string;
  /** Optional: per-event write key (für QR Upload) */
  testimonialWriteKey?: string;
  /** Optional: bei Final-Runs: Referenz auf Original (fileId) */
  originalFileId?: string;
  /** Optional: Flow-Orchestrierung aus Event-Frontmatter */
  wizard_testimonial_template_id?: string;
  /** Optional: Flow-Orchestrierung aus Event-Frontmatter */
  wizard_finalize_template_id?: string;
  speakers?: string[];
  speakers_url?: string[];
  speakers_image_url?: string[];
  affiliations?: string[];
  tags?: string[];
  topics?: string[];
  year?: number | string;
  date?: string; // ISO-Date oder formatiert
  starttime?: string;
  endtime?: string;
  duration?: string | number;
  location?: string;
  event?: string;
  track?: string;
  session?: string;
  language?: string;
  slides?: Slide[];
  video_url?: string;
  attachments_url?: string;
  url?: string; // Session-URL auf Event-Website
  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface SessionDetailProps {
  data: SessionDetailData;
  backHref?: string;
  showBackLink?: boolean;
  libraryId?: string; // Optional: für Link zur Library
  provider?: StorageProvider | null;
  currentFolderId?: string;
}

/**
 * Detailansicht für Event-Sessions/Präsentationen
 * Moderne UI mit Hero-Section, Speakers mit Avataren, Event-Details Sidebar
 */
export function SessionDetail({
  data,
  backHref = "/library",
  showBackLink = false,
  libraryId,
  provider = null,
  currentFolderId = 'root',
}: SessionDetailProps) {
  const { t } = useTranslation()
  const { isOwnerOrModerator, isLoading: isLoadingRole, error: roleError } = useLibraryRole(libraryId)
  const router = useRouter()
  const title = data.title || data.shortTitle || "—";
  const speakers = Array.isArray(data.speakers) ? data.speakers : [];
  const speakers_url = Array.isArray(data.speakers_url) ? data.speakers_url : [];
  const speakers_image_url = Array.isArray(data.speakers_image_url) ? data.speakers_image_url : [];
  const affiliations = Array.isArray(data.affiliations) ? data.affiliations : [];
  const slides = Array.isArray(data.slides) ? data.slides : [];

  const isEvent = (data.docType || '').toLowerCase() === 'event'
  const eventFileId = data.fileId
  const writeKey = typeof data.testimonialWriteKey === 'string' ? data.testimonialWriteKey.trim() : ''
  /**
   * Moderator-Tools (QR, Wizard-Buttons):
   *
   * Primär: `isOwnerOrModerator` via API (/api/libraries/[id]/me/role).
   *
   * Fallback: In manchen Setups (z.B. lokale Libraries ohne Mongo-Membership)
   * ist der Role-Check serverseitig nicht zuverlässig möglich.
   * Wenn wir ein `testimonialWriteKey` sehen, ist das ein starkes Indiz, dass der aktuelle Viewer
   * im privilegierten Kontext ist (private Library / Owner-View).
   *
   * WICHTIG: Das ist bewusst konservativ:
   * - Ohne writeKey UND ohne isOwnerOrModerator zeigen wir nichts.
   */
  const canSeeModeratorTools = !!isOwnerOrModerator || (isEvent && !!libraryId && !!eventFileId && !!writeKey)

  // Debug-Logging für Rollen-Check (direkt beim Rendern, damit es garantiert ausgelöst wird)
  if (typeof window !== 'undefined') {
    console.log('[SessionDetail] Rollen-Check:', {
      libraryId,
      isEvent,
      eventFileId,
      hasWriteKey: !!writeKey,
      isOwnerOrModerator,
      isLoadingRole,
      roleError,
      canSeeModeratorTools,
      wizard_testimonial_template_id: data.wizard_testimonial_template_id,
      docType: data.docType,
    })
  }
  const publicAnonTestimonialUrl = React.useMemo(() => {
    if (!libraryId || !eventFileId) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return ''
    const params = new URLSearchParams()
    params.set('libraryId', libraryId)
    params.set('eventFileId', eventFileId)
    if (writeKey) params.set('writeKey', writeKey)
    return `${origin}/public/testimonial?${params.toString()}`
  }, [libraryId, eventFileId, writeKey])

  const [storageContext, setStorageContext] = React.useState<{
    eventFolderId: string
    testimonialsFolderId: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function loadStorageContext() {
      if (!isEvent) return
      if (!canSeeModeratorTools) return
      if (!libraryId || !eventFileId) return
      try {
        const qp = new URLSearchParams()
        qp.set('eventFileId', eventFileId)
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/events/storage-context?${qp.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as Record<string, unknown>))
        if (!res.ok) return
        const eventFolderId = typeof (json as { eventFolderId?: unknown }).eventFolderId === 'string' ? String((json as { eventFolderId: string }).eventFolderId) : ''
        const testimonialsFolderId = typeof (json as { testimonialsFolderId?: unknown }).testimonialsFolderId === 'string' ? String((json as { testimonialsFolderId: string }).testimonialsFolderId) : ''
        if (!eventFolderId || !testimonialsFolderId) return
        if (!cancelled) setStorageContext({ eventFolderId, testimonialsFolderId })
      } catch {
        // ignore
      }
    }
    void loadStorageContext()
    return () => { cancelled = true }
  }, [isEvent, canSeeModeratorTools, libraryId, eventFileId])

  const publicWizardTestimonialUrl = React.useMemo(() => {
    if (!libraryId || !eventFileId) return ''
    if (!storageContext?.testimonialsFolderId) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return ''
    const testimonialWizardTemplateId = (data.wizard_testimonial_template_id || 'event-testimonial-creation-de').trim()
    const params = new URLSearchParams()
    params.set('seedFileId', eventFileId)
    params.set('targetFolderId', storageContext.testimonialsFolderId)
    return `${origin}/library/create/${encodeURIComponent(testimonialWizardTemplateId)}?${params.toString()}`
  }, [libraryId, eventFileId, storageContext?.testimonialsFolderId, data.wizard_testimonial_template_id])

  const [testimonialItems, setTestimonialItems] = React.useState<Array<{
    testimonialId: string
    audio: { url: string | null; fileName: string | null } | null
    meta: unknown
  }>>([])
  const [isLoadingTestimonials, setIsLoadingTestimonials] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function loadTestimonials() {
      if (!isEvent) return
      if (!libraryId || !eventFileId) return
      setIsLoadingTestimonials(true)
      try {
        const qp = new URLSearchParams()
        qp.set('libraryId', libraryId)
        qp.set('eventFileId', eventFileId)
        if (writeKey) qp.set('writeKey', writeKey)
        const res = await fetch(`/api/public/testimonials?${qp.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as Record<string, unknown>))
        if (!res.ok) {
          const msg = typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`
          throw new Error(msg)
        }
        const items = Array.isArray((json as { items?: unknown }).items) ? ((json as { items: unknown[] }).items as unknown[]) : []
        const mapped = items
          .map((it) => (it && typeof it === 'object') ? (it as Record<string, unknown>) : null)
          .filter((it): it is Record<string, unknown> => !!it)
          .map((it) => ({
            testimonialId: typeof it.testimonialId === 'string' ? it.testimonialId : 'unknown',
            audio: it.audio && typeof it.audio === 'object'
              ? {
                  url: typeof (it.audio as Record<string, unknown>).url === 'string' ? String((it.audio as Record<string, unknown>).url) : null,
                  fileName: typeof (it.audio as Record<string, unknown>).fileName === 'string' ? String((it.audio as Record<string, unknown>).fileName) : null,
                }
              : null,
            meta: it.meta,
          }))
        if (!cancelled) setTestimonialItems(mapped)
      } catch {
        // Nicht fatal: Event-Seite soll trotzdem rendern
        if (!cancelled) setTestimonialItems([])
      } finally {
        if (!cancelled) setIsLoadingTestimonials(false)
      }
    }
    void loadTestimonials()
    return () => { cancelled = true }
  }, [isEvent, libraryId, eventFileId, writeKey])

  async function copyPublicUrl(): Promise<void> {
    if (!publicWizardTestimonialUrl && !publicAnonTestimonialUrl) return
    try {
      await navigator.clipboard.writeText(publicWizardTestimonialUrl || publicAnonTestimonialUrl)
    } catch {
      // ignore
    }
  }

  async function openTestimonialWizard(): Promise<void> {
    if (!libraryId || !eventFileId) return
    if (!storageContext?.testimonialsFolderId) return
    const testimonialWizardTemplateId = (data.wizard_testimonial_template_id || 'event-testimonial-creation-de').trim()
    const params = new URLSearchParams()
    params.set('seedFileId', eventFileId)
    params.set('targetFolderId', storageContext.testimonialsFolderId)
    router.push(`/library/create/${encodeURIComponent(testimonialWizardTemplateId)}?${params.toString()}`)
  }

  async function openFinalizeWizard(): Promise<void> {
    if (!libraryId || !eventFileId) return
    if (!storageContext?.eventFolderId) return
    const finalizeWizardTemplateId = (data.wizard_finalize_template_id || 'event-finalize-de').trim()
    const params = new URLSearchParams()
    params.set('seedFileId', eventFileId)
    params.set('targetFolderId', storageContext.eventFolderId)
    router.push(`/library/create/${encodeURIComponent(finalizeWizardTemplateId)}?${params.toString()}`)
  }

  async function openPublishWizard(): Promise<void> {
    if (!libraryId || !eventFileId) return
    const params = new URLSearchParams()
    params.set('resumeFileId', eventFileId)
    router.push(`/library/create/event-publish-final-de?${params.toString()}`)
  }

  // Helper: Speaker-URL für Index ermitteln
  const getSpeakerUrl = (index: number): string | undefined => {
    return speakers_url[index] && typeof speakers_url[index] === 'string' 
      ? speakers_url[index] 
      : undefined;
  };

  // Helper: Speaker-Image-URL für Index ermitteln
  const getSpeakerImageUrl = (index: number): string | undefined => {
    return speakers_image_url[index] && typeof speakers_image_url[index] === 'string' 
      ? speakers_image_url[index] 
      : undefined;
  };

  // Helper: Affiliation für Index ermitteln
  const getAffiliation = (index: number): string | undefined => {
    return affiliations[index] && typeof affiliations[index] === 'string' 
      ? affiliations[index] 
      : undefined;
  };

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden box-border">
      {/* Back Link */}
      {showBackLink && (
        <div className="w-full px-4 pt-4">
          <Link href={backHref} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{t('event.back')}</span>
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-b">
        <div className="w-full px-4 py-8">
          <div className="flex flex-col gap-8 items-start">
            {/* Left: Badge, Title, Teaser, and Speakers */}
            <div className="flex-1 w-full">
              <Badge className="mb-4 bg-blue-500 text-white hover:bg-blue-600">
                {isEvent ? "Event" : t('event.talk')}
              </Badge>

              <h1 className="text-4xl lg:text-5xl font-bold mb-4 text-balance">{title}</h1>

              {data.teaser && (
                <p className="text-lg text-muted-foreground mb-6 text-pretty">{data.teaser}</p>
              )}

              {/* PDF-Link prominent anzeigen */}
              {data.url && (
                <div className="mb-6">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-base font-medium shadow-sm"
                  >
                    <FileText className="w-5 h-5" />
                    PDF öffnen
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Speakers Section */}
              {speakers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-4">
                  {speakers.map((speaker, index) => {
                    const speakerUrl = getSpeakerUrl(index);
                    const speakerImageUrl = getSpeakerImageUrl(index);
                    const affiliation = getAffiliation(index);
                    const speakerInitials = speaker
                      .split(" ")
                      .map((n) => n[0])
                      .join("");

                    const speakerContent = (
                      <Card className="p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16 border-2 border-blue-400">
                            {speakerImageUrl ? (
                              <AvatarImage src={speakerImageUrl} alt={speaker} />
                            ) : null}
                            <AvatarFallback>{speakerInitials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                              {speaker}
                            </div>
                            {affiliation && (
                              <div className="text-sm text-muted-foreground">{affiliation}</div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );

                    if (speakerUrl) {
                      return (
                        <a
                          key={`${speaker}-${index}`}
                          href={speakerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                        >
                          {speakerContent}
                        </a>
                      );
                    }

                    return (
                      <div key={`${speaker}-${index}`} className="group">
                        {speakerContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-full px-4 py-8 box-border overflow-x-hidden">
        <div className="space-y-8 w-full max-w-full">
          {/* Event: Moderator-Tools + Testimonials */}
          {isEvent ? (
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium">Event</div>
                  <div className="text-xs text-muted-foreground">
                    Status: <span className="font-mono">{data.eventStatus || '—'}</span>
                  </div>
                </div>

                  {canSeeModeratorTools && !eventFileId ? (
                  <>
                    <Separator />
                    <div className="text-xs text-muted-foreground">
                      QR‑Code/Link sind erst nach dem <span className="font-semibold">Speichern</span> verfügbar,
                      weil dafür die <span className="font-mono">fileId</span> des Events benötigt wird.
                    </div>
                  </>
                ) : null}

                  {canSeeModeratorTools && (publicWizardTestimonialUrl || publicAnonTestimonialUrl) ? (
                  <>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-[160px_1fr] items-start">
                      <div className="rounded border bg-background p-3 w-fit">
                        <QRCode value={publicWizardTestimonialUrl || publicAnonTestimonialUrl} size={140} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">QR-Code für Testimonials</div>
                        <div className="text-xs text-muted-foreground">
                          Standard: Wizard-Flow (Template-basiert). Optional: anonymer Recorder.
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => void copyPublicUrl()}>
                            <Copy className="h-4 w-4 mr-2" />
                            Link kopieren
                          </Button>
                          {publicWizardTestimonialUrl ? (
                            <Button type="button" variant="secondary" size="sm" asChild>
                              <a href={publicWizardTestimonialUrl} target="_blank" rel="noopener noreferrer">
                                Wizard öffnen
                              </a>
                            </Button>
                          ) : null}
                          {publicAnonTestimonialUrl ? (
                            <Button type="button" variant="outline" size="sm" asChild>
                              <a href={publicAnonTestimonialUrl} target="_blank" rel="noopener noreferrer">
                                Anonym öffnen
                              </a>
                            </Button>
                          ) : null}
                        </div>
                        <div className="text-xs font-mono break-all text-muted-foreground">{publicWizardTestimonialUrl || publicAnonTestimonialUrl}</div>
                      </div>
                    </div>
                  </>
                ) : null}

                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">Testimonials</div>
                  {isLoadingTestimonials ? (
                    <div className="text-xs text-muted-foreground">Lade…</div>
                  ) : testimonialItems.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Noch keine Testimonials.</div>
                  ) : (
                    <div className="space-y-3">
                      {testimonialItems.map((it) => (
                        <div key={it.testimonialId} className="rounded border p-3">
                          <div className="text-sm font-medium">{it.testimonialId}</div>
                          {it.audio?.url ? (
                            <audio className="mt-2 w-full" controls src={it.audio.url} />
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">Kein Audio-Link verfügbar.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                  {canSeeModeratorTools && libraryId && eventFileId ? (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Co-Creation</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!data.originalFileId ? (
                          <>
                            <Button type="button" onClick={() => void openTestimonialWizard()} disabled={!storageContext?.testimonialsFolderId}>
                              Testimonial aufnehmen (Wizard)
                            </Button>
                            <Button type="button" variant="outline" onClick={() => void openFinalizeWizard()} disabled={!storageContext?.eventFolderId}>
                              Finalisieren (Wizard)
                            </Button>
                          </>
                        ) : (
                          <Button type="button" onClick={() => void openPublishWizard()}>
                            Final veröffentlichen (Wizard)
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Markdown Content Section - full width (verwendet markdown Feld, fallback auf summary) */}
          {(data.markdown || data.summary) && (
            <>
              <EventSummary
                summary={data.markdown || data.summary || ''}
                videoUrl={data.video_url}
                provider={provider}
                currentFolderId={currentFolderId}
              />
              {/* KI-Info-Hinweis für KI-generierte Zusammenfassung */}
              <AIGeneratedNotice compact />
            </>
          )}

          {/* Slides Section - full width */}
          {slides.length > 0 && <EventSlides slides={slides} libraryId={libraryId} />}
        </div>
      </div>

      {/* Debug-Informationen am Ende */}
      <div className="w-full px-4 pb-8">
        <div className="text-[10px] text-muted-foreground/50 text-center pt-4 border-t break-words space-y-1">
          {/* Debug-Modus: Detailansicht-Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-left">
              <div className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">🔍 Debug: SessionDetail</div>
              <div className="space-y-0.5 text-yellow-700 dark:text-yellow-300">
                <div><strong>Detailansicht:</strong> SessionDetail</div>
                <div><strong>docType:</strong> {data.docType || '—'}</div>
                <div><strong>isEvent:</strong> {String(isEvent)}</div>
                <div><strong>libraryId:</strong> {libraryId || '—'}</div>
                <div><strong>eventFileId:</strong> {eventFileId || '—'}</div>
                <div><strong>hasWriteKey:</strong> {String(!!writeKey)}</div>
                <div><strong>isOwnerOrModerator:</strong> {String(isOwnerOrModerator)}</div>
                <div><strong>isLoadingRole:</strong> {String(isLoadingRole)}</div>
                <div><strong>roleError:</strong> {roleError || '—'}</div>
                <div><strong>canSeeModeratorTools:</strong> {String(canSeeModeratorTools)}</div>
                <div><strong>wizard_testimonial_template_id:</strong> {data.wizard_testimonial_template_id || '—'}</div>
              </div>
            </div>
          )}
          
          {data.fileId && (
            <>
              {data.fileName && (
                <div className="break-all">
                  <FileText className="h-3 w-3 inline mr-1" />
                  {data.fileName}
                </div>
              )}
              <div className="break-all">
                {t('event.fileId')}: <code className="px-0.5 py-0 bg-muted rounded text-[10px] break-all">{data.fileId}</code>
                {libraryId && (
                  <Link 
                    href={`/library?activeLibraryId=${encodeURIComponent(libraryId)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      // Custom Event dispatchen, um Dokument in Gallery zu öffnen
                      const event = new CustomEvent('open-document-detail', {
                        detail: { fileId: data.fileId, fileName: data.fileName, libraryId },
                      });
                      window.dispatchEvent(event);
                      // Navigiere zur Library
                      window.location.href = `/library?activeLibraryId=${encodeURIComponent(libraryId)}`;
                    }}
                    className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('event.openInLibrary')}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionDetail;

