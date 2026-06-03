import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, buildFilterFromQuery } from '@/lib/chat/dynamic-facets'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
import { findDocs, findDocsGrouped, getCollectionNameForLibrary, getCollectionOnly, type GallerySort } from '@/lib/repositories/vector-repo'
import { maybePublicationFilter } from '@/lib/chat/publication-filter'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import type { Document } from 'mongodb'

/**
 * Parsed den `?sort`-URL-Param und liefert das passende MongoDB-Sort-Objekt.
 *
 * - `sort=stars` -> `{ favoriteCount: -1, year: -1, upsertedAt: -1 }`
 *   (favoriteCount kommt durch den $lookup in vector-repo)
 * - `sort=rating` -> `{ 'docMetaJson.prioritaets_index': -1, year: -1, upsertedAt: -1 }`
 *   (persistierter Prioritäts-Indikator; fehlend/null sortiert in MongoDB-desc ans Ende)
 * - alles andere / fehlend -> Default `{ year: -1, upsertedAt: -1 }`
 *
 * Member-only: nur Owner und Co-Creators duerfen `sort=stars` nutzen.
 * Anonyme/Guest-User bekommen den Default-Sort, damit der Endpoint keine
 * weichen Privilege-Escalations zulaesst. `sort=rating` ist dagegen
 * oeffentlich (keine privilegierten Daten — die Bewertung ist Teil des
 * veroeffentlichten Dokuments).
 */
