'use client'

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Compass, Mail, Eye } from "lucide-react"
import { useTranslation } from "@/lib/i18n/hooks"

export function CTASection() {
  const { t } = useTranslation()
  return (
    <section className="bg-gradient-to-b from-background to-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          {/* Lab Icon */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl">🧪</span>
            </div>
          </div>

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
            <p className="text-pretty">
              {t('home.cta.description3')}
            </p>
          </div>

          {/* CTA Buttons */}
          <TooltipProvider>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="gap-2" asChild>
                <a href="https://github.com/bCommonsLAB/CommonKnowledgeScout" target="_blank" rel="noopener noreferrer">
                  <Compass className="h-5 w-5" />
                  {t('home.cta.buttonResearch')}
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 bg-transparent" asChild>
                <a href="https://www.peteraichner.org/" target="_blank" rel="noopener noreferrer">
                  <Mail className="h-5 w-5" />
                  {t('home.cta.buttonContact')}
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 bg-transparent" asChild>
                <a href="/info?type=about">
                  <Eye className="h-5 w-5" />
                  {t('home.cta.buttonView')}
                </a>
              </Button>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  )
}








