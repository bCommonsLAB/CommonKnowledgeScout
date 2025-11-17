import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

/**
 * Route Handler für /docs
 * Serviert die statische index.html aus public/docs
 */
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'docs', 'index.html')
    const content = await readFile(filePath, 'utf-8')
    
    // Passe relative Pfade an
    const basePath = '/docs/'
    const adjustedContent = content
      .replace(/href="([^"]+)"/g, (match, href) => {
        if (href.startsWith('http') || href.startsWith('//') || href.startsWith('/')) {
          return match
        }
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
  } catch (error) {
    console.error('Error serving docs:', error)
    return new NextResponse('Documentation not found', { status: 404 })
  }
}

