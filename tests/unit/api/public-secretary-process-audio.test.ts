import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/public/secretary/process-audio/route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/public/public-library-owner', () => ({
  resolveOwnerForTestimonials: vi.fn(),
}))

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

vi.mock('@/lib/markdown/frontmatter', () => ({
  parseFrontmatter: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  getSecretaryConfig: vi.fn(() => ({
    baseUrl: 'http://secretary-service.test',
    apiKey: 'test-key',
  })),
}))

describe('POST /api/public/secretary/process-audio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sollte 400 zurückgeben, wenn libraryId fehlt', async () => {
    const formData = new FormData()
    formData.append('eventFileId', 'event-123')
    formData.append('file', new File(['audio'], 'test.webm', { type: 'audio/webm' }))

    const req = new NextRequest('http://localhost/api/public/secretary/process-audio', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('libraryId')
  })

  it('sollte 400 zurückgeben, wenn eventFileId fehlt', async () => {
    const formData = new FormData()
    formData.append('libraryId', 'lib-123')
    formData.append('file', new File(['audio'], 'test.webm', { type: 'audio/webm' }))

    const req = new NextRequest('http://localhost/api/public/secretary/process-audio', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('eventFileId')
  })

  it('sollte 400 zurückgeben, wenn file fehlt', async () => {
    const formData = new FormData()
    formData.append('libraryId', 'lib-123')
    formData.append('eventFileId', 'event-123')

    const req = new NextRequest('http://localhost/api/public/secretary/process-audio', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Audio-Datei fehlt')
  })

  it('sollte 413 zurückgeben, wenn Datei zu groß ist', async () => {
    const formData = new FormData()
    formData.append('libraryId', 'lib-123')
    formData.append('eventFileId', 'event-123')
    // Erstelle eine große Datei (26MB)
    const largeBlob = new Blob([new ArrayBuffer(26 * 1024 * 1024)])
    formData.append('file', new File([largeBlob], 'large.webm', { type: 'audio/webm' }))

    const req = new NextRequest('http://localhost/api/public/secretary/process-audio', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toContain('zu groß')
  })

  it('sollte 400 zurückgeben, wenn Datei leer ist', async () => {
    const formData = new FormData()
    formData.append('libraryId', 'lib-123')
    formData.append('eventFileId', 'event-123')
    formData.append('file', new File([], 'empty.webm', { type: 'audio/webm' }))

    const req = new NextRequest('http://localhost/api/public/secretary/process-audio', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Leere Datei')
  })
})
