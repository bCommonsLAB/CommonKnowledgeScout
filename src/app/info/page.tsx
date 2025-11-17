'use client'

import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n/hooks"
import { useSearchParams } from "next/navigation"

const MARKDOWN_FILES: Record<string, string> = {
  'about': '/docs/footer/about.md',
  'impressum': '/docs/footer/Impressum.md',
  'datenschutz': '/docs/footer/privacy.md',
  'rechtliche-hinweise': '/docs/footer/legal-notice.md',
  'legal-notice': '/docs/footer/legal-notice.md',
  'privacy': '/docs/footer/privacy.md',
}

function InfoPageContent() {
  const { t, locale } = useTranslation()
  const searchParams = useSearchParams()
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const infoType = searchParams?.get('type') || 'about'
  const markdownPath = MARKDOWN_FILES[infoType] || MARKDOWN_FILES['about']

  useEffect(() => {
    async function loadMarkdown() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(markdownPath)
        if (response.ok) {
          const content = await response.text()
          setMarkdownContent(content)
        } else {
          console.error('Failed to load markdown file:', response.status)
          setError('File not found')
        }
      } catch (error) {
        console.error('Error loading markdown file:', error)
        setError('Failed to load content')
      } finally {
        setLoading(false)
      }
    }
    loadMarkdown()
  }, [markdownPath])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.backToHome')}
          </Button>
        </Link>

        <article className="prose prose-slate max-w-none">
          {loading ? (
            <div className="text-muted-foreground">
              <p>{t('legalNotice.loadingContent')}</p>
            </div>
          ) : error ? (
            <div className="text-muted-foreground">
              <p>{t('legalNotice.loadError')}</p>
            </div>
          ) : markdownContent ? (
            <div className="markdown-content w-full">
              <MarkdownPreview 
                content={markdownContent}
                currentFolderId="root"
                provider={null}
                className="[&>div]:!h-auto [&>div]:!min-h-0 [&_div[data-markdown-scroll-root]]:!overflow-visible [&_div[data-markdown-scroll-root]]:!h-auto"
                compact={false}
              />
            </div>
          ) : (
            <div className="text-muted-foreground">
              <p>{t('legalNotice.loadError')}</p>
            </div>
          )}

          {(infoType === 'rechtliche-hinweise' || infoType === 'legal-notice') && (
            <div className="mt-12 p-6 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>{t('legalNotice.lastUpdate')}</strong>{" "}
                {new Date().toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'it-IT', { 
                  year: "numeric", 
                  month: "long", 
                  day: "numeric" 
                })}
              </p>
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

export default function InfoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <InfoPageContent />
    </Suspense>
  )
}

