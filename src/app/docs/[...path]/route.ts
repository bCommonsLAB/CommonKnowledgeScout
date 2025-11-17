import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Route Handler für /docs/* (alle Dokumentationsseiten)
 * Serviert die statischen HTML-Dateien aus public/docs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    
    // Baue den Pfad zusammen
    let filePath = pathSegments.join('/')
    
    // Wenn leer, dann index.html
    if (!filePath) {
      filePath = 'index.html'
    }
    
    // Wenn keine Dateiendung, füge .html hinzu
    if (!filePath.includes('.')) {
      filePath = filePath + '.html'
    }
    
    // Wenn der Pfad mit / endet, füge index.html hinzu
    if (filePath.endsWith('/')) {
      filePath = filePath + 'index.html'
    }
    
    const fullPath = join(process.cwd(), 'public', 'docs', filePath)
    const content = await readFile(fullPath, 'utf-8')
    
    // Passe relative Pfade an (nur für HTML-Dateien)
    if (filePath.endsWith('.html')) {
      const basePath = '/docs/'
      const adjustedContent = content
        .replace(/href="([^"]+)"/g, (match, href) => {
          // Ignoriere absolute URLs und URLs die bereits mit / beginnen
          if (href.startsWith('http') || href.startsWith('//') || href.startsWith('/')) {
            return match
          }
          // Relative Pfade anpassen
          return `href="${basePath}${href}"`
        })
        .replace(/src="([^"]+)"/g, (match, src) => {
          if (src.startsWith('http') || src.startsWith('//') || src.startsWith('/')) {
            return match
          }
          return `src="${basePath}${src}"`
        })
      
      return new NextResponse(adjustedContent, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }
    
    // Für andere Dateitypen (CSS, JS, Bilder, etc.) direkt servieren
    return new NextResponse(content, {
      headers: {
        'Content-Type': getContentType(filePath),
      },
    })
  } catch (error) {
    console.error('Error serving docs:', error)
    return new NextResponse('Documentation not found', { status: 404 })
  }
}

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
  }
  return contentTypes[ext || ''] || 'application/octet-stream'
}

