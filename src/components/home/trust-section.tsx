'use client'

import { Card, CardContent } from '@ks/ui'
import { FileText, HardDrive, ListOrdered, Quote } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"

/**
 * Vier Zusagen, warum man einer Antwort trauen kann
 * (Original bleibt, Quelle je Aussage, Reihenfolge nicht kaeuflich,
 * Dateien im eigenen Speicher). Ersetzt „Transparenz statt Blackbox".
 */
export function TrustSection() {
  const { t } = useTranslation()

  const promises = [
    { key: 'original', icon: FileText },
    { key: 'source', icon: Quote },
    { key: 'order', icon: ListOrdered },
    { key: 'storage', icon: HardDrive },
  ]

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">
              {t('home.trust.title')}
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              {t('home.trust.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 md:items-stretch">
            {promises.map((promise) => {
              const Icon = promise.icon
              return (
                <Card key={promise.key} className="flex flex-col border-2 bg-muted/70 dark:bg-card">
                  <CardContent className="flex flex-1 flex-col px-6 pb-8 pt-8">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10">
                      <Icon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="mb-3 font-semibold text-foreground">
                      {t(`home.trust.${promise.key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`home.trust.${promise.key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <p className="mt-10 text-center leading-relaxed text-muted-foreground text-pretty">
            {t('home.trust.note')}
          </p>
        </div>
      </div>
    </section>
  )
}
