/**
 * Analyse-Skript für Galerie-Datenmengen
 * 
 * Analysiert die Datenmengen, die beim Laden der Galerieansicht
 * in den Client geladen werden.
 */

// Verwende native fetch (Node.js 18+)

interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  speakers?: string[]
  speakers_image_url?: string[]
  year?: number | string
  track?: string
  date?: string
  region?: string
  upsertedAt?: string
  slug?: string
  [key: string]: unknown
}

interface ApiResponse {
  items: DocCardMeta[]
}

/**
 * Formatiert Bytes in lesbare Größe
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Analysiert die Datenmenge einer API-Response
 */
function analyzeData(data: ApiResponse): void {
  const jsonString = JSON.stringify(data)
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8')
  const sizeGzipped = estimateGzipSize(jsonString)
  
  console.log('\n=== Datenanalyse ===')
  console.log(`Anzahl Dokumente: ${data.items.length}`)
  console.log(`JSON-Größe (uncompressed): ${formatBytes(sizeBytes)}`)
  console.log(`Geschätzte Größe (gzip): ${formatBytes(sizeGzipped)}`)
  
  // Analysiere durchschnittliche Größe pro Dokument
  if (data.items.length > 0) {
    const avgSizePerDoc = sizeBytes / data.items.length
    console.log(`Durchschnittliche Größe pro Dokument: ${formatBytes(avgSizePerDoc)}`)
    
    // Analysiere größte Felder
    const fieldSizes = new Map<string, number>()
    data.items.forEach(item => {
      Object.entries(item).forEach(([key, value]) => {
        const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf8')
        fieldSizes.set(key, (fieldSizes.get(key) || 0) + valueSize)
      })
    })
    
    console.log('\n=== Top 10 größte Felder (Gesamtgröße) ===')
    const sortedFields = Array.from(fieldSizes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    sortedFields.forEach(([field, totalSize]) => {
      const avgSize = totalSize / data.items.length
      console.log(`${field}: ${formatBytes(totalSize)} (Ø ${formatBytes(avgSize)} pro Dokument)`)
    })
    
    // Analysiere spezifische Felder
    console.log('\n=== Feld-Analyse ===')
    const speakersCount = data.items.filter(d => d.speakers && d.speakers.length > 0).length
    const authorsCount = data.items.filter(d => d.authors && d.authors.length > 0).length
    const speakersImageCount = data.items.filter(d => d.speakers_image_url && d.speakers_image_url.length > 0).length
    
    console.log(`Dokumente mit Speakers: ${speakersCount} (${(speakersCount / data.items.length * 100).toFixed(1)}%)`)
    console.log(`Dokumente mit Authors: ${authorsCount} (${(authorsCount / data.items.length * 100).toFixed(1)}%)`)
    console.log(`Dokumente mit Speaker-Images: ${speakersImageCount} (${(speakersImageCount / data.items.length * 100).toFixed(1)}%)`)
    
    // Analysiere durchschnittliche Anzahl von Arrays
    const avgSpeakers = data.items.reduce((sum, d) => sum + (d.speakers?.length || 0), 0) / data.items.length
    const avgAuthors = data.items.reduce((sum, d) => sum + (d.authors?.length || 0), 0) / data.items.length
    const avgSpeakerImages = data.items.reduce((sum, d) => sum + (d.speakers_image_url?.length || 0), 0) / data.items.length
    
    console.log(`\nDurchschnittliche Anzahl:`)
    console.log(`  Speakers: ${avgSpeakers.toFixed(2)}`)
    console.log(`  Authors: ${avgAuthors.toFixed(2)}`)
    console.log(`  Speaker-Images: ${avgSpeakerImages.toFixed(2)}`)
  }
}

/**
 * Schätzt die gzip-komprimierte Größe
 * (vereinfachte Schätzung: ~30% der Originalgröße für JSON)
 */
function estimateGzipSize(jsonString: string): number {
  // Gzip-Komprimierung reduziert JSON typischerweise um ~70-80%
  // Wir verwenden eine konservative Schätzung von 30% der Originalgröße
  return Math.floor(Buffer.byteLength(jsonString, 'utf8') * 0.3)
}

/**
 * Hauptfunktion
 */
async function main() {
  const libraryId = process.argv[2] || '97eee164-e3d0-4986-9024-01ea03a74b12'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  console.log(`Analysiere Galerie-Daten für Library: ${libraryId}`)
  console.log(`API-URL: ${baseUrl}/api/chat/${libraryId}/docs`)
  
  try {
    // Lade Dokumente
    const docsResponse = await fetch(`${baseUrl}/api/chat/${libraryId}/docs`)
    if (!docsResponse.ok) {
      throw new Error(`API-Fehler: ${docsResponse.status} ${docsResponse.statusText}`)
    }
    
    const docsData = await docsResponse.json() as ApiResponse
    analyzeData(docsData)
    
    // Lade auch Facetten-Daten
    console.log('\n\n=== Facetten-Analyse ===')
    const facetsResponse = await fetch(`${baseUrl}/api/chat/${libraryId}/facets`)
    let facetsData: unknown = null
    let facetsSizeBytes = 0
    
    if (facetsResponse.ok) {
      facetsData = await facetsResponse.json()
      const facetsJsonString = JSON.stringify(facetsData)
      facetsSizeBytes = Buffer.byteLength(facetsJsonString, 'utf8')
      console.log(`Facetten-Größe (uncompressed): ${formatBytes(facetsSizeBytes)}`)
      console.log(`Geschätzte Größe (gzip): ${formatBytes(estimateGzipSize(facetsJsonString))}`)
    }
    
    // Gesamtübersicht
    console.log('\n\n=== Gesamtübersicht ===')
    const totalDocsSize = Buffer.byteLength(JSON.stringify(docsData), 'utf8')
    const totalSize = totalDocsSize + facetsSizeBytes
    
    console.log(`Gesamt-Datenmenge (uncompressed): ${formatBytes(totalSize)}`)
    console.log(`Gesamt-Datenmenge (gzip geschätzt): ${formatBytes(estimateGzipSize(JSON.stringify(docsData)) + (facetsData ? estimateGzipSize(JSON.stringify(facetsData)) : 0))}`)
    
  } catch (error) {
    console.error('Fehler beim Analysieren:', error)
    process.exit(1)
  }
}

// Führe Skript aus
if (require.main === module) {
  void main()
}

