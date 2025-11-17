import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route Handler für Markdown-Dateien
 * Serviert Markdown-Dateien aus public/docs/footer
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
    
    const fullPath = join(process.cwd(), 'public', 'docs', 'footer', relativePath)
    
    // Sicherheitscheck: Stelle sicher, dass der Pfad innerhalb von public/docs/footer liegt
    const resolvedPath = join(process.cwd(), 'public', 'docs', 'footer')
    if (!fullPath.startsWith(resolvedPath)) {
      return new NextResponse('Not found', { status: 404 })
    }
    
    const content = await readFile(fullPath, 'utf-8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error serving markdown file:', error)
    return new NextResponse('Markdown file not found', { status: 404 })
  }
}

