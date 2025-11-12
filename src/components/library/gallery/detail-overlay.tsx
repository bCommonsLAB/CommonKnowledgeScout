'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { X, MessageCircle, ArrowRight } from 'lucide-react'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { useTranslation } from '@/lib/i18n/hooks'

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  viewType: 'book' | 'session'
  title?: string
  onSwitchToStoryMode?: () => void
}

export function DetailOverlay({ open, onClose, libraryId, fileId, viewType, title = 'Dokument-Details', onSwitchToStoryMode }: DetailOverlayProps) {
  const { t } = useTranslation()
  
  // Debug: Logge viewType
  React.useEffect(() => {
    if (open) {
      console.log('[DetailOverlay] Rendering with viewType:', viewType, 'fileId:', fileId)
    }
  }, [open, viewType, fileId])
  
  if (!open) return null
  return (
    <div className='fixed inset-0 z-50'>
      <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={onClose} />
      <div className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden'>
        <div className='flex flex-col gap-3 p-6 border-b shrink-0'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-semibold'>{title}</h2>
            <div className='flex items-center gap-2 shrink-0'>
              <Button variant='ghost' size='icon' onClick={onClose}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
          
          {/* CTA-Button für Story Mode */}
          {onSwitchToStoryMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onSwitchToStoryMode}
                    className="flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                  >
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{t('gallery.detailViewStoryModeCta')}</span>
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('gallery.storyModeTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <ScrollArea className='flex-1 w-full overflow-hidden'>
          <div className='p-0 w-full max-w-full overflow-x-hidden'>
            {viewType === 'session' ? (
              <IngestionSessionDetail libraryId={libraryId} fileId={fileId} onDataLoaded={() => {}} />
            ) : (
              <IngestionBookDetail libraryId={libraryId} fileId={fileId} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}


