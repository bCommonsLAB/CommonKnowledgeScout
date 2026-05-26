# API-Route-Konventionen (Next.js App Router)

> Konvention fuer Route-Handler unter `src/app/api/**/route.ts`. Ergaenzt die
> Kurzregeln in `.cursorrules` (Abschnitt „Next.js 13+ App Router Regeln") um den
> tatsaechlich im Repo gelebten End-to-End-Aufbau.

## Standard-Aufbau eines Handlers

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }, // nur bei dyn. Segmenten
): Promise<NextResponse> {
  try {
    // 1. Auth
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    // 2. Dynamische Params awaiten (Next 13+ Pflicht)
    const { libraryId } = await params

    // 3. Eingaben validieren (Query / Body)
    // 4. Business-Logik (LibraryService, StorageProvider, Repo …)
    // 5. Antwort
    return NextResponse.json(result)
  } catch (error) {
    FileLogger.error('route-scope', 'Beschreibung', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
```

## Regeln

- **Auth**: immer `auth()` (Clerk) fuer das Gate; `currentUser()` fuer die
  **User-Email**. Im Datenzugriff wird die **Email** verwendet, nicht die
  Clerk-User-ID (projektweite Konvention, siehe `.cursorrules`).
- **Dynamische Params**: als `Promise<{…}>` typisieren und **awaiten**.
- **Status-Codes**: `401` (nicht eingeloggt), `400` (fehlende/ungueltige Eingabe),
  `404` (Ressource/kein Zugriff), `500` (unerwarteter Fehler).
- **Antwort-Shape**: immer `NextResponse.json(...)`. Fehler als
  `{ error: string }`. Keine sensiblen Daten (Tokens/Secrets) zurueckgeben.
- **Fehler-Logging**: jeder `catch` loggt ueber `FileLogger` (`src/lib/debug/logger.ts`)
  mit einem Scope-String; **kein** leeres `catch {}`.
- **Zugriffspruefung auf Library**: ueber `LibraryService.getInstance().getLibrary(email, libraryId)`
  (null ⇒ `404`) oder `getServerProvider(email, libraryId)` (wenn ohnehin ein
  Provider gebraucht wird).

## Referenz-Implementierungen

- Query-basiert (kein dyn. Segment): `src/app/api/diva-texture/supplier-data/route.ts`
- Dynamisches Segment + GET/PATCH + Zugriffspruefung:
  `src/app/api/library/[libraryId]/archive-item-properties/route.ts`
