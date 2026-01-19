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

interface PreviewImage {
  image_base64: string
  image_format: string
  seed: number | null
  size: string
}

type WorkflowStep = 'prompt' | 'preview' | 'generating-final'

/**
 * Dialog zum Generieren eines Coverbildes über den Secretary Service Text2Image Endpoint.
 * 
 * Benutzerfreundlicher Workflow:
 * 1. Prompt eingeben → 4 Vorschaubilder in niedriger Auflösung generieren
 * 2. Eines der 4 Vorschaubilder auswählen
 * 3. Ausgewähltes Bild in höherer Auflösung mit Seed nochmal generieren
 */
export function CoverImageGeneratorDialog({
  open,
  onOpenChange,
  onGenerated,
  defaultPrompt = ''
}: CoverImageGeneratorDialogProps) {
  const [step, setStep] = useState<WorkflowStep>('prompt')
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [finalSize, setFinalSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024')
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([])
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null)
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false)
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false)

  // Schritt 1: Generiere 4 Vorschaubilder in niedriger Auflösung mit expliziten Seeds
  const handleGeneratePreviews = async () => {
    if (!prompt || prompt.trim().length === 0) {
      toast.error('Bitte geben Sie einen Prompt ein')
      return
    }

    setIsGeneratingPreviews(true)
    setPreviewImages([])
    setSelectedPreviewIndex(null)
    
    try {
      UILogger.info('CoverImageGeneratorDialog', 'Starte Vorschaubild-Generierung', {
        prompt: prompt.substring(0, 100),
        previewSize: '256x256',
        seeds: [101, 102, 103, 104]
      })

      // Generiere 4 Bilder in einem Request mit expliziten Seeds (niedrige Auflösung für schnelle Vorschau)
      const previewSize = '256x256' // Niedrige Auflösung für Vorschau
      const explicitSeeds = [101, 102, 103, 104] // Explizite Seeds für reproduzierbare Vorschaubilder
      
      const response = await fetch('/api/secretary/text2image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: previewSize,
          quality: 'standard',
          n: 4,
          seeds: explicitSeeds,
          useCache: false // Kein Cache für Vorschaubilder, damit wir verschiedene Varianten bekommen
        })
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          const errorText = await response.text()
          errorData = JSON.parse(errorText)
        } catch (parseError) {
          UILogger.error('CoverImageGeneratorDialog', 'Fehler beim Parsen der Fehlerantwort', {
            status: response.status,
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          })
        }
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        UILogger.error('CoverImageGeneratorDialog', 'Fehler bei Vorschaubild-Generierung', {
          status: response.status,
          error: errorMessage,
          code: errorData.code,
          errorData
        })
        toast.error(`Fehler: ${errorMessage}`)
        return
      }

      // Response-Body parsen mit besserer Fehlerbehandlung
      let data: {
        images?: Array<{
          image_base64: string
          image_format: string
          size: string
          seed: number | null
        }>
        image_base64?: string
        image_format?: string
        size?: string
        seed?: number | null
        error?: { code: string; message: string }
      }
      
      try {
        const responseText = await response.text()
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Leere Response vom Server')
        }
        data = JSON.parse(responseText)
      } catch (parseError) {
        UILogger.error('CoverImageGeneratorDialog', 'Fehler beim Parsen der Response', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          responseStatus: response.status,
          responseStatusText: response.statusText
        })
        toast.error('Fehler beim Verarbeiten der Server-Antwort')
        return
      }

      if (data.error) {
        UILogger.error('CoverImageGeneratorDialog', 'Fehler in Response', {
          error: data.error
        })
        toast.error(`Fehler: ${data.error.message}`)
        return
      }

      // Wenn images Array vorhanden ist (mehrere Bilder)
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const validPreviews = data.images.map(img => ({
          image_base64: img.image_base64,
          image_format: img.image_format,
          seed: img.seed,
          size: img.size
        } as PreviewImage))

        if (validPreviews.length < 4) {
          toast.warning(`${validPreviews.length} von 4 Vorschaubildern erfolgreich generiert`)
        }

        setPreviewImages(validPreviews)
        setStep('preview')
        toast.success(`${validPreviews.length} Vorschaubilder generiert`)
        return
      }

      // Fallback: Einzelnes Bild (für Rückwärtskompatibilität)
      if (data.image_base64 && data.image_format) {
        const singlePreview: PreviewImage = {
          image_base64: data.image_base64,
          image_format: data.image_format,
          seed: data.seed ?? null,
          size: data.size || previewSize
        }
        setPreviewImages([singlePreview])
        setStep('preview')
        toast.success('Vorschaubild generiert')
        return
      }

      // Wenn wir hier ankommen, haben wir weder images noch image_base64
      UILogger.error('CoverImageGeneratorDialog', 'Ungültige Response-Struktur', {
        hasImages: !!data.images,
        imagesLength: data.images?.length,
        hasImageBase64: !!data.image_base64,
        hasImageFormat: !!data.image_format,
        dataKeys: Object.keys(data)
      })
      toast.error('Ungültige Response vom Server')
    } catch (error) {
      // Verbesserte Fehlerbehandlung mit mehr Details
      const errorDetails = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : {
        error: String(error)
      }
      
      UILogger.error('CoverImageGeneratorDialog', 'Unerwarteter Fehler bei Vorschaubild-Generierung', {
        ...errorDetails,
        prompt: prompt?.substring(0, 50)
      })
      toast.error('Fehler beim Generieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setIsGeneratingPreviews(false)
    }
  }

  // Schritt 2: Generiere finales Bild in höherer Auflösung mit Seed
  const handleGenerateFinal = async () => {
    if (selectedPreviewIndex === null || !previewImages[selectedPreviewIndex]) {
      toast.error('Bitte wählen Sie ein Vorschaubild aus')
      return
    }

    const selectedPreview = previewImages[selectedPreviewIndex]
    // Warnung wenn kein Seed verfügbar ist, aber trotzdem fortfahren
    if (!selectedPreview.seed) {
      toast.warning('Hinweis: Kein Seed verfügbar. Das Bild wird neu generiert, kann aber leicht abweichen.')
    }

    setIsGeneratingFinal(true)
    setStep('generating-final')

    try {
      UILogger.info('CoverImageGeneratorDialog', 'Starte finale Bildgenerierung', {
        prompt: prompt.substring(0, 100),
        size: finalSize,
        seed: selectedPreview.seed
      })

      const response = await fetch('/api/secretary/text2image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: finalSize,
          quality: 'hd', // HD-Qualität für finales Bild
          n: 1,
          ...(selectedPreview.seed && { seed: selectedPreview.seed }), // Nur Seed übergeben wenn verfügbar
          useCache: false // Verwende Seed, nicht Cache
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        UILogger.error('CoverImageGeneratorDialog', 'Fehler bei finaler Bildgenerierung', {
          status: response.status,
          error: errorMessage,
          code: errorData.code
        })
        toast.error(`Fehler: ${errorMessage}`)
        setStep('preview')
        return
      }

      const data = await response.json() as {
        image_base64: string
        image_format: string
        size: string
        model?: string
        error?: { code: string; message: string }
      }

      if (data.error) {
        UILogger.error('CoverImageGeneratorDialog', 'Fehler in Response', {
          error: data.error
        })
        toast.error(`Fehler: ${data.error.message}`)
        setStep('preview')
        return
      }

      if (!data.image_base64 || !data.image_format) {
        UILogger.error('CoverImageGeneratorDialog', 'Ungültige Response', {
          hasImageBase64: !!data.image_base64,
          hasImageFormat: !!data.image_format
        })
        toast.error('Ungültige Response vom Server')
        setStep('preview')
        return
      }

      // Konvertiere Base64 zu Blob/File
      const base64Data = data.image_base64.replace(/^data:image\/[a-z]+;base64,/, '')
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const mimeType = `image/${data.image_format}`
      const blob = new Blob([bytes], { type: mimeType })
      
      // Timestamp für eindeutigen Dateinamen (verhindert Browser-Cache-Probleme)
      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19) // Format: YYYY-MM-DD_HH-MM-SS
      const fileName = `cover_generated_${timestamp}.${data.image_format}`
      const file = new File([blob], fileName, { type: mimeType })

      UILogger.info('CoverImageGeneratorDialog', 'Finales Bild erfolgreich generiert', {
        fileName,
        size: file.size,
        format: data.image_format,
        model: data.model
      })

      // Übergebe File an Callback
      await onGenerated(file)

      toast.success('Bild erfolgreich generiert und gespeichert')
      onOpenChange(false)
    } catch (error) {
      UILogger.error('CoverImageGeneratorDialog', 'Unerwarteter Fehler', error)
      toast.error('Fehler beim Generieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      setStep('preview')
    } finally {
      setIsGeneratingFinal(false)
    }
  }

  const handleClose = () => {
    if (!isGeneratingPreviews && !isGeneratingFinal) {
      // Reset State beim Schließen
      setStep('prompt')
      setPreviewImages([])
      setSelectedPreviewIndex(null)
      onOpenChange(false)
    }
  }

  const handleBackToPrompt = () => {
    setStep('prompt')
    setPreviewImages([])
    setSelectedPreviewIndex(null)
  }

  // Konvertiere Base64 zu Data URL für Anzeige
  const getImageDataUrl = (base64: string): string => {
    // Entferne data:image/...;base64, Präfix falls vorhanden
    const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '')
    return `data:image/png;base64,${base64Data}`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coverbild generieren</DialogTitle>
          <DialogDescription>
            {step === 'prompt' && 'Beschreiben Sie das gewünschte Bild. Wir generieren zunächst 4 Vorschaubilder für Sie.'}
            {step === 'preview' && 'Wählen Sie eines der Vorschaubilder aus, das Sie in höherer Auflösung generieren möchten.'}
            {step === 'generating-final' && 'Generiere finales Bild in höherer Auflösung...'}
          </DialogDescription>
        </DialogHeader>

        {step === 'prompt' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Beschreibung des Bildes *</Label>
              <Input
                id="prompt"
                placeholder="z.B. Ein modernes Bürogebäude bei Sonnenuntergang"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGeneratingPreviews}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Beschreiben Sie das gewünschte Bild in wenigen Worten.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalSize">Finale Bildgröße</Label>
              <Select value={finalSize} onValueChange={(v) => setFinalSize(v as typeof finalSize)} disabled={isGeneratingPreviews}>
                <SelectTrigger id="finalSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">1024×1024 (Quadrat)</SelectItem>
                  <SelectItem value="1792x1024">1792×1024 (Landschaft)</SelectItem>
                  <SelectItem value="1024x1792">1024×1792 (Hochformat)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Die finale Auflösung wird verwendet, nachdem Sie ein Vorschaubild ausgewählt haben.
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vorschaubilder</Label>
              <p className="text-xs text-muted-foreground">
                Wählen Sie eines der 4 Vorschaubilder aus, das Sie in höherer Auflösung generieren möchten.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {previewImages.map((preview, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedPreviewIndex(index)}
                  className={cn(
                    "relative border-2 rounded-lg overflow-hidden transition-all",
                    selectedPreviewIndex === index
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <img
                      src={getImageDataUrl(preview.image_base64)}
                      alt={`Vorschau ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {selectedPreviewIndex === index && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  <div className="p-2 text-xs text-center text-muted-foreground">
                    Variante {index + 1}
                  </div>
                </button>
              ))}
            </div>

            {previewImages.length < 4 && (
              <div className="text-xs text-muted-foreground text-center">
                {previewImages.length} von 4 Vorschaubildern erfolgreich generiert
              </div>
            )}
          </div>
        )}

        {step === 'generating-final' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Generiere finales Bild in höherer Auflösung...
                <br />
                Dies kann einen Moment dauern.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'prompt' && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isGeneratingPreviews}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleGeneratePreviews}
                disabled={isGeneratingPreviews || !prompt.trim()}
              >
                {isGeneratingPreviews ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generiere Vorschaubilder...
                  </>
                ) : (
                  '4 Vorschaubilder generieren'
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={handleBackToPrompt}
                disabled={isGeneratingFinal}
              >
                Zurück
              </Button>
              <Button
                onClick={handleGenerateFinal}
                disabled={isGeneratingFinal || selectedPreviewIndex === null}
              >
                {isGeneratingFinal ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generiere...
                  </>
                ) : (
                  'Finales Bild generieren'
                )}
              </Button>
            </>
          )}

          {step === 'generating-final' && (
            <div className="w-full text-center text-sm text-muted-foreground">
              Bitte warten...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
