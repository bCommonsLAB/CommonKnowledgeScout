"use client"

import { useCallback, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Check, RefreshCw, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
// Generation-State + API-Aufruf wurden in
// src/hooks/library/cover-image-generator-dialog/use-image-generation.ts
// ausgegliedert (Welle 3-III-d, Schritt 1/3).
import {
  useImageGeneration,
  type GeneratedImage,
  type GenerationSize,
  type GenerationQuality,
} from '@/hooks/library/cover-image-generator-dialog/use-image-generation'

export type PromptSource = 'template' | 'frontmatter' | 'library_config' | 'default'

interface CoverImageGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (file: File) => Promise<void>
  defaultPrompt?: string
  /** Quelle des Prompts für informative Anzeige */
  promptSource?: PromptSource
  /** Original-Prompt aus der Quelle (vor Variablenersetzung) */
  originalPrompt?: string | null
}

/**
 * Dialog zum Generieren eines Coverbildes über den Secretary Service Text2Image Endpoint.
 * 
 * Generiert standardmäßig 4 Varianten gleichzeitig, die der Benutzer auswählen kann.
 * Die UI ist benutzerfreundlich gestaltet mit weniger technischen Details.
 */
// Labels für Prompt-Quellen
const SOURCE_LABELS: Record<PromptSource, string> = {
  template: 'Template-Vorlage',
  frontmatter: 'LLM-generiert (Frontmatter)',
  library_config: 'Library-Konfiguration',
  default: 'Standard',
}

