"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { UILogger } from '@/lib/debug/logger'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoverImageGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (file: File) => Promise<void>
  defaultPrompt?: string
}

interface GeneratedImage {
  image_base64: string
  image_format: string
  size: string
  seed?: number | null
}

/**
 * Dialog zum Generieren eines Coverbildes über den Secretary Service Text2Image Endpoint.
 * 
 * Generiert standardmäßig 4 Varianten gleichzeitig, die der Benutzer auswählen kann.
 * Die UI ist benutzerfreundlich gestaltet mit weniger technischen Details.
 */
export function CoverImageGeneratorDialog({
  open,
  onOpenChange,
  onGenerated,
  defaultPrompt = ''
}: CoverImageGeneratorDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  // Reset State wenn Dialog geöffnet wird
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset beim Schließen
      setGeneratedImages([])
      setSelectedImageIndex(null)
      if (!isGenerating) {
        onOpenChange(false)
      }
    } else {
      onOpenChange(true)
    }
  }

  const handleGenerate = async (variantCount: 1 | 4 = 4) => {
    if (!prompt || prompt.trim().length === 0) {
      toast.error('Bitte beschreiben Sie das gewünschte Bild')
      return
    }

    setIsGenerating(true)
    setGeneratedImages([])
    setSelectedImageIndex(null)
    
    try {
      UILogger.info('CoverImageGeneratorDialog', `Starte Bildgenerierung (${variantCount} ${variantCount === 1 ? 'Variante' : 'Varianten'})`, {
        prompt: prompt.substring(0, 100),
        size,
        quality,
        variantCount
      })

      // Generiere Varianten
      const requestBody: Record<string, unknown> = {
        prompt: prompt.trim(),
        size,
        quality,
        useCache: variantCount === 1 // Bei Einzelbild Cache aktivieren für schnelleres Ergebnis
      }

      if (variantCount === 4) {
        // 4 Varianten mit unterschiedlichen Seeds
        const seeds = [101, 102, 103, 104]
        requestBody.n = 4
        requestBody.seeds = seeds
        requestBody.useCache = false // Bei Varianten-Generierung Cache deaktivieren für unterschiedliche Ergebnisse
      } else {
        // Einzelnes Bild
        requestBody.n = 1
      }

      const response = await fetch('/api/secretary/text2image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        UILogger.error('CoverImageGeneratorDialog', 'Fehler bei Bildgenerierung', {
          status: response.status,
          error: errorMessage,
          code: errorData.code
        })
        toast.error(`Fehler: ${errorMessage}`)
        return
      }

      const data = await response.json() as {
        images?: GeneratedImage[]
        image_base64?: string
        image_format?: string
        size?: string
        error?: { code: string; message: string }
      }

      if (data.error) {
        UILogger.error('CoverImageGeneratorDialog', 'Fehler in Response', {
          error: data.error
        })
        toast.error(`Fehler: ${data.error.message}`)
        return
      }

      // Wenn mehrere Bilder vorhanden sind
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        setGeneratedImages(data.images)
        UILogger.info('CoverImageGeneratorDialog', `${data.images.length} Varianten erfolgreich generiert`, {
          count: data.images.length
        })
        return
      }

      // Fallback: Einzelnes Bild (für Abwärtskompatibilität oder n=1)
      if (data.image_base64 && data.image_format) {
        const singleImage: GeneratedImage = {
          image_base64: data.image_base64,
          image_format: data.image_format,
          size: data.size || '1024x1024'
        }
        setGeneratedImages([singleImage])
        
        // Bei Einzelbild direkt auswählen und speichern
        if (variantCount === 1) {
          UILogger.info('CoverImageGeneratorDialog', 'Einzelbild generiert, wird automatisch gespeichert')
          // Automatisch das einzige Bild auswählen und speichern
          setSelectedImageIndex(0)
          // Kurze Verzögerung für visuelles Feedback, dann speichern
          setTimeout(async () => {
            await handleSelectImage(0)
          }, 500)
        } else {
          // Bei mehreren Varianten, aber nur ein Bild zurückgekommen: trotzdem anzeigen
          setSelectedImageIndex(null)
        }
        return
      }

      toast.error('Ungültige Response vom Server')
    } catch (error) {
      UILogger.error('CoverImageGeneratorDialog', 'Unerwarteter Fehler', error)
      toast.error('Fehler beim Generieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelectImage = async (index: number) => {
    if (index < 0 || index >= generatedImages.length) return

    const selectedImage = generatedImages[index]
    setSelectedImageIndex(index)

    try {
      // Konvertiere Base64 zu Blob/File
      const base64Data = selectedImage.image_base64.replace(/^data:image\/[a-z]+;base64,/, '')
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Erstelle Blob und dann File-Objekt
      const mimeType = `image/${selectedImage.image_format}`
      const blob = new Blob([bytes], { type: mimeType })
      
      // Dateiname: cover_generated.png (überschreibt bewusst vorherige Generierungen)
      const fileName = `cover_generated.${selectedImage.image_format}`
      const file = new File([blob], fileName, { type: mimeType })

      UILogger.info('CoverImageGeneratorDialog', 'Bild ausgewählt und wird gespeichert', {
        fileName,
        size: file.size,
        format: selectedImage.image_format,
        index
      })

      // Übergebe File an Callback
      await onGenerated(file)

      toast.success('Bild erfolgreich gespeichert')
      handleOpenChange(false)
    } catch (error) {
      UILogger.error('CoverImageGeneratorDialog', 'Fehler beim Speichern des ausgewählten Bildes', error)
      toast.error('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      handleOpenChange(false)
    }
  }

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
            <div className="space-y-2">
              <Label htmlFor="prompt">Was soll auf dem Bild zu sehen sein? *</Label>
              <Input
                id="prompt"
                placeholder="z.B. Ein modernes Bürogebäude bei Sonnenuntergang"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                className="w-full text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating && prompt.trim()) {
                    handleGenerate(4) // Standard: 4 Varianten bei Enter
                  }
                }}
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
          // Schritt 2: Bildauswahl
          <div className="space-y-4 py-4">
            {generatedImages.length === 1 ? (
              <div className="text-sm text-muted-foreground text-center">
                Ihr Bild wurde generiert und wird gespeichert...
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  Wählen Sie das Bild aus, das Sie verwenden möchten:
                </div>
                
                <div className={cn(
                  "grid gap-4",
                  generatedImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
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
                          alt={`Variante ${index + 1}`}
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
                  Klicken Sie auf ein Bild, um es auszuwählen und zu speichern
                </div>
              </>
            )}
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
