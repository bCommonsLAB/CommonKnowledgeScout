'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Library, MessageSquare, Lightbulb } from "lucide-react"
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
    },
    {
      number: "2",
      icon: MessageSquare,
      title: t('home.howItWorks.step2.title'),
      description: t('home.howItWorks.step2.description'),
      detail: t('home.howItWorks.step2.detail'),
    },
    {
      number: "3",
      icon: Lightbulb,
      title: t('home.howItWorks.step3.title'),
      description: t('home.howItWorks.step3.description'),
      detail: t('home.howItWorks.step3.detail'),
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

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <Card key={step.number} className="relative border-2">
                <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.number}
                </div>
                <CardContent className="pt-8">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="mb-3 text-muted-foreground leading-relaxed">{step.description}</p>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">{step.detail}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}