export function CoverImageGeneratorDialog({
  open,
  onOpenChange,
  onGenerated,
  defaultPrompt = '',
  promptSource,
  originalPrompt,
}: CoverImageGeneratorDialogProps) {
  // Prompt + Size + Quality bleiben UI-State in der Komponente
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [size, setSize] = useState<GenerationSize>('1024x1024')
  const [quality, setQuality] = useState<GenerationQuality>('standard')

  // Generation-State + Logik via Custom-Hook (Welle 3-III-d)
  // useCallback fuer onClose, damit der Hook stabile Referenz bekommt.
  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const {
    isGenerating,
    generatedImages,
    selectedImageIndex,
    resetGeneration,
    generate,
    selectImage,
  } = useImageGeneration({ onGenerated, onClose: handleClose })

  // Prompt aus Template/Library neu setzen wenn Dialog geoeffnet wird
  // oder wenn sich der defaultPrompt aendert und keine Bilder generiert wurden
  useEffect(() => {
    if (open && generatedImages.length === 0) {
      setPrompt(defaultPrompt)
    }
  }, [open, defaultPrompt, generatedImages.length])

  // Prompt auf Template/Library-Wert zuruecksetzen
  const handleRecalculatePrompt = () => {
    setPrompt(defaultPrompt)
    toast.success('Prompt wurde aus Template/Library neu berechnet')
  }

  // Reset State wenn Dialog geschlossen wird
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetGeneration()
      if (!isGenerating) {
        onOpenChange(false)
      }
    } else {
      onOpenChange(true)
    }
  }

  const handleGenerate = (variantCount: 1 | 4 = 4) =>
    generate(prompt, size, quality, variantCount)

  const handleSelectImage = (index: number) => selectImage(index)

  // Konvertiere Base64 zu Data URL für Anzeige
  const getImageUrl = (image: GeneratedImage): string => {
    const base64Data = image.image_base64.replace(/^data:image\/[a-z]+;base64,/, '')
    return `data:image/${image.image_format};base64,${base64Data}`
  }

  // Größe-Labels benutzerfreundlicher
  const sizeLabels: Record<string, string> = {
    '1024x1024': 'Quadrat',
    '1792x1024': 'Landschaft',
    '1024x1792': 'Hochformat'
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coverbild generieren</DialogTitle>
          <DialogDescription>
            Beschreiben Sie Ihr gewünschtes Bild. Wir generieren 4 Varianten zur Auswahl.
          </DialogDescription>
        </DialogHeader>

        {generatedImages.length === 0 ? (
          // Schritt 1: Prompt-Eingabe und Generierung
          <div className="space-y-4 py-4">
            {/* Informative Anzeige: Quelle des Prompts */}
            {promptSource && (
              <Collapsible>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <Info className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Prompt-Quelle: <strong>{SOURCE_LABELS[promptSource]}</strong></span>
                  {originalPrompt && (
                    <CollapsibleTrigger className="ml-auto text-primary hover:underline">
                      Vorlage anzeigen
                    </CollapsibleTrigger>
                  )}
                </div>
                {originalPrompt && (
                  <CollapsibleContent>
                    <div className="mt-2 p-2 bg-muted/30 rounded border text-xs font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {originalPrompt}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt">Was soll auf dem Bild zu sehen sein? *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRecalculatePrompt}
                  disabled={isGenerating}
                  title="Prompt aus Template/Library neu berechnen"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Neu berechnen
                </Button>
              </div>
              <Textarea
                id="prompt"
                placeholder="z.B. Ein modernes Bürogebäude bei Sonnenuntergang"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                className="w-full text-base min-h-[100px]"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="size">Format</Label>
                <Select value={size} onValueChange={(v) => setSize(v as typeof size)} disabled={isGenerating}>
                  <SelectTrigger id="size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024x1024">{sizeLabels['1024x1024']}</SelectItem>
                    <SelectItem value="1792x1024">{sizeLabels['1792x1024']}</SelectItem>
                    <SelectItem value="1024x1792">{sizeLabels['1024x1792']}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quality">Qualität</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as typeof quality)} disabled={isGenerating}>
                  <SelectTrigger id="quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="hd">HD (höhere Qualität)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          // Schritt 2: Bildauswahl (sowohl für 1 als auch für mehrere Bilder)
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              {generatedImages.length === 1 
                ? 'Ihr Bild wurde generiert. Klicken Sie darauf, um es zu verwenden:'
                : 'Wählen Sie das Bild aus, das Sie verwenden möchten:'}
            </div>
            
            <div className={cn(
              "grid gap-4",
              generatedImages.length === 1 ? "grid-cols-1 max-w-md mx-auto" : "grid-cols-2"
            )}>
              {generatedImages.map((image, index) => {
                const imageUrl = getImageUrl(image)
                const isSelected = selectedImageIndex === index
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all",
                      isSelected ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border hover:border-primary/50"
                    )}
                    onClick={() => handleSelectImage(index)}
                  >
                    <img
                      src={imageUrl}
                      alt={generatedImages.length === 1 ? 'Generiertes Bild' : `Variante ${index + 1}`}
                      className="w-full h-auto object-contain bg-muted"
                      style={{ aspectRatio: '1/1', maxHeight: '300px' }}
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    {generatedImages.length > 1 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 text-center">
                        Variante {index + 1}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-xs text-muted-foreground text-center">
              {generatedImages.length === 1 
                ? 'Klicken Sie auf das Bild, um es zu speichern'
                : 'Klicken Sie auf ein Bild, um es auszuwählen und zu speichern'}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isGenerating}
          >
            {generatedImages.length > 0 ? 'Abbrechen' : 'Schließen'}
          </Button>
          {generatedImages.length === 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleGenerate(1)}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generiere...
                  </>
                ) : (
                  'Nur ein Bild generieren'
                )}
              </Button>
              <Button
                onClick={() => handleGenerate(4)}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generiere 4 Varianten...
                  </>
                ) : (
                  '4 Varianten generieren'
                )}
              </Button>
            </>
          )}
          {generatedImages.length > 0 && selectedImageIndex !== null && generatedImages.length > 1 && (
            <Button
              onClick={() => handleSelectImage(selectedImageIndex)}
              disabled={selectedImageIndex === null}
            >
              Ausgewähltes Bild verwenden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
