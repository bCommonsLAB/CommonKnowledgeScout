'use client'

import { Button } from '@ks/ui'
import { Compass, Mail, Presentation } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"

/** Vortragsseite „Don't Ask the AI. Ask Collective Knowledge." (SFSCON 2026). */
const TALK_URL = 'https://www.sfscon.it/talks/dont-ask-the-ai-ask-collective-knowledge/'

export function CTASection() {
  const { t } = useTranslation()
  return (
    <section className="bg-gradient-to-b from-background to-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          {/* Headline */}
          <h2 className="mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl text-balance">
            {t('home.cta.title')}
          </h2>

          {/* Description */}
          <div className="mb-10 space-y-4 text-center text-lg text-muted-foreground">
            <p className="text-pretty">
              {t('home.cta.description1')}
            </p>
            <p className="text-pretty">
              {t('home.cta.description2')}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2" asChild>
              <a href="https://bcommonslab.org/" target="_blank" rel="noopener noreferrer">
                <Mail className="h-5 w-5" />
                {t('home.cta.buttonContact')}
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent" asChild>
              <a href="https://github.com/bCommonsLAB/CommonKnowledgeScout" target="_blank" rel="noopener noreferrer">
                <Compass className="h-5 w-5" />
                View on GitHub
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent" asChild>
              <a href={TALK_URL} target="_blank" rel="noopener noreferrer">
                <Presentation className="h-5 w-5" />
                {t('home.cta.buttonTalk')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
