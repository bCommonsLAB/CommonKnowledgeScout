import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-static'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const cwd = process.cwd()
    // Versuche Standardpfad unter node_modules
    const candidatePaths = [
      path.join(cwd, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'),
      // pnpm verschachtelt; Fallback auf tiefere Struktur
      path.join(cwd, 'node_modules', '.pnpm', 'pdfjs-dist@4.10.38', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'),
    ]
    let content: string | null = null
    for (const p of candidatePaths) {
      try {
        const buf = await fs.readFile(p)
        content = buf.toString('utf-8')
        break
      } catch {}
    }
    if (!content) return new NextResponse('pdf.worker.mjs not found', { status: 404 })

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new NextResponse(`Failed to load pdf.worker.mjs: ${msg}`, { status: 500 })
  }
}


