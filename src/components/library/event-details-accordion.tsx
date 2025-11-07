"use client";

import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ExternalLink, FileText, Video } from "lucide-react";
import type { SessionDetailData } from "./session-detail";
import { useTranslation } from "@/lib/i18n/hooks";

interface EventDetailsAccordionProps {
  data: SessionDetailData;
}

/**
 * Event Details Accordion für Header
 * Zeigt Event-Details in einem aufklappbaren Accordion
 * Standardmäßig zugeklappt, beim Öffnen als Overlay
 */
export function EventDetailsAccordion({ data }: EventDetailsAccordionProps) {
  const { t } = useTranslation()
  const tags = Array.isArray(data.tags) ? data.tags : [];

  return (
    <div className="relative">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="details" className="border-none">
          <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-1 hover:no-underline px-2">
            {t('event.eventDetails')}
          </AccordionTrigger>
          <AccordionContent className="absolute left-0 top-full mt-2 z-50">
            <Card className="w-80 shadow-lg bg-background border">
              <div className="p-4 space-y-3 text-sm">
                {data.date && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{data.date}</div>
                    </div>
                  </div>
                )}

                {(data.starttime || data.endtime || data.duration) && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      {data.starttime && data.endtime ? (
                        <>
                          <div className="font-medium">
                            {data.starttime} - {data.endtime}
                          </div>
                          {data.duration && (
                            <div className="text-xs text-muted-foreground">{data.duration} {t('event.minutes')}</div>
                          )}
                        </>
                      ) : data.duration ? (
                        <div className="font-medium">{data.duration} {t('event.minutes')}</div>
                      ) : null}
                    </div>
                  </div>
                )}

                {data.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{data.location}</div>
                    </div>
                  </div>
                )}

                {data.track && (
                  <div className="pt-2 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {data.track}
                    </Badge>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 5).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(data.url || data.attachments_url || data.video_url) && (
                  <div className="pt-2 border-t space-y-2">
                    {data.url && (
                      <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8 px-2">
                        <a href={data.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-2" />
                          {t('event.eventWebsite')}
                        </a>
                      </Button>
                    )}
                    {data.attachments_url && (
                      <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8 px-2">
                        <a href={data.attachments_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3 mr-2" />
                          {t('event.downloadSlides')}
                        </a>
                      </Button>
                    )}
                    {data.video_url && (
                      <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8 px-2">
                        <a href={data.video_url} target="_blank" rel="noopener noreferrer">
                          <Video className="h-3 w-3 mr-2" />
                          {t('event.watchVideo')}
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
