'use client'

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/hooks"

export function Footer() {
  const { t } = useTranslation()
  
  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        {/* Transparenz-Hinweis gemäß EU AI Act */}
        <div className="mb-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            {t('footer.transparency')}{" "}
            <Link href="/info?type=rechtliche-hinweise" className="underline hover:text-foreground">
              {t('footer.learnMore')}
            </Link>
          </p>
        </div>

        {/* Links zu rechtlichen Seiten */}
        <div className="mb-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/info?type=datenschutz" className="text-muted-foreground hover:text-foreground underline">
            {t('footer.privacy')}
          </Link>
          <Link href="/info?type=impressum" className="text-muted-foreground hover:text-foreground underline">
            {t('footer.imprint')}
          </Link>
          <Link href="/info?type=rechtliche-hinweise" className="text-muted-foreground hover:text-foreground underline">
            {t('footer.legalNotice')}
          </Link>
          <Link href="/info?type=about" className="text-muted-foreground hover:text-foreground underline">
            {t('footer.about')}
          </Link>
          <Link href="/docs" className="text-muted-foreground hover:text-foreground underline">
            {t('footer.documentation')}
          </Link>
        </div>

        {/* Projekt-Info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {(() => {
              const text = t('footer.projectInfo', {
                crystalDesign: '{CRYSTAL_DESIGN}',
                bcommonslab: '{BCOMMONSLAB}'
              })
              const parts = text.split(/(\{CRYSTAL_DESIGN\}|\{BCOMMONSLAB\})/g)
              return parts.map((part, i) => {
                if (part === '{CRYSTAL_DESIGN}') {
                  return <span key={i} className="font-medium text-foreground">{t('footer.crystalDesign')}</span>
                }
                if (part === '{BCOMMONSLAB}') {
                  return <span key={i} className="font-medium text-foreground">{t('footer.bcommonslab')}</span>
                }
                return <span key={i}>{part}</span>
              })
            })()}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('footer.collaboration')}
          </p>
        </div>
      </div>
    </footer>
  )
}






