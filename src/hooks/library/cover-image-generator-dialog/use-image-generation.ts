'use client'

/**
 * src/hooks/library/cover-image-generator-dialog/use-image-generation.ts
 *
 * Hook fuer die Bild-Generierungs-Logik im CoverImageGeneratorDialog.
 *
 * Aus `cover-image-generator-dialog.tsx` ausgegliedert
 * (Welle 3-III-d, Schritt 1/3).
 *
 * Verantwortlichkeiten:
 * - State fuer generierte Bilder + Auswahl-Index
 * - Generation-State (isGenerating)
 * - API-Aufruf zum Secretary-Service text2image
 * - Base64 → File-Konvertierung beim Auswaehlen
 * - Reset-Logik (beim Schliessen / Re-Open)
 *
 * 1:1-portierte Logik aus Bestand — keine Verhaltensaenderung.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { UILogger } from '@/lib/debug/logger'

/** Generiertes Bild aus Secretary-Service text2image. */
export interface GeneratedImage {
  image_base64: string
  image_format: string
  size: string
  seed?: number | null
}

export type GenerationSize = '1024x1024' | '1792x1024' | '1024x1792'
export type GenerationQuality = 'standard' | 'hd'

export interface UseImageGenerationArgs {
  /** Callback nach Auswahl eines generierten Bildes (Komponente persistiert das File). */
  onGenerated: (file: File) => Promise<void>
  /** Callback um den Dialog zu schliessen (nach erfolgreichem Save). */
  onClose: () => void
}

export interface UseImageGenerationResult {
  /** Generation laeuft (Buttons disabled) */
  isGenerating: boolean
  /** Liste der generierten Bilder (1 oder 4 Varianten) */
  generatedImages: GeneratedImage[]
  /** Aktuell ausgewaehltes Bild (null = noch keine Auswahl) */
  selectedImageIndex: number | null
  /** Setter fuer selectedImageIndex (z.B. fuer Click-Handler vor Save) */
  setSelectedImageIndex: (idx: number | null) => void
  /** Reset von State (zum Schliessen oder Re-Open) */
  resetGeneration: () => void
  /**
   * Generiert Bilder via Secretary-API.
   * `variantCount=4` → 4 Varianten mit unterschiedlichen Seeds.
   * `variantCount=1` → Einzelbild mit Cache.
   */
  generate: (
    prompt: string,
    size: GenerationSize,
    quality: GenerationQuality,
    variantCount?: 1 | 4,
  ) => Promise<void>
  /**
   * Konvertiert ein generiertes Bild zu einem File-Objekt und ruft
   * `onGenerated` auf. Schliesst den Dialog bei Erfolg.
   */
  selectImage: (index: number) => Promise<void>
}

export function useImageGeneration(args: UseImageGenerationArgs): UseImageGenerationResult {
  const { onGenerated, onClose } = args

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  const resetGeneration = useCallback(() => {
    setGeneratedImages([])
    setSelectedImageIndex(null)
  }, [])

  const generate = useCallback(
    async (
      prompt: string,
      size: GenerationSize,
      quality: GenerationQuality,
      variantCount: 1 | 4 = 4,
    ) => {
      if (!prompt || prompt.trim().length === 0) {
        toast.error('Bitte beschreiben Sie das gewuenschte Bild')
        return
      }

      setIsGenerating(true)
      setGeneratedImages([])
      setSelectedImageIndex(null)

      try {
        UILogger.info(
          'useImageGeneration',
          `Starte Bildgenerierung (${variantCount} ${variantCount === 1 ? 'Variante' : 'Varianten'})`,
          {
            prompt: prompt.substring(0, 100),
            size,
            quality,
            variantCount,
          },
        )

        const requestBody: Record<string, unknown> = {
          prompt: prompt.trim(),
          size,
          quality,
          // Bei Einzelbild Cache aktivieren fuer schnelleres Ergebnis
          useCache: variantCount === 1,
        }

        if (variantCount === 4) {
          // 4 Varianten mit unterschiedlichen Seeds
          const seeds = [101, 102, 103, 104]
          requestBody.n = 4
          requestBody.seeds = seeds
          requestBody.useCache = false
        } else {
          requestBody.n = 1
        }

        const response = await fetch('/api/secretary/text2image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as {
            error?: string
            code?: string
          }
          const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
          UILogger.error('useImageGeneration', 'Fehler bei Bildgenerierung', {
            status: response.status,
            error: errorMessage,
            code: errorData.code,
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
          UILogger.error('useImageGeneration', 'Fehler in Response', { error: data.error })
          toast.error(`Fehler: ${data.error.message}`)
          return
        }

        // Wenn mehrere Bilder vorhanden sind
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          setGeneratedImages(data.images)
          UILogger.info('useImageGeneration', `${data.images.length} Varianten erfolgreich generiert`, {
            count: data.images.length,
          })
          return
        }

        // Fallback: Einzelnes Bild (fuer Abwaertskompatibilitaet oder n=1)
        if (data.image_base64 && data.image_format) {
          const singleImage: GeneratedImage = {
            image_base64: data.image_base64,
            image_format: data.image_format,
            size: data.size || '1024x1024',
          }
          setGeneratedImages([singleImage])
          UILogger.info('useImageGeneration', 'Einzelbild generiert, zeige zur Bestaetigung an')
          setSelectedImageIndex(null)
          return
        }

        toast.error('Ungueltige Response vom Server')
      } catch (error) {
        UILogger.error('useImageGeneration', 'Unerwarteter Fehler', error)
        toast.error('Fehler beim Generieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      } finally {
        setIsGenerating(false)
      }
    },
    [],
  )

  const selectImage = useCallback(
    async (index: number) => {
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

        // Dateiname mit Datum und Uhrzeit: cover_generated_YYYY-MM-DD_HH-MM-SS.png
        const now = new Date()
        const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').substring(0, 19)
        const fileName = `cover_generated_${dateStr}.${selectedImage.image_format}`
        const file = new File([blob], fileName, { type: mimeType })

        UILogger.info('useImageGeneration', 'Bild ausgewaehlt und wird gespeichert', {
          fileName,
          size: file.size,
          format: selectedImage.image_format,
          index,
        })

        await onGenerated(file)

        toast.success('Bild erfolgreich gespeichert')
        onClose()
      } catch (error) {
        UILogger.error('useImageGeneration', 'Fehler beim Speichern des ausgewaehlten Bildes', error)
        toast.error('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      }
    },
    [generatedImages, onGenerated, onClose],
  )

  return {
    isGenerating,
    generatedImages,
    selectedImageIndex,
    setSelectedImageIndex,
    resetGeneration,
    generate,
    selectImage,
  }
}
