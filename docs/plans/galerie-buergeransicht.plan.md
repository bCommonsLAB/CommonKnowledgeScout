---
name: galerie-buergeransicht
overview: "Die Galerie bekommt ein Profil „geführt“ für Bürger neben dem heutigen Expertenmodus — kein zweiter Baustein, sondern ein Schalter in der bestehenden `GalleryRoot`: Filter als Lade von rechts statt Spalte links, weniger Knöpfe, Umschalter „Im Fokus | Alle“, ruhige Karten. Anonym = geführt, Mitglied = Experte (ADR 0010). Entwurf in Figma (Owner 19.10.2026), Vorhaben 2 in docs/STAND.md."
vorhaben: [Klimamaßnahmen Südtirol]
status: in-arbeit
todos:
  - id: g1-profil-layout
    content: "G1 Profil und Layout: Hook `useGalerieProfil` (Config + Rolle + URL), ein Layout-Schalter statt Tailwind-Breakpoint (Spalte oder Lade), Lade von rechts; Expertenmodus bleibt Byte für Byte gleich."
    status: pending
  - id: g2-leiste-karten
    content: "G2 Leiste und Karten: Umschalter „Im Fokus | Alle“, reduzierte Werkzeugleiste, Filter nur als Symbol, Einleitung aus den Galerie-Texten, kompakte Karten als Vorgabe."
    status: pending
  - id: g3-config-bruecke
    content: "G3 Config und Brücke: Feld `chat.gallery.anonymProfil`, Settings-Formular, `konfiguration_lesen/setzen`, Contract und STAND."
    status: pending
---

