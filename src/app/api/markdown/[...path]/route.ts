import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route Handler für Markdown-Dateien
 * Serviert Markdown-Dateien aus public/docs/footer
 * 
 * Unterstützt verschiedene Deployment-Umgebungen:
 * - Lokale Entwicklung: process.cwd() zeigt auf Projekt-Root
 * - Docker/Produktion: process.cwd() zeigt auf /app
 * - Standalone Build: möglicherweise andere Pfade
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    
    // Baue den Pfad zusammen
    const filePath = pathSegments.join('/')
    
    // Sicherheitscheck: Nur Dateien aus docs/footer erlauben
    if (!filePath.startsWith('footer/')) {
      return new NextResponse('Not found', { status: 404 })
    }
    
    // Entferne 'footer/' Präfix für den tatsächlichen Dateipfad
    const relativePath = filePath.replace('footer/', '')
    
    // Mögliche Pfade, die in verschiedenen Umgebungen funktionieren
    const possiblePaths = [
      // Standard: public/docs/footer relativ zu process.cwd()
      join(process.cwd(), 'public', 'docs', 'footer', relativePath),
      // Fallback: absoluter Pfad mit resolve
      resolve(process.cwd(), 'public', 'docs', 'footer', relativePath),
      // Für Standalone Builds: möglicherweise im .next/standalone/public
      join(process.cwd(), '.next', 'standalone', 'public', 'docs', 'footer', relativePath),
    ]
    
    // Finde den ersten existierenden Pfad
    let fullPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        fullPath = path
        break
      }
    }
    
    // Wenn kein Pfad gefunden wurde, verwende den Standard-Pfad für Fehlerbehandlung
    if (!fullPath) {
      fullPath = join(process.cwd(), 'public', 'docs', 'footer', relativePath)
    }
    
    // Sicherheitscheck: Stelle sicher, dass der Pfad innerhalb von public/docs/footer liegt
    // Normalisiere beide Pfade für den Vergleich (behandelt .. und . korrekt)
    const resolvedBasePath = resolve(process.cwd(), 'public', 'docs', 'footer')
    const resolvedFullPath = resolve(fullPath)
    
    if (!resolvedFullPath.startsWith(resolvedBasePath)) {
      // Zusätzlicher Check für Standalone-Builds
      const standaloneBasePath = resolve(process.cwd(), '.next', 'standalone', 'public', 'docs', 'footer')
      if (!resolvedFullPath.startsWith(standaloneBasePath)) {
        return new NextResponse('Not found', { status: 404 })
      }
    }
    
    // Prüfe, ob die Datei existiert, bevor wir sie lesen
    if (!existsSync(fullPath)) {
      // Minimales Logging nur bei kritischen Fehlern
      console.error(`Markdown file not found: ${fullPath} (cwd: ${process.cwd()})`)
      return new NextResponse('Markdown file not found', { status: 404 })
    }
    
    // Datei lesen
    const content = await readFile(fullPath, 'utf-8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    // Minimales Logging (nur bei Fehlern)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Markdown file error: ${errorMessage}`)
    return new NextResponse('Markdown file not found', { status: 404 })
  }
}



