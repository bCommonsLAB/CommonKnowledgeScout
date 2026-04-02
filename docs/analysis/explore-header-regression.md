## Problem

Beim direkten Aufruf von `/explore/[slug]` fehlt der globale Header mit Anmeldung und Sprachumschalter.
Das Verhalten trat nach einer Layout-Änderung auf und ist reproduzierbar.

## Betroffene Stelle

`src/components/layouts/app-layout.tsx`

Seit Commit `60c9167` wird die globale `TopNav` für Routen unter `/explore/[slug]` explizit ausgeblendet:

- `isExploreSlugPage = /^\/explore\/[^/]+/.test(pathname)`
- `!isExploreSlugPage && <TopNavWrapper />`

Dadurch bleiben nur seiteninterne Explore-Header sichtbar.

## Lösungsvarianten

### Variante 1: Globalen Header auf Explore wieder anzeigen

Vorteile:
- Kleinste Änderung
- Stellt das erwartete Verhalten direkt wieder her
- Keine zweite Header-Implementierung

Nachteile:
- Explore ist nicht mehr vollständig "standalone"

### Variante 2: Speziellen Public-Header für Explore bauen

Vorteile:
- Mehr Kontrolle über reduzierte Explore-Navigation
- Klare Trennung zwischen App- und Public-Header

Nachteile:
- Mehr Code
- Doppelung von Logik für Sprache und Auth
- Höheres Regressionsrisiko

### Variante 3: Auth und Sprache lokal in Explore einbauen

Vorteile:
- Explore bleibt weitgehend unabhängig vom globalen Layout

Nachteile:
- Schlechtere Konsistenz
- Verteilte Navigation
- Zwei Stellen für dieselben Kernfunktionen

## Entscheidung

Variante 1 ist aktuell die einfachste und sauberste Lösung.
Der gemeldete Fehler betrifft genau die absichtliche Ausblendung des globalen Headers.
Deshalb wird nur diese Sonderbehandlung entfernt und durch einen kleinen Unit-Test abgesichert.