# Galerie-Profil „geführt“: Bürgeransicht ohne zweiten Baustein

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Entwurf: Figma-Datei
> „Klimamaßnahmen – Bürgeransicht (Fokus)“ (Team bCommonsLab, 19.10.2026):
> Desktop, Desktop mit Filter-Lade, Mobil. Nachbar von
> [`galerie-fokus-aus-sternen.plan.md`](galerie-fokus-aus-sternen.plan.md)
> (F1–F4 gebaut) und der kompakten Kachel (PR #405).

## 1. Ausgangslage (Bestand, geprüft am 19.10.2026)

Die Galerie ist ein isolierter React-Baustein (`GalleryRoot` in
`packages/module-explorer/src/gallery/components/gallery-root.tsx`, 1.462
Zeilen) mit Slots für alles, was die App beisteuert (`detailRenderers`,
`siteView`, `storyPanel`, `kopfAktionen`, …). App (`src/app/library/gallery/client.tsx`)
und Embed (`packages/embed/src/embed-galerie.tsx`) montieren denselben
Baustein. Das bleibt so.

Was der Bestand schon kann und was der Entwurf braucht:

| Entwurf | Bestand | Lücke |
|---|---|---|
| Filter als Lade, die von rechts einfliegt | `MobileFiltersSheet` (`side="left"`), im Zweig `lg:hidden`; Desktop zeigt die Spalte `lg:grid-cols-[280px_…]` | Die Wahl Spalte/Lade hängt am Breakpoint, nicht an einer Variable; Seite ist links |
| Umschalter „Im Fokus · 36 / Alle · 607“ | Knopf „Im Fokus“ (`fokus-filter-button.tsx`, F2) setzt `starred=1&sort=stars` | Zweiter Zustand „Alle“ mit Zahl; Vorgabe „Im Fokus“ im geführten Profil |
| Nur Suche und Filter-Symbol oben | `FilterContextBar` (354 Zeilen) zeigt Favoriten, Kommentare, zwei Sortier-Knöpfe (teils Mitglieder-gegated); `GalleryStickyHeader` zeigt Galerie/Tabelle/Graph, Dichte, `kopfAktionen` | Beide brauchen einen Profil-Parameter, der Knöpfe weglässt |
| Einleitung mit Kennzeile, Titel, Erklärung | `useGalleryConfig` liest `publicPublishing.gallery.headline/subtitle/description` | Darstellung als Band statt Kopfzeile |
| Ruhige Karten | kompakte Kachel aus PR #405 (`cardDensity`) | Vorgabe „compact“ im geführten Profil, Dichte-Umschalter weg |
| Kopfnavigation ohne Archiv/Wartekorb | Schale (`TopNav`, `useSiteMenuItems`), nicht Galerie | außerhalb dieses Plans; für Anonyme heute schon reduziert |
| Profil anonym/Mitglied | ADR 0010: `profiles.simple.ui = 'guided'`, `expert.ui = 'expert'`, anonym ⇒ simple | Noch nicht gebaut; hier der erste konkrete Schritt |

## 2. Regeln

- **Ein Baustein, ein Profil-Schalter.** Keine `BuergerGalleryRoot`. Das
  Profil ist ein Wert `'gefuehrt' | 'experte'`, den die Galerie über einen
  Hook kennt und an Kopf, Leiste, Layout und Karten durchreicht.
- **Der Expertenmodus ändert sich nicht.** Jede Welle vergleicht: mit
  Profil `experte` ist das gerenderte Ergebnis gleich wie heute (Snapshot
  der Toolbar-Knöpfe und des Layout-Zweigs im Test).
- **Nicht gravierend verschieden.** Karten, Detailansicht, Suche,
  URL-Vertrag (§5 der Galerie-Contracts: Zustand in der Adresse) und die
  Filter-Logik sind in beiden Profilen dieselben; nur das Drumherum weicht.
- **Kein stiller Fallback.** Unbekannter Profilwert in Config oder Adresse
  wirft bzw. wird geloggt und als `experte` gerendert — nie still „irgendwas“.
- **Vorgabe ist das heutige Verhalten.** Ohne Config-Feld bleibt jede
  Library im Expertenmodus. Die Klima-Library schaltet bewusst um (G3 über
  die Brücke). Der Umschalter ist für alle sichtbar; Beitragen bleibt
  Angemeldeten vorbehalten, die Einladung dazu sehen alle.
- Dateien höchstens 200 Zeilen: `gallery-root.tsx` und
  `filter-context-bar.tsx` werden nicht erweitert, neue Teile kommen in
  eigene Dateien und werden nur eingehängt.
- Storage-Abstraktion und Embed-Regel (ADR 0008 a: nur Öffentliches)
  unberührt; das Embed bekommt automatisch das geführte Profil, weil es
  anonym ist.

## 3. Wellen

### G1 · Profil und Layout (ein Tag)

1. **Hook `useGalerieProfil(libraryId)`** (`hooks/use-galerie-profil.ts`):
   Reihenfolge Adresse `?ansicht=gefuehrt|experte` (der Umschalter schreibt
   sie) → sonst `config.chat.gallery.standardProfil` (Vorgabe `experte`).
   Keine Rollenlogik (Entscheid 1). Rückgabe `{ profil, quelle, setzen }`.
   Unbekannte Werte: `console.error`, Ergebnis `experte`.
2. **Layout-Schalter statt Breakpoint.** Heute: `lg:hidden` (mobil, Lade)
   und `hidden lg:grid` (Desktop, Spalte). Neu: eine Variable
   `filterAnzeige: 'spalte' | 'lade'` — `experte`: wie heute per
   Breakpoint; `gefuehrt`: immer `lade`. Umsetzung als zwei kleine
   Klassen-Helfer in `lib/galerie-layout.ts` (reine Funktion, testbar), die
   `gallery-root.tsx` an den beiden Stellen einsetzt.
3. **Lade von rechts.** `MobileFiltersSheet` bekommt `side?: 'left' | 'right'`
   (Vorgabe `left`, geführt `right`), Titel „Filter“, Hinweistext aus
   `gallery.filterDescription`, Fußzeile „Zurücksetzen“ und „N Maßnahmen
   zeigen“ (Zahl = `totalCount` der Facetten-Antwort, die es schon gibt).
4. **Umschalter „Einfach | Experte“** (`profil-umschalter.tsx`), für alle
   sichtbar im Kopf der Galerie; schreibt `?ansicht=` per `pushParams`.
5. Tests: Hook (Adresse schlägt Config, unbekannt → Fehler geloggt),
   Layout-Helfer, Sheet-Seite, Umschalter.

### G2 · Leiste und Karten (ein Tag)

1. **Umschalter `fokus-umschalter.tsx`** (ersetzt im geführten Profil den
   Knopf aus F2, der Knopf bleibt für Experten): zwei Segmente „Im Fokus ·
   N“ und „Alle Maßnahmen · M“; N aus der Facetten-Antwort mit `starred=1`,
   M aus `total` ohne. Schaltet `starred=1&sort=stars` an und aus wie
   `fokusUmschalten` in F2.
2. **Vorgabe „Im Fokus“** aus `chat.gallery.startAnsicht` (`fokus` | `alle`,
   Vorgabe `alle`): Fehlen `starred` und `sort` in der Adresse und steht
   `fokus` in der Config, schreibt die Galerie beim ersten Rendern
   `starred=1&sort=stars` per `replaceParams` (kein Verlaufseintrag), damit
   der URL-Vertrag hält und „Alle“ eine echte Adresse ist. Ein leerer Fokus
   wird leer gezeigt (Entscheid 2).
3. **Reduzierte Leiste.** `FilterContextBar` und `GalleryStickyHeader`
   bekommen `profil`: geführt zeigt Umschalter, Suche, Filter-Symbol, Zähler;
   weg sind Favoriten, Kommentare, beide Sortier-Knöpfe, Galerie/Tabelle/
   Graph, Dichte, `kopfAktionen` (Inhalte erfassen). Die Suche wandert in die
   Leiste (heute im Kopf).
4. **Einleitung als Band** (`galerie-einleitung.tsx`): Kennzeile, Titel,
   Erklärung aus den Galerie-Texten (`headline`, `subtitle`, `description`);
   Experten sehen weiter die Kopfzeile von heute.
5. **Karten:** im geführten Profil `cardDensity = 'compact'` als Vorgabe
   (kompakte Kachel aus PR #405), Umschalter weg; `sessionStorage`-Wert nur
   im Expertenmodus lesen.
6. Tests: Umschalter (beide Parameter, Zahlen), Vorgabe-Adresse, Leiste je
   Profil (Snapshot-frei per Rollen-Abfragen), Experten-Vergleich unverändert.

### G3 · Config, Brücke, Doku (ein halber Tag)

1. **Config-Felder** `chat.gallery.standardProfil?: 'gefuehrt' | 'experte'`
   und `chat.gallery.startAnsicht?: 'fokus' | 'alle'`
   nach [`../contracts/library-config-field.md`](../contracts/library-config-field.md)
   (Typ, Client-Steckbrief, Service, Formular Einstellungen → Erkunden,
   Validierung mit `chat-config-validation.ts`).
2. **Brücke:** `konfiguration_lesen` (Bereich `galerie`) zeigt das Feld,
   `konfiguration_setzen` nimmt es; `TOOLSET_VERSION`, `NEU_IN_VERSION`.
3. **Inhalt (Owner über die Brücke):** Klima-Library auf `gefuehrt` und
   `fokus` schalten, Galerie-Texte für das Band setzen (`veroeffentlichung_setzen`
   → `gallery.headline/subtitle/description`), anonym prüfen.
4. Contract `welle-3-iii-galerie-chat-contracts.md` um das Profil ergänzen
   (§5 URL-Vertrag: `ansicht`, Vorgabe-Parameter), ADR 0010 als „Teil 1
   gebaut“ vermerken, STAND nachziehen.

## 4. Reihenfolge und Aufwand

| Welle | Aufwand | Hängt an |
|---|---|---|
| G1 | ein Tag | PR #405 gemergt (kompakte Kachel) nicht nötig, aber hilfreich |
| G2 | ein Tag | G1 (Profil-Hook), PR #405 für Punkt 5 |
| G3 | ein halber Tag | G1 (Feldname), parallel zu G2 möglich |

Je Welle eine PR; `pnpm test`, `pnpm lint`, `npx tsc --noEmit` mit
Vorher/Nachher-Vergleich; vor dem Merge `pnpm build` und
`bash scripts/welle-pre-merge-check.sh` beim Owner. Live-Prüfung anonym
im privaten Fenster und als Mitglied (Expertenmodus unverändert), dazu das
Embed (`@ks/embed`) einmal montieren.

## 5. Nicht in diesem Plan (Vorrat)

- Kopfnavigation der Schale (Archiv, Wartekorb, Library-Wechsler) je
  Profil — gehört zu `TopNav`/SiteConfig, nicht zur Galerie.
- Retrieval-Strategie und Sprachen je Profil (ADR 0010, Teil 2 und 4).
- Fragen stellen („Story“) als Knopf in der Bürgeransicht — Entscheid des
  Owners, ob über „Mitreden“ oder eigener Einstieg.
- Mehr als drei Fragen in der Lade; welche Facetten die Lade zeigt, steuert
  heute schon `visible` in der Facetten-Konfiguration.

## 6. Entscheidungen (Owner 19.10.2026)

1. **Profilwahl: ein sichtbarer Umschalter für alle**, nicht an die Rolle
   gebunden. Die Adresse (`?ansicht=`) trägt die Wahl, die Library-Config
   die Vorgabe (`chat.gallery.standardProfil`). Beitragen (bewerten,
   erfassen, mitreden) geht weiterhin nur angemeldet, aber die **Einladung
   dazu sehen alle** — auch im geführten Profil ein Knopf, der zur Anmeldung
   führt.
2. **Vorgabe „Im Fokus“ kommt aus der Config** (`chat.gallery.startAnsicht`:
   `fokus` | `alle`), unabhängig vom Schalter `starCountsPublic`. Ist der
   Fokus leer, zeigt die Galerie das leer an („Noch keine Maßnahme mit
   Stern.“) — dann muss jemand etwas in den Fokus legen; kein Ausweichen.
3. **Bandtexte aus den vorhandenen Galerie-Texten** (`headline`, `subtitle`,
   `description`), keine neuen Felder.
