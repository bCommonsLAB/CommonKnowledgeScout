# Audit 03 — Welche Requests braucht das Embed?

> M5, Schritt Basis-URL (Vorhaben 1 AECED). Messung am 2026-09-10 auf
> `master` c12339a1, gelesen bis in die Route-Handler und `src/middleware.ts`.
> Grundlage fuer Schritt 4 (Huelle, CORS): Welche Routen muessen anonym und
> ueber Herkunftsgrenzen hinweg antworten, welche nie?

## Ergebnis

Im Paket `@ks/module-explorer` standen **43 `fetch`-Aufrufe** (39 unter
`gallery/`, 4 unter `react/`). Seit M5 laufen alle ueber die Instanz
(`InstanceApi` aus `@ks/api-client`): in der Galerie `useInstanz()`, im
Explorer-Eintritt die Prop `instanz`. In der Voll-App ist das
`SAME_ORIGIN_API` (relative Pfade wie bisher), im Embed die zentrale Instanz.
`tests/unit/packages/module-explorer/instanz-fetch.test.ts` verbietet jedes
nackte `fetch` im Paket.

| Sorte | Anzahl | Was damit passiert |
|---|---:|---|
| Lesen, braucht das anonyme Embed | 12 | laeuft ueber die Basis-URL; fuer AECED zaehlen davon 4 bis 7 (unten A) |
| Lesen, nur angemeldet sinnvoll | 7 | laeuft ueber die Basis-URL, feuert fuer den anonymen Betrachter nicht |
| Schreiben / Verwalten | 21 | laeuft ueber die Basis-URL, Bedienelemente nur fuer Owner/Mitglieder |
| tot (`gallery/lib/api.ts`) | 3 | Datei geloescht, niemand importierte sie |

## A. Was das anonyme Embed fuer AECED braucht

AECED-Inhalte sind `book` in der Galerie, ohne Story und Chat.

| Request | Zweck | anonym? | Fuer Schritt 4 |
|---|---|---|---|
| `GET /api/public/libraries/{slug}` | Einstieg (`use-explorer-library.ts`) | ja, 403 wenn nicht oeffentlich | kein Gate; `slug` wird nicht URL-kodiert |
| `GET /api/chat/{lib}/docs` | Liste, Gruppen, Sortierung (`use-gallery-data.ts`) | ja (`explorerGate` + `isPublic`) | einfacher GET, kein Preflight |
| `GET /api/chat/{lib}/facets` | Filter (`use-gallery-facets.ts`) | ja | kein Preflight |
| `GET /api/chat/{lib}/doc-meta` | Detailansicht (`detail-overlay.tsx`) | ja; Entwuerfe kommen als `exists:false` | sendet `x-locale` → Preflight, obwohl der Server ihn nicht liest |
| `GET /api/chat/{lib}/docs?aggregate=sums` | Tabellen-Fusszeile | ja | nur in der Tabellenansicht |
| `GET /api/chat/{lib}/docs?limit=200…` | Graph, ganzer Bestand | ja | nur im Graph-Modus |
| `POST /api/library/{lib}/doc-relations` | Graph-Kanten, Quelle A | ja (kein Gate) | JSON-Body → Preflight; nur im Graph-Modus |

Die uebrigen fuenf Lese-Requests fuer das Embed sind Story/Chat (`queries/{id}`
zweimal mit `X-Session-ID`, `docs/by-fileids`) und DIVA-Cover
(`resolve-binary-url`, `sibling-files`). Beide Gruppen sind nicht AECED; die
DIVA-Routen und `docs/by-fileids` antworten anonym heute ohnehin nicht (siehe
Befunde).

## B. Nur angemeldet sinnvoll (7)

