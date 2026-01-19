import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getSecretaryConfig } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'

/**
 * Proxy-Route für Secretary Service Text2Image API
 * 
 * Generiert ein Bild aus einem Text-Prompt über den Secretary Service.
 * Die API-Key bleibt serverseitig, der Client ruft nur diesen Proxy-Endpunkt auf.
 * 
 * Request-Body:
 * - prompt: string (required)
 * - size?: string (default: "1024x1024")
 * - quality?: "standard" | "hd" (default: "standard")
 * - n?: number (default: 1)
 * - seed?: number (optional, für einzelnes Bild)
 * - seeds?: number[] (optional, für mehrere Bilder mit expliziten Seeds)
 * - useCache?: boolean (default: true)
 * 
 * Response (n=1):
 * - image_base64: string
 * - image_format: string (z.B. "png")
 * - size: string
 * - model?: string
 * - prompt?: string
 * - seed?: number | null
 * - error?: { code: string; message: string }
 * 
 * Response (n>1 oder seeds):
 * - images: Array<{ image_base64: string, image_format: string, size: string, seed: number | null }>
 * - error?: { code: string; message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    }

    // Request-Body parsen
    const body = await request.json().catch(() => ({}))
    const { prompt, size = '1024x1024', quality = 'standard', n = 1, seed, seeds, useCache = true } = body as {
      prompt?: string
      size?: string
      quality?: 'standard' | 'hd'
      n?: number
      seed?: number
      seeds?: number[]
      useCache?: boolean
    }

    // Validierung
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt darf nicht leer sein', code: 'MISSING_PROMPT' },
        { status: 400 }
      )
    }

    // Secretary Service Konfiguration laden
    const { baseUrl, apiKey } = getSecretaryConfig()
    if (!baseUrl) {
      FileLogger.error('text2image', 'SECRETARY_SERVICE_URL nicht konfiguriert')
      return NextResponse.json(
        { error: 'Secretary Service nicht konfiguriert', code: 'PROVIDER_NOT_CONFIGURED' },
        { status: 500 }
      )
    }
    if (!apiKey) {
      FileLogger.error('text2image', 'SECRETARY_SERVICE_API_KEY nicht konfiguriert')
      return NextResponse.json(
        { error: 'Secretary Service API-Key nicht konfiguriert', code: 'PROVIDER_NOT_CONFIGURED' },
        { status: 500 }
      )
    }

    // URL zusammenbauen: baseUrl enthält bereits /api, daher nur /text2image/generate anhängen
    const url = `${baseUrl}/text2image/generate`

    FileLogger.info('text2image', 'Rufe Secretary Service auf', {
      url,
      prompt: prompt.substring(0, 100),
      size,
      quality,
      n,
      hasSeed: seed !== undefined,
      hasSeeds: seeds !== undefined && Array.isArray(seeds),
      seedsCount: seeds?.length,
      useCache
    })

    // Request an Secretary Service senden
    const requestBody: Record<string, unknown> = {
      prompt: prompt.trim(),
      size,
      quality,
      n,
      useCache
    }
    
    // Seeds-Array hat Priorität über einzelnes Seed
    if (seeds !== undefined && Array.isArray(seeds) && seeds.length > 0) {
      requestBody.seeds = seeds
    } else if (seed !== undefined) {
      requestBody.seed = seed
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Secretary-Api-Key': apiKey
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      timeoutMs: 240000 // 4 Minuten Timeout für Bildgenerierung (mehrere Bilder können länger dauern)
    })

    if (!response.ok) {
      const errorText = await response.text()
      FileLogger.error('text2image', 'Secretary Service Fehler', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500)
      })

      // Versuche strukturierte Fehlerantwort zu parsen
      let errorData: { error?: { code?: string; message?: string } } = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // Ignoriere Parse-Fehler
      }

      return NextResponse.json(
        {
          error: errorData.error?.message || `Secretary Service Fehler: ${response.statusText}`,
          code: errorData.error?.code || 'TEXT2IMAGE_ERROR'
        },
        { status: response.status }
      )
    }

    const data = await response.json() as {
      status: string
      data?: {
        image_base64?: string
        image_format?: string
        size?: string
        model?: string
        prompt?: string
        seed?: number | null
        images?: Array<{
          image_base64: string
          image_format: string
          size: string
          seed: number | null
        }>
      }
      error?: { code: string; message: string }
      process?: {
        id: string
        duration?: number | null
        llm_info?: {
          total_cost?: number
          total_tokens?: number
        }
      }
    }

    // Prüfe auf Fehler in der Response
    if (data.status === 'error' || data.error) {
      FileLogger.error('text2image', 'Secretary Service Fehler in Response', {
        error: data.error
      })
      return NextResponse.json(
        {
          error: data.error?.message || 'Unbekannter Fehler bei der Bildgenerierung',
          code: data.error?.code || 'TEXT2IMAGE_ERROR'
        },
        { status: 500 }
      )
    }

    // Prüfe, ob mehrere Bilder angefordert wurden
    const multipleImagesRequested = n > 1 || (seeds && Array.isArray(seeds) && seeds.length > 0)
    
    // Wenn mehrere Bilder angefordert wurden
    if (multipleImagesRequested) {
      if (data.data?.images && Array.isArray(data.data.images) && data.data.images.length > 0) {
        FileLogger.info('text2image', 'Mehrere Bilder erfolgreich generiert', {
          count: data.data.images.length,
          requested: n,
          seedsCount: seeds?.length,
          processId: data.process?.id,
          cost: data.process?.llm_info?.total_cost,
          duration: data.process?.duration
        })

        return NextResponse.json({
          images: data.data.images.map(img => ({
            image_base64: img.image_base64,
            image_format: img.image_format,
            size: img.size,
            seed: img.seed
          })),
          process: data.process ? {
            id: data.process.id,
            duration: data.process.duration,
            cost: data.process.llm_info?.total_cost
          } : undefined
        })
      } else {
        // Mehrere Bilder angefordert, aber Response enthält kein images Array
        FileLogger.error('text2image', 'Mehrere Bilder angefordert, aber Response enthält kein images Array', {
          requested: n,
          seedsCount: seeds?.length,
          hasData: !!data.data,
          hasImages: !!data.data?.images,
          imagesIsArray: Array.isArray(data.data?.images),
          imagesLength: data.data?.images?.length,
          hasImageBase64: !!data.data?.image_base64
        })
        return NextResponse.json(
          { 
            error: 'Mehrere Bilder angefordert, aber Response enthält kein images Array', 
            code: 'INVALID_RESPONSE',
            requested: n,
            seedsCount: seeds?.length
          },
          { status: 500 }
        )
      }
    }

    // Einzelnes Bild (n=1 oder kein seeds Array)
    if (!data.data || !data.data.image_base64 || !data.data.image_format) {
      FileLogger.error('text2image', 'Ungültige Response-Struktur für einzelnes Bild', {
        hasData: !!data.data,
        hasImageBase64: !!data.data?.image_base64,
        hasImageFormat: !!data.data?.image_format,
        hasImages: !!data.data?.images,
        imagesLength: data.data?.images?.length
      })
      return NextResponse.json(
        { error: 'Ungültige Response vom Secretary Service', code: 'INVALID_RESPONSE' },
        { status: 500 }
      )
    }

    FileLogger.info('text2image', 'Bild erfolgreich generiert', {
      size: data.data.size,
      format: data.data.image_format,
      model: data.data.model,
      processId: data.process?.id,
      cost: data.process?.llm_info?.total_cost,
      duration: data.process?.duration
    })

    return NextResponse.json({
      image_base64: data.data.image_base64,
      image_format: data.data.image_format,
      size: data.data.size,
      model: data.data.model,
      prompt: data.data.prompt,
      seed: data.data.seed,
      process: data.process ? {
        id: data.process.id,
        duration: data.process.duration,
        cost: data.process.llm_info?.total_cost
      } : undefined
    })
  } catch (error) {
    FileLogger.error('text2image', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // Prüfe auf Timeout-Fehler
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Timeout bei der Bildgenerierung (max. 2 Minuten)', code: 'TIMEOUT' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Interner Fehler bei der Bildgenerierung', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
