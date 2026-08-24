/**
 * @fileoverview API-Route: eine Arbeitsliste der Werkbank (F7, Welle W6).
 *
 * @description
 * PATCH  /api/library/[libraryId]/agent-view/worklists/[listId]
 *   Body `{ name? }` · `{ add?: { folderId, pathSnapshot, name } }` ·
 *   `{ remove?: folderId }` — genau EINE Operation pro Aufruf.
 *   Doppeltes Hinzufuegen/Entfernen ist idempotent und sagt das:
 *   `{ list, unchanged: true }`. Benannte Fehler: 404 unbekannte Liste,
 *   409 `name_vergeben`.
 * DELETE … → `{ deleted: true }`; Report und Archiv bleiben unberuehrt
 *   (Kreuztest der Buecher, Akzeptanzkriterium 2).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import {
  addFolderToWorklist,
  deleteWorklist,
  removeFolderFromWorklist,
  renameWorklist,
  WorklistNameVergebenError,
} from '@/lib/repositories/agent-view-worklists-repo'
import { pruefeWorklistZugriff } from '../worklists-zugriff'

type RouteParams = { params: Promise<{ libraryId: string; listId: string }> }

const NICHT_GEFUNDEN = () =>
  NextResponse.json({ error: 'Arbeitsliste nicht gefunden' }, { status: 404 })

interface PatchBody {
  name?: unknown
  add?: unknown
  remove?: unknown
}

function parseAdd(value: unknown): { folderId: string; pathSnapshot: string; name: string } | null {
  if (typeof value !== 'object' || value === null) return null
  const { folderId, pathSnapshot, name } = value as Record<string, unknown>
  if (typeof folderId !== 'string' || folderId.trim() === '') return null
  if (typeof pathSnapshot !== 'string' || typeof name !== 'string') return null
  return { folderId, pathSnapshot, name }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { listId } = await params
    const zugriff = await pruefeWorklistZugriff(
      params.then(({ libraryId }) => ({ libraryId })),
    )
    if (zugriff.fehler) return zugriff.fehler

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (body === null) return NextResponse.json({ error: 'JSON-Body erforderlich' }, { status: 400 })
    const operationen = ['name', 'add', 'remove'].filter((key) => body[key as keyof PatchBody] !== undefined)
    if (operationen.length !== 1) {
      return NextResponse.json(
        { error: 'Genau EINE Operation pro Aufruf: name ODER add ODER remove' },
        { status: 400 },
      )
    }

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (name === '') return NextResponse.json({ error: 'name darf nicht leer sein' }, { status: 400 })
      const list = await renameWorklist(zugriff.libraryId, zugriff.userEmail, listId, name)
      if (list === null) return NICHT_GEFUNDEN()
      return NextResponse.json({ list })
    }

    if (body.add !== undefined) {
      const eintrag = parseAdd(body.add)
      if (eintrag === null) {
        return NextResponse.json({ error: 'add braucht { folderId, pathSnapshot, name }' }, { status: 400 })
      }
      const ergebnis = await addFolderToWorklist(zugriff.libraryId, zugriff.userEmail, listId, eintrag)
      if (ergebnis === null) return NICHT_GEFUNDEN()
      return NextResponse.json(ergebnis)
    }

    const folderId = typeof body.remove === 'string' ? body.remove.trim() : ''
    if (folderId === '') return NextResponse.json({ error: 'remove braucht eine folderId' }, { status: 400 })
    const ergebnis = await removeFolderFromWorklist(zugriff.libraryId, zugriff.userEmail, listId, folderId)
    if (ergebnis === null) return NICHT_GEFUNDEN()
    return NextResponse.json(ergebnis)
  } catch (error) {
    if (error instanceof WorklistNameVergebenError) {
      return NextResponse.json({ error: error.message, code: 'name_vergeben' }, { status: 409 })
    }
    FileLogger.error('agent-view-worklists', 'PATCH fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { listId } = await params
    const zugriff = await pruefeWorklistZugriff(
      params.then(({ libraryId }) => ({ libraryId })),
    )
    if (zugriff.fehler) return zugriff.fehler
    const deleted = await deleteWorklist(zugriff.libraryId, zugriff.userEmail, listId)
    if (!deleted) return NICHT_GEFUNDEN()
    return NextResponse.json({ deleted: true })
  } catch (error) {
    FileLogger.error('agent-view-worklists', 'DELETE fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
