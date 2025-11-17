'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Shield, Eye, Users2, FileText } from "lucide-react"
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

          <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
            {/* Nachvollziehbar - Auge + Dokument */}
            <Card className="relative border-2 overflow-hidden flex flex-col bg-muted/70 dark:bg-card min-h-[240px] md:min-h-[260px]">
              {/* Hintergrund-Icon: Auge + Dokument */}
              <div className="absolute top-2 left-0 right-0 flex justify-center opacity-[0.15] dark:opacity-[0.08]">
                <div className="relative">
                  <Eye className="h-32 w-32 text-foreground dark:text-foreground" strokeWidth={1.5} />
                  <FileText className="absolute -bottom-2 -right-2 h-16 w-16 text-foreground dark:text-foreground" strokeWidth={1.5} />
                </div>
                </div>
              <CardContent className="relative z-10 pt-20 pb-8 px-6 text-center flex-1 flex flex-col justify-end">
                <h3 className="mb-3 font-semibold text-foreground dark:text-foreground">{t('home.philosophy.transparent.title')}</h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">
                  {t('home.philosophy.transparent.description')}
                </p>
              </CardContent>
            </Card>

            {/* Menschlich - Zwei Personen */}
            <Card className="relative border-2 overflow-hidden flex flex-col bg-muted/70 dark:bg-card min-h-[240px] md:min-h-[260px]">
              {/* Hintergrund-Icon: Zwei Personen */}
              <div className="absolute top-2 left-0 right-0 flex justify-center opacity-[0.15] dark:opacity-[0.08]">
                <Users2 className="h-32 w-32 text-foreground dark:text-foreground" strokeWidth={1.5} />
                </div>
              <CardContent className="relative z-10 pt-20 pb-8 px-6 text-center flex-1 flex flex-col justify-end">
                <h3 className="mb-3 font-semibold text-foreground dark:text-foreground">{t('home.philosophy.human.title')}</h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">
                  {t('home.philosophy.human.description')}
                </p>
              </CardContent>
            </Card>

            {/* Vertrauenswürdig - Schild */}
            <Card className="relative border-2 overflow-hidden flex flex-col bg-muted/70 dark:bg-card min-h-[240px] md:min-h-[260px]">
              {/* Hintergrund-Icon: Schild */}
              <div className="absolute top-2 left-0 right-0 flex justify-center opacity-[0.15] dark:opacity-[0.08]">
                <Shield className="h-32 w-32 text-foreground dark:text-foreground" strokeWidth={1.5} />
                </div>
              <CardContent className="relative z-10 pt-20 pb-8 px-6 text-center flex-1 flex flex-col justify-end">
                <h3 className="mb-3 font-semibold text-foreground dark:text-foreground">{t('home.philosophy.trustworthy.title')}</h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">{t('home.philosophy.trustworthy.description')}</p>
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