Kommentar-Zaehler und -Thread, eigene Sterne (bulk und Favoritenfilter),
Synergie-/Hebel-Bericht, Zugriffspruefung (`access-check`, fuer Anonyme immer
„kein Zugriff"), Member-Sicht (`explore-by-slug`). Alle feuern nur hinter
`isSignedIn`, `isMember` bzw. `requiresAuth`.

## C. Schreiben und Verwalten (21)

Loeschen (einzeln und Stapel), Veroeffentlichen (einzeln und Stapel),
Beziehungen und Aehnlichkeit neu berechnen, Berichte neu berechnen,
Graph-Standard speichern, Kommentare schreiben/aendern/loeschen, Sterne setzen,
Zugriff anfragen, DIVA-Klassifizierung (Material korrigieren,
Stoffgruppe propagieren). Der Server lehnt alle ohne Anmeldung ab.

**Korrigiert in M5:** Die DIVA-Klassifizierung (Menue auf der Karte,
Korrektur-Dialog, „Gruppe propagieren", „Alle Gruppen propagieren") hatte
keine Rollenpruefung und erschien auch anonym. Sie haengt jetzt an `isMember`
(`diva-texture-card.tsx`, `items-grid.tsx`); `document-card.test.tsx` prueft
beide Richtungen. Alle anderen Schreib-Aktionen standen schon hinter
`isOwner`/`isMember`/`isSignedIn`.

## Befunde fuer Schritt 4 (Huelle, CORS)

Laut Messung, dort vor dem Bauen gegenzupruefen. **Stand 2026-09-10
(M5-cors):** 1 bis 3 erledigt (`src/lib/embed/embed-cors.ts`, Preflight in
der Middleware vor der Anmeldung); 4 zur Haelfte — `x-locale` ist entfernt,
die Sprache schickt die Huelle als `Accept-Language`.

1. Es gibt nirgends `Access-Control-*`-Header (`src`, `packages`, `next.config`).
2. Die anonymen Ausnahmen in `src/middleware.ts` gelten fuer GET/POST/DELETE,
   nicht fuer `OPTIONS` — ein Preflight laeuft in `auth.protect()`.
3. Preflight-Ausloeser: `x-locale` (doc-meta), `Content-Type: application/json`
   (doc-relations), `X-Session-ID` (queries, nur Story/Chat).
4. `x-locale` wirkt nicht: die Middleware ueberschreibt den Header, `doc-meta`
   liest ihn nicht. Die Sprache kommt aus dem `locale`-Cookie oder
   `Accept-Language` — und das Cookie geht bei einem Aufruf von fremder
   Herkunft nicht mit. Im Embed muss die Locale ausdruecklich mit.
5. `explorerGate` antwortet 404, wenn das Explorer-Modul fuer den Host nicht
   aktiv ist. Beim Embed zaehlt der Host der Instanz, nicht der von AECED.
6. `docs/by-fileids`: Der Handler kann anonym, die Middleware-Regel deckt die
   Route nicht — anonym 404 (nur Story/Chat).
7. Cover-URLs kommen roh aus der Datenbank: meist absolute Azure-URLs,
   moeglich sind aber relative `/api/storage/streaming-url…` und nackte
   Dateinamen (Nicht-Azure-Libraries, Altbestand). `streaming-url` verlangt
   eine Anmeldung. Fuer die AECED-Library messen, welche Form sie hat.
8. `/sdg-icons/*.png` ist ein relativer Pfad (`sdgIconPath` aus `@ks/util`)
   und bricht auf einem fremden Host. Betrifft Klimamassnahmen, nicht AECED.
   Nicht umgestellt: `SdgProfile` rendert auch ausserhalb der Galerie (in der
   Klimamassnahmen-Detailansicht im Archiv), dort gibt es keinen Gastgeber.
9. Die anonyme Sitzungs-ID liegt im `localStorage` — im Embed ist das der
   Speicher der fremden Herkunft.

## Befund ausserhalb von M5

`useLibraryRole` nimmt `accessRole ?? 'owner'`, und `ExplorerRoot` schreibt die
angezeigte oeffentliche Library in den Libraries-Atom, ohne `accessRole` zu
setzen. Folge: Ein **angemeldeter** fremder Besucher auf `/explore/{slug}` gilt
in der Oberflaeche als Owner und sieht Verwaltungs-Bedienelemente; der Server
lehnt die Aktionen ab. Fuer das anonyme Embed ohne Wirkung. Eingetragen im
Vorrat von `docs/STAND.md`.