function buildGallerySort(rawSort: string | null, isMember: boolean): GallerySort {
  if (rawSort === 'stars' && isMember) {
    return { favoriteCount: -1, year: -1, upsertedAt: -1 }
  }
  if (rawSort === 'rating') {
    return { 'docMetaJson.prioritaets_index': -1, year: -1, upsertedAt: -1 }
  }
  return { year: -1, upsertedAt: -1 }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { libraryId } = await params
    
    // Rate-Limiting-Schutz: Versuche auth() und currentUser() mit Fehlerbehandlung
    let userId: string | null = null
    let userEmail = ''
    
    try {
      const authResult = await auth()
      userId = authResult.userId || null
      
      if (userId) {
        const user = await currentUser()
        // Normalisierte Variante (lower-case, getrimmt). Wird ans Repo durchgereicht
        // und als Voter-Match-Schluessel im $lookup genutzt.
        userEmail = getPreferredUserEmail(user)
      }
    } catch (authError) {
      // Rate Limit Error: Loggen aber nicht abbrechen (für öffentliche Libraries)
      const isRateLimit = authError && typeof authError === 'object' && 'status' in authError && authError.status === 429
      if (isRateLimit) {
        console.warn('[API] Clerk Rate Limit beim Laden der Dokumente, versuche ohne Auth fortzufahren')
        // Für öffentliche Libraries können wir ohne Auth fortfahren
      } else {
        // Andere Auth-Fehler: Weiterwerfen
        throw authError
      }
    }

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(req.url)
    const defs = parseFacetDefs(ctx.library)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    
    // PERFORMANCE: Index-Erstellung zur Laufzeit entfernen
    // await ensureFacetIndexes(libraryKey, defs)
    const builtin = buildFilterFromQuery(url, defs)
    // buildFilterFromQuery liefert normalisierte Filter-Form; auf MongoDB-Form abbilden
    // Verwende Utility-Funktion für shortTitle-Mapping zu docMetaJson.shortTitle
    const filter = facetsSelectedToMongoFilter(builtin)
    
    // Unterstütze auch dynamische Facettenfelder (z.B. event, track, speakers aus Session-Daten)
    // Die Utility-Funktion behandelt bereits alle Facetten, aber wir stellen sicher,
    // dass alle Facetten aus builtin enthalten sind (falls sie nicht bereits durch facetsSelectedToMongoFilter behandelt wurden)
    for (const def of defs) {
      if (builtin[def.metaKey] && !filter[def.metaKey]) {
        // Konvertiere zu MongoDB-Format falls nötig
        const value = builtin[def.metaKey]
        if (Array.isArray(value)) {
          filter[def.metaKey] = { $in: value }
        } else {
          filter[def.metaKey] = value
        }
      }
    }

    // Prüfe, ob Image-URLs mitgeladen werden sollen (für Kompatibilität)
    const includeImageUrls = url.searchParams.get('includeImageUrls') === 'true'
    
    // Pagination params (flache Liste)
    const limitParam = url.searchParams.get('limit')
    const skipParam = url.searchParams.get('skip')
    const limit = limitParam ? parseInt(limitParam, 10) : 50 // Default auf 50 für bessere Performance
    const skip = skipParam ? parseInt(skipParam, 10) : 0

    // Gruppenweise Pagination (fließendes Scrollen bei Gruppierung nach Handlungsfeld etc.)
    const groupByParam = url.searchParams.get('groupBy')
    const groupOffsetParam = url.searchParams.get('groupOffset')
    const groupsLimitParam = url.searchParams.get('groupsLimit')
    const useGrouped =
      typeof groupByParam === 'string' &&
      groupByParam.length > 0 &&
      groupByParam !== 'none' &&
      typeof groupOffsetParam === 'string' &&
      typeof groupsLimitParam === 'string'
    const groupOffset = useGrouped ? Math.max(0, parseInt(groupOffsetParam, 10) || 0) : 0
    const groupsLimit = useGrouped ? Math.min(50, Math.max(1, parseInt(groupsLimitParam, 10) || 5)) : 5

    // Search param - Dynamisch in allen String/String[] Facetten suchen
    const search = url.searchParams.get('search')
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' }
      const searchFields: Array<Record<string, unknown>> = [
        { title: searchRegex },
        { shortTitle: searchRegex },
        { 'docMetaJson.title': searchRegex }, // Auch in docMetaJson suchen
        { 'docMetaJson.shortTitle': searchRegex }
      ]
      
      // Füge alle String/String[] Facetten dynamisch zur Suche hinzu
      for (const def of defs) {
        if (def.type === 'string' || def.type === 'string[]') {
          searchFields.push({ [def.metaKey]: searchRegex })
          searchFields.push({ [`docMetaJson.${def.metaKey}`]: searchRegex })
        } else if (def.type === 'number' || def.type === 'integer-range') {
          // Zahl-Facetten (z. B. massnahme_nr) durchsuchbar machen — egal ob als
          // Zahl oder String gespeichert: Wert per $toString in Text wandeln und
          // gegen die (Teilstring-)Suche matchen. Sonst findet die Freitextsuche
          // z. B. eine Maßnahmennummer nie (Regex greift nicht auf Number-Feldern).
          searchFields.push({
            $expr: {
              $regexMatch: {
                input: { $toString: { $ifNull: [`$docMetaJson.${def.metaKey}`, ''] } },
                regex: search,
                options: 'i',
              },
            },
          })
        }
      }
      
      filter.$or = searchFields
    }

    // Doc-Publication: Owner/Moderatoren sehen alle Dokumente, anonyme und
    // nicht-Owner sehen nur Dokumente ohne `publication.status = 'draft'`.
    // Bestandsdokumente OHNE das Feld bleiben sichtbar (lax/backwards-compatible).
    const pubFilter = await maybePublicationFilter(libraryId, userEmail || null)
    if (pubFilter) Object.assign(filter, pubFilter)

    // Locale fuer Doc-Translations:
    //   1. `x-locale`-Header (durch middleware.ts gesetzt)
    //   2. Fallback aus library.config.translations.fallbackLocale
    //   3. Default 'en'
    // Wird an die Repository-Funktionen weitergereicht, damit dort die
    // Mongo-Projection fuer `docMetaJson.translations.gallery.<locale>` greift.
    const headerLocale = req.headers.get('x-locale') || undefined
    const fallbackLocale = ctx.library.config?.translations?.fallbackLocale || 'en'

    // Sterne sind Member-only: Counts/Voter werden nur Mitgliedern (Owner +
    // aktive Co-Creator) angezeigt. Fuer alle anderen reichen wir keinen
    // userEmail durch -> der $lookup laeuft trotzdem (Counts sind Lookup-
    // unabhaengig), aber `isFavorite` ist immer false.
    const isMember = userEmail ? await isCoCreatorOrOwner(libraryId, userEmail) : false
    const sortRaw = url.searchParams.get('sort')
    const memberUserEmail = isMember ? userEmail : ''

    // Bei gruppenweiser Pagination: findDocsGrouped nutzen, sonst klassische findDocs
    if (useGrouped) {
      const groupedResult = await findDocsGrouped(libraryKey, libraryId, filter, {
        groupBy: groupByParam,
        groupOffset,
        groupsLimit,
        sortWithinGroup: buildGallerySort(sortRaw, isMember),
        locale: headerLocale,
        fallbackLocale,
        userEmail: memberUserEmail,
      })
      return NextResponse.json(
        { 
          groups: groupedResult.groups, 
          totalGroups: groupedResult.totalGroups,
          // Gesamtzahl aller Dokumente (unabhängig von Pagination) für korrekte Anzeige
          total: groupedResult.totalDocs,
        },
        { status: 200 }
      )
    }

    const result = await findDocs(libraryKey, libraryId, filter, {
      limit,
      skip,
      sort: buildGallerySort(sortRaw, isMember),
      locale: headerLocale,
      fallbackLocale,
      userEmail: memberUserEmail,
    })
    
    // Wenn includeImageUrls=true, lade Image-URLs für alle Dokumente
    // Ansonsten werden sie lazy-loaded über die separate Route
    if (includeImageUrls) {
      const col = await getCollectionOnly(libraryKey)
      const itemsWithImages = await Promise.all(
        result.items.map(async (item) => {
          if (!item.fileId) return item
          
          const doc = await col.findOne(
            { _id: `${item.fileId}-meta`, kind: 'meta' } as Partial<Document>,
            {
              projection: {
                _id: 0,
                speakers_image_url: 1,
                'docMetaJson.speakers_image_url': 1,
              }
            }
          )
          
          if (!doc) return item
          
          const toStrArr = (val: unknown): string[] | undefined => {
            if (Array.isArray(val)) {
              return val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            }
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val)
                return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : undefined
              } catch {
                return undefined
              }
            }
            return undefined
          }
          
          const docMeta = doc.docMetaJson && typeof doc.docMetaJson === 'object' 
            ? doc.docMetaJson as Record<string, unknown> 
            : undefined
          
          const speakersImageUrlTopLevel = toStrArr(doc.speakers_image_url)
          const speakersImageUrlDocMeta = docMeta ? toStrArr(docMeta.speakers_image_url) : undefined
          const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta || []
          
          return { ...item, speakers_image_url: speakersImageUrl.length > 0 ? speakersImageUrl : undefined }
        })
      )
      
      return NextResponse.json({ items: itemsWithImages, total: result.total }, { status: 200 })
    }
    
    return NextResponse.json({ items: result.items, total: result.total }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


