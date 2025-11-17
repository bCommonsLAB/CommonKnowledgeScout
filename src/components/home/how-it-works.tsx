'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Library, MessageSquare, Lightbulb, Copyright } from "lucide-react"
import { useTranslation } from "@/lib/i18n/hooks"

export function HowItWorks() {
  const { t } = useTranslation()
  
  const steps = [
    {
      number: "1",
      icon: Library,
      title: t('home.howItWorks.step1.title'),
      description: t('home.howItWorks.step1.description'),
      detail: t('home.howItWorks.step1.detail'),
      imageUrl: 'https://ragtempproject.blob.core.windows.net/knowledgescout/images/clarisse-meyer-jKU2NneZAbI-unsplash_low.jpg',
      imageAttribution: 'Photo by <a href="https://unsplash.com/@clarissemeyer?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">Clarisse Meyer</a> on <a href="https://unsplash.com/photos/books-in-glass-bookshelf-jKU2NneZAbI?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">Unsplash</a>',
    },
    {
      number: "2",
      icon: MessageSquare,
      title: t('home.howItWorks.step2.title'),
      description: t('home.howItWorks.step2.description'),
      detail: t('home.howItWorks.step2.detail'),
      imageUrl: 'https://ragtempproject.blob.core.windows.net/knowledgescout/images/kelly-sikkema-sWRPYgjpygQ-unsplash_low.jpg',
      imageAttribution: 'Photo by <a href="https://unsplash.com/@kellysikkema?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">Kelly Sikkema</a> on <a href="https://unsplash.com/photos/two-white-speech-bubbles-on-brown-surface-sWRPYgjpygQ?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">Unsplash</a>',
    },
    {
      number: "3",
      icon: Lightbulb,
      title: t('home.howItWorks.step3.title'),
      description: t('home.howItWorks.step3.description'),
      detail: t('home.howItWorks.step3.detail'),
      imageUrl: 'https://ragtempproject.blob.core.windows.net/knowledgescout/images/neom-EbIvcXzgU4s-unsplash_low.jpg',
      imageAttribution: 'Photo by <a href="https://unsplash.com/@neom?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">NEOM</a> on <a href="https://unsplash.com/photos/man-standing-in-tent-looking-at-distance-EbIvcXzgU4s?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer" class="underline">Unsplash</a>',
    },
  ]
  return (
    <section className="bg-muted/50 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">{t('home.howItWorks.title')}</h2>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <TooltipProvider>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3 md:items-stretch">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.number} className="relative flex flex-col">
                  {/* Nummerierung über der Card */}
                  <div className="absolute -top-4 left-6 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step.number}
                  </div>
                  
                  <Card 
                    className="relative border-2 overflow-hidden flex-1 flex flex-col"
                    style={{
                      backgroundImage: `url(${step.imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Helles Overlay für bessere Lesbarkeit */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white/60" />
                    
                    {/* Copyright-Icon für Bildquelle */}
                    <div className="absolute bottom-3 right-3 z-10">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-transparent text-foreground/70 hover:text-foreground transition-colors"
                            aria-label={t('common.imageSource')}
                          >
                            <Copyright className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs [&_a]:underline [&_a]:hover:text-primary [&_a]:transition-colors" dangerouslySetInnerHTML={{ __html: step.imageAttribution }} />
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <CardContent className="relative z-0 pt-8 flex-1 flex flex-col">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10 backdrop-blur-sm">
                        <Icon className="h-6 w-6 text-foreground" />
                      </div>
                      <h3 className="mb-3 text-xl font-semibold text-foreground">{step.title}</h3>
                      <p className="mb-3 text-foreground/90 leading-relaxed">{step.description}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed flex-1">{step.detail}</p>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </TooltipProvider>
        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {t('home.howItWorks.subtext')}
          </p>
        </div>
      </div>
    </section>
  )
}








