import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * GET /api/libraries/[id]/public/check-slug
 * Prüft ob ein Slug-Name bereits verwendet wird
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug-Parameter fehlt' },
        { status: 400 }
      );
    }

    const libraryService = LibraryService.getInstance();
    const isTaken = await libraryService.isSlugNameTaken(slug, libraryId);

    return NextResponse.json({ available: !isTaken });
  } catch (error) {
    console.error('[API] Fehler beim Prüfen der Slug-Eindeutigkeit:', error);
    return NextResponse.json(
      { error: 'Fehler beim Prüfen der Slug-Eindeutigkeit' },
      { status: 500 }
    );
  }
}







