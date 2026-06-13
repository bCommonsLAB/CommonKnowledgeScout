/**
 * @fileoverview Templates API Route - MongoDB Template Management
 * 
 * @description
 * API route handler for template CRUD operations in MongoDB.
 * Handles authentication and user email extraction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import {
  listTemplatesFromMongoDB,
  saveTemplateToMongoDB,
  updateTemplateInMongoDB,
  deleteTemplateFromMongoDB,
} from '@/lib/templates/template-service-mongodb'
import { TemplateRepository } from '@/lib/repositories/template-repo'
import {
  isBuiltinDefaultTemplateName,
  listBuiltinDefaultTemplates,
  toBuiltinTemplateDocument,
} from '@/lib/templates/default-templates'

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 */
async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) {
    return null
  }
  
  const user = await currentUser()
  if (!user?.emailAddresses?.length) {
    return null
  }
  
  return user.emailAddresses[0].emailAddress
}

/**
 * GET /api/templates
 * Lädt alle Templates einer Library
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const libraryId = searchParams.get('libraryId')
    
    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId ist erforderlich' },
        { status: 400 }
      )
    }

    // TODO: Admin-Check implementieren
    const isAdmin = false
    
    const templates = await listTemplatesFromMongoDB(libraryId, userEmail, isAdmin)

    // F11: Standard-Vorlagen (im Code persistiert) immer mitliefern —
    // zuerst in der Liste, mit builtin-Flag (read-only fuer Clients).
    // Namens-Kollisionen kann es nicht geben: POST/PUT/DELETE blocken
    // die reservierten Namen.
    const builtins = listBuiltinDefaultTemplates().map(t => ({
      ...toBuiltinTemplateDocument(t, libraryId),
      builtin: true,
    }))

    return NextResponse.json({ templates: [...builtins, ...templates] })
  } catch (error) {
    console.error('[API][Templates] Fehler beim Laden:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/templates
 * Erstellt ein neues Template
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, libraryId, metadata, systemprompt, markdownBody, creation } = body
    
    if (!name || !libraryId) {
      return NextResponse.json(
        { error: 'name und libraryId sind erforderlich' },
        { status: 400 }
      )
    }

    // F11: Reservierte Standard-Vorlagen-Namen sind nicht ueberschreibbar
    if (isBuiltinDefaultTemplateName(name)) {
      return NextResponse.json(
        { error: `"${name}" ist eine eingebaute Standard-Vorlage und kann nicht überschrieben werden` },
        { status: 409 }
      )
    }

    // Prüfe, ob Template bereits existiert
    const exists = await TemplateRepository.exists(name, libraryId)
    if (exists) {
      return NextResponse.json(
        { error: `Template "${name}" existiert bereits` },
        { status: 409 }
      )
    }

    const template = await saveTemplateToMongoDB({
      name,
      libraryId,
      user: userEmail,
      metadata: metadata || { fields: [], rawFrontmatter: '' },
      systemprompt: systemprompt || '',
      markdownBody: markdownBody || '',
      creation,
    })
    
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[API][Templates] Fehler beim Erstellen:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/templates
 * Aktualisiert ein bestehendes Template
 */
export async function PUT(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { templateId, libraryId, metadata, systemprompt, markdownBody, creation } = body
    
    if (!templateId || !libraryId) {
      return NextResponse.json(
        { error: 'templateId und libraryId sind erforderlich' },
        { status: 400 }
      )
    }

    // F11: Standard-Vorlagen sind read-only
    if (isBuiltinDefaultTemplateName(templateId) || String(templateId).startsWith('builtin:')) {
      return NextResponse.json(
        { error: 'Eingebaute Standard-Vorlagen können nicht bearbeitet werden' },
        { status: 409 }
      )
    }

    // TODO: Admin-Check implementieren
    const isAdmin = false

    const updates: Partial<{
      metadata: typeof metadata
      systemprompt: string
      markdownBody: string
      creation: typeof creation
    }> = {}
    
    if (metadata !== undefined) updates.metadata = metadata
    if (systemprompt !== undefined) updates.systemprompt = systemprompt
    if (markdownBody !== undefined) updates.markdownBody = markdownBody
    if (creation !== undefined) updates.creation = creation

    const template = await updateTemplateInMongoDB(
      templateId,
      libraryId,
      updates,
      userEmail,
      isAdmin
    )
    
    if (!template) {
      return NextResponse.json(
        {
          error: 'Template nicht gefunden oder keine Berechtigung',
          hint: 'Prüfe, ob templateId und libraryId korrekt sind. Bei älteren Templates kann ein Neuspeichern (Löschen + Neu anlegen) helfen.',
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[API][Templates] Fehler beim Aktualisieren:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/templates
 * Löscht ein Template
 */
export async function DELETE(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const templateId = searchParams.get('templateId')
    const libraryId = searchParams.get('libraryId')
    
    if (!templateId || !libraryId) {
      return NextResponse.json(
        { error: 'templateId und libraryId sind erforderlich' },
        { status: 400 }
      )
    }

    // F11: Standard-Vorlagen sind read-only
    if (isBuiltinDefaultTemplateName(templateId) || templateId.startsWith('builtin:')) {
      return NextResponse.json(
        { error: 'Eingebaute Standard-Vorlagen können nicht gelöscht werden' },
        { status: 409 }
      )
    }

    // TODO: Admin-Check implementieren
    const isAdmin = false

    const deleted = await deleteTemplateFromMongoDB(templateId, libraryId, userEmail, isAdmin)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Template nicht gefunden oder keine Berechtigung' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API][Templates] Fehler beim Löschen:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

