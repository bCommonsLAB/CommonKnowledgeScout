'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Shield, Eye, Users2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n/hooks"

export function PhilosophySection() {
  const { t } = useTranslation()
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">
              {t('home.philosophy.title')}
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              {t('home.philosophy.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Eye className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">{t('home.philosophy.transparent.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('home.philosophy.transparent.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Users2 className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">{t('home.philosophy.human.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('home.philosophy.human.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Shield className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">{t('home.philosophy.trustworthy.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('home.philosophy.trustworthy.description')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 rounded-lg bg-muted/50 p-8 text-center">
            <h3 className="mb-3 text-xl font-semibold">{t('home.philosophy.behindLibraries.title')}</h3>
            <p className="leading-relaxed text-muted-foreground text-pretty">
              {t('home.philosophy.behindLibraries.description')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}








