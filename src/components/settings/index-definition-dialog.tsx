'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'

interface IndexDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  indexDefinition: string
}

/**
 * Dialog-Komponente zur Anzeige der MongoDB Vector Search Index-Definition.
 * Zeigt die Index-Definition als JSON an und ermöglicht das Kopieren in die Zwischenablage.
 */
export function IndexDefinitionDialog({
  open,
  onOpenChange,
  collectionName,
  indexDefinition,
}: IndexDefinitionDialogProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(indexDefinition)
      setCopied(true)
      toast({
        title: t('settings.indexDefinition.copied'),
        description: t('settings.indexDefinition.copiedDescription'),
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Fehler beim Kopieren:', error)
      toast({
        title: t('settings.indexDefinition.copyError'),
        description: error instanceof Error ? error.message : t('settings.indexDefinition.unknownError'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('settings.indexDefinition.title')}</DialogTitle>
          <DialogDescription>
            {t('settings.indexDefinition.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Collection und Index Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('settings.indexDefinition.collection')}</p>
                <p className="text-sm text-muted-foreground font-mono">{collectionName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.indexDefinition.indexName')}</p>
                <p className="text-sm text-muted-foreground font-mono">vector_search_idx</p>
              </div>
            </div>
          </div>

          {/* Index Definition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('settings.indexDefinition.definition')}</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t('settings.indexDefinition.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {t('settings.indexDefinition.copy')}
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/30 p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {indexDefinition}
              </pre>
            </ScrollArea>
          </div>

          {/* Anweisungen */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {t('settings.indexDefinition.instructionsTitle')}
            </p>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li>{t('settings.indexDefinition.instruction1')}</li>
              <li>{t('settings.indexDefinition.instruction2')}</li>
              <li>{t('settings.indexDefinition.instruction3')}</li>
              <li>{t('settings.indexDefinition.instruction4')}</li>
            </ol>
            <div className="pt-2">
              <a
                href="https://www.mongodb.com/docs/atlas/atlas-search/create-index/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                {t('settings.indexDefinition.documentationLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}









