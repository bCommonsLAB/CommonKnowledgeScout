/**
 * @fileoverview Secretary Session Processing API Route - Session Import Endpoint
 * 
 * @description
 * API endpoint for processing session data via Secretary Service. Proxies session
 * processing requests to Secretary Service for event/session data extraction and
 * transformation. Handles structured session data with event, session, speakers,
 * and metadata information.
 * 
 * @module secretary
 * 
 * @exports
 * - POST: Processes session data via Secretary Service
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/secretary/session/process
 * - src/components/event-monitor: Event monitor components call this endpoint
 * - src/lib/session: Session processing modules call this endpoint
 * 
 * @dependencies
 * - @/lib/env: Environment helpers for Secretary config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecretaryConfig } from '@/lib/env';

// POST /api/secretary/session/process
// Proxy zum Secretary-Service: /api/session/process
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Pflichtfelder prüfen (minimal)
    const required = ['event', 'session', 'url', 'filename', 'track'];
    for (const key of required) {
      if (!body?.[key]) {
        return NextResponse.json({ status: 'error', error: { code: 'MISSING_FIELD', message: `Erforderliches Feld "${key}" fehlt` } }, { status: 400 });
      }
    }

    const { baseUrl, apiKey } = getSecretaryConfig();
    const apiUrl = `${baseUrl}/session/process`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Secretary-Api-Key'] = apiKey;
      headers['X-Secretary-Api-Key'] = apiKey;
    }

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ status: 'error', error: { code: 'SECRETARY_ERROR', message: data?.error?.message || resp.statusText, details: data?.error || data } }, { status: resp.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/secretary/session/process] Fehler:', error);
    return NextResponse.json({ status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler beim Weiterleiten zu Secretary' } }, { status: 500 });
  }
}



