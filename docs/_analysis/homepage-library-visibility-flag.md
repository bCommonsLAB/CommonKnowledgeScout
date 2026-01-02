# Analyse: Flag „Show on Homepage“ für öffentliche Libraries

## Kontext / Problem
Aktuell werden alle Libraries, die als `publicPublishing.isPublic === true` konfiguriert sind und einen `slugName` besitzen, automatisch auf der Homepage in der Library-Liste angezeigt (via `/api/public/libraries`). Es fehlt ein separates Steuerelement, um eine Library zwar **öffentlich über ihren Slug** erreichbar zu machen, aber **nicht** in der Homepage-Liste zu zeigen.

Das gewünschte Verhalten ist: Eine Library kann öffentlich sein (über `/explore/[slug]` erreichbar), aber **optional** aus der Homepage-Kachelübersicht ausgeschlossen werden. Diese Entscheidung soll in den Public-Settings unterhalb des Slugs als Flag konfigurierbar sein.

## Lösungsvarianten (3)

### Variante A (empfohlen): Neues Feld `publicPublishing.showOnHomepage`
- **Idee**: Ergänze in `publicPublishing` ein boolesches Feld `showOnHomepage` (Default: `true`).
- **Homepage**: `/api/public/libraries` liefert nur Libraries mit `isPublic === true`, gültigem `slugName` und `showOnHomepage !== false` (d.h. fehlend gilt als `true` für Backwards-Compatibility).
- **Slug-Zugriff**: `/api/public/libraries/[slug]` bleibt nur von `isPublic` abhängig; `showOnHomepage` beeinflusst die Erreichbarkeit **nicht**.
- **Pro**: Minimal-invasive Änderung, konsistente Konfiguration an einem Ort, klare Semantik, rückwärtskompatibel.
- **Contra**: Erweiterung der Datenstruktur; ggf. Index-Erweiterung in MongoDB sinnvoll.

### Variante B: Separates Top-Level Feld an der Library (z.B. `library.showOnHomepage`)
- **Idee**: Flag nicht unter `publicPublishing`, sondern als eigenes Feld direkt an `Library`.
- **Pro**: Strikte Trennung: „öffentlich“ vs. „Homepage-Sichtbarkeit“.
- **Contra**: Mehr Refactor (Schema + Mappings), semantisch enger an Public-Publishing gekoppelt als an die Library insgesamt.

### Variante C: Ableitung ohne Persistenz (z.B. nur per Slug/Name-Regeln)
- **Idee**: Homepage zeigt nur Libraries, die bestimmte Kriterien erfüllen (z.B. Tag/Prefix im Slug).
- **Pro**: Keine Datenbankänderung.
- **Contra**: Nicht UX-freundlich, schlecht wartbar, keine explizite Benutzerkontrolle, fehleranfällig.

## Entscheidung
**Variante A** wird umgesetzt, weil sie die gewünschte UX mit minimalen Änderungen ermöglicht und bestehendes Verhalten nicht bricht (Default `true` bei fehlendem Feld).

## Betroffene Dateien (geplant)
- `src/types/library.ts` (Typen: `publicPublishing.showOnHomepage`)
- `src/components/settings/public-form.tsx` (UI-Flag + Submit)
- `src/app/api/libraries/[id]/public/route.ts` (PUT: Persistierung)
- `src/lib/services/library-service.ts` (Client-Mapping + optional DB-Filter/Index)
- `src/app/api/public/libraries/route.ts` (Homepage-Liste: Filterung)
- `tests/unit/...` (Unit-Test für Default-Logik)









