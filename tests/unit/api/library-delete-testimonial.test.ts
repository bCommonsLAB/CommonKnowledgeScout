import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('@/lib/repositories/library-members-repo', () => ({
  isModeratorOrOwner: vi.fn(),
}))

vi.mock('@/lib/auth/user-email', () => ({
  getPreferredUserEmail: vi.fn(),
}))

vi.mock('@/lib/public/public-library-owner', () => ({
  resolveOwnerForTestimonials: vi.fn(),
}))

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

vi.mock('@/lib/markdown/frontmatter', () => ({
  parseFrontmatter: vi.fn(),
}))

describe('DELETE /api/library/[libraryId]/events/testimonials/[testimonialId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null })

    const { DELETE } = await import('@/app/api/library/[libraryId]/events/testimonials/[testimonialId]/route')
    const req = new NextRequest('http://localhost/api/library/lib-1/events/testimonials/t-1?eventFileId=e-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ libraryId: 'lib-1', testimonialId: 't-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not owner/moderator', async () => {
    const { auth, currentUser } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-1' })
    ;(currentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ emailAddresses: [{ emailAddress: 'u@example.com' }] })

    const { getPreferredUserEmail } = await import('@/lib/auth/user-email')
    ;(getPreferredUserEmail as unknown as ReturnType<typeof vi.fn>).mockReturnValue('u@example.com')

    const { isModeratorOrOwner } = await import('@/lib/repositories/library-members-repo')
    ;(isModeratorOrOwner as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { DELETE } = await import('@/app/api/library/[libraryId]/events/testimonials/[testimonialId]/route')
    const req = new NextRequest('http://localhost/api/library/lib-1/events/testimonials/t-1?eventFileId=e-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ libraryId: 'lib-1', testimonialId: 't-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 when eventFileId is missing', async () => {
    const { auth, currentUser } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-1' })
    ;(currentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ emailAddresses: [{ emailAddress: 'u@example.com' }] })

    const { getPreferredUserEmail } = await import('@/lib/auth/user-email')
    ;(getPreferredUserEmail as unknown as ReturnType<typeof vi.fn>).mockReturnValue('u@example.com')

    const { isModeratorOrOwner } = await import('@/lib/repositories/library-members-repo')
    ;(isModeratorOrOwner as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { DELETE } = await import('@/app/api/library/[libraryId]/events/testimonials/[testimonialId]/route')
    const req = new NextRequest('http://localhost/api/library/lib-1/events/testimonials/t-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ libraryId: 'lib-1', testimonialId: 't-1' }) })
    expect(res.status).toBe(400)
  })
})

