import type { NextRequest } from 'next/server'

/**
 * Öffentliche Origin für 302-Location-Header bauen.
 * Hinter TLS-Terminator / Reverse-Proxy liefert `nextUrl.origin` oft `http://localhost:PORT`;
 * der Client müsste dann localhost laden → SSL-/Mixed-Content-Fehler.
 */
export function getRequestPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedHost) {
    const hostLower = forwardedHost.toLowerCase()
    const isLocal =
      hostLower.startsWith('localhost') ||
      hostLower.startsWith('127.') ||
      hostLower === '[::1]'
    const proto = forwardedProto || (isLocal ? 'http' : 'https')
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}
