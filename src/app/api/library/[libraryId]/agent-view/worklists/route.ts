/**
 * @fileoverview API-Route: Arbeitslisten der Werkbank (F7, Welle W6).
 *
 * @description
 * GET  /api/library/[libraryId]/agent-view/worklists → `{ lists }`
 * POST … Body `{ name, folders? }` → `{ list }` — `folders` ist die optionale
 * Start-Kopie (Seeding „Vorhaben mit status: aktiv" rechnet der CLIENT aus
 * seinem Report; die Route kennt den Report bewusst nicht — Buch 3 haengt
 * nicht am Wegwerf-Report). Benannte Fehler: 409 `name_vergeben`.
 * Listen sind privat je User (userEmail-scoped, F7).
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import {
  createWorklist,
  listWorklists,
  WorklistNameVergebenError,
  type WorklistFolderEntry,
} from '@/lib/repositories/agent-view-worklists-repo'
import { pruefeWorklistZugriff } from './worklists-zugriff'

/** Startmitglieder validieren — kaputte Eintraege sind ein 400, kein stilles Filtern. */
function parseFolders(value: unknown): Omit<WorklistFolderEntry, 'addedAt'>[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const eintraege: Omit<WorklistFolderEntry, 'addedAt'>[] = []
  for (const roh of value) {
    if (typeof roh !== 'object' || roh === null) return null
    const { folderId, pathSnapshot, name } = roh as Record<string, unknown>
    if (typeof folderId !== 'string' || folderId.trim() === '') return null
    if (typeof pathSnapshot !== 'string' || typeof name !== 'string') return null
    eintraege.push({ folderId, pathSnapshot, name })
  }
  return eintraege
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const zugriff = await pruefeWorklistZugriff(params)
    if (zugriff.fehler) return zugriff.fehler
    const lists = await listWorklists(zugriff.libraryId, zugriff.userEmail)
    return NextResponse.json({ lists })
  } catch (error) {
    FileLogger.error('agent-view-worklists', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const zugriff = await pruefeWorklistZugriff(params)
    if (zugriff.fehler) return zugriff.fehler

    const body = (await request.json().catch(() => null)) as { name?: unknown; folders?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name === '') return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
    const folders = parseFolders(body?.folders)
    if (folders === null) {
      return NextResponse.json(
        { error: 'folders muss eine Liste aus { folderId, pathSnapshot, name } sein' },
        { status: 400 },
      )
    }

    const addedAt = new Date().toISOString()
    const list = await createWorklist(
      zugriff.libraryId,
      zugriff.userEmail,
      name,
      folders.map((eintrag) => ({ ...eintrag, addedAt })),
    )
    return NextResponse.json({ list }, { status: 201 })
  } catch (error) {
    if (error instanceof WorklistNameVergebenError) {
      return NextResponse.json({ error: error.message, code: 'name_vergeben' }, { status: 409 })
    }
    FileLogger.error('agent-view-worklists', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
