---
name: galerie-buergeransicht
overview: "Die Galerie bekommt ein Profil „geführt“ für Bürger neben dem heutigen Expertenmodus — kein zweiter Baustein, sondern ein Schalter in der bestehenden `GalleryRoot`: Filter als Lade von rechts statt Spalte links, weniger Knöpfe, Umschalter „Im Fokus | Alle“, ruhige Karten. Anonym = geführt, Mitglied = Experte (ADR 0010). Entwurf in Figma (Owner 19.10.2026), Vorhaben 2 in docs/STAND.md."
vorhaben: [Klimamaßnahmen Südtirol]
status: in-arbeit
todos:
  - id: g1-profil-layout
    content: "G1 Profil und Layout (gebaut 19.10.): Hook `useGalerieProfil` (Config + Rolle + URL), ein Layout-Schalter statt Tailwind-Breakpoint (Spalte oder Lade), Lade von rechts; Expertenmodus bleibt Byte für Byte gleich."
    status: completed
  - id: g2-leiste-karten
    content: "G2 Leiste und Karten (gebaut 19.10.): Umschalter „Im Fokus | Alle“, reduzierte Werkzeugleiste, Filter nur als Symbol, Einleitung aus den Galerie-Texten, kompakte Karten als Vorgabe."
    status: completed
  - id: g3-config-bruecke
    content: "G3 Config und Brücke (gebaut 19.10.): Felder `chat.gallery.standardProfil` und `startAnsicht`, Settings-Formular Erkunden, `konfiguration_lesen/setzen` (2.59.0), Contract §5 und STAND; Inhalt über die Brücke folgt."
    status: completed
  - id: g4-feinschliff-figma
    content: "G4 Feinschliff nach Figma (gebaut 19.10.): Library-Kopf im geführten Profil weg (nur das Band), Umschalter und Einladung als ruhige Textknöpfe in der Leiste, Suche in der Leiste (mobil eigene Zeile). Story-Knopf bleibt; Mitreden-Band: Owner-Entscheid offen."
    status: completed
  - id: g5-mitreden-band
    content: "G5 Mitreden-Band (Owner 19.10.): im geführten Profil der Story-Knopf weg, unten ein Band mit Überschrift, Zeile und Knopf „Mitreden“ wie in Figma; Texte und Ziel als Text-Gruppe `publicPublishing.mitreden` über Formular und Brücke; ohne Texte kein Band. Gebaut 19.10.; Inhalt (Punkt 4) folgt über die Brücke."
    status: completed
  - id: g6-kopf-und-band-buendig
    content: "G6 Kopf und Band bündig (gebaut 20.10.): Logo in der TopNav folgt dem Bild (kein leerer 96-px-Kasten), der Kopf der Erkunden-Seite hält nur den tatsächlichen Logo-Überhang frei, das Band liegt ohne Kasten bündig mit Leiste und Karten."
    status: completed
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

### G1 · Profil und Layout (gebaut 19.10.2026)

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

### G2 · Leiste und Karten (gebaut 19.10.2026)

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
   wird leer gezeigt (Entscheid 2). Bekannte Grenze: die Vorgabe greift einmal
   je Montage; ein geteilter Link ohne Parameter öffnet wieder im Fokus.
3. **Reduzierte Leiste.** `FilterContextBar` und `GalleryStickyHeader`
   bekommen `profil`: geführt zeigt Umschalter, Suche, Filter-Symbol, Zähler;
   weg sind Favoriten, Kommentare, beide Sortier-Knöpfe, Galerie/Tabelle/
   Graph und Dichte. `kopfAktionen` (Inhalte erfassen) bleiben sichtbar —
   die Einladung zum Beitragen sehen alle (Entscheid 1). Die Suche bleibt im
   Kopf (Figma zeigt sie in der Leiste; kosmetisch, Vorrat).
4. **Einleitung als Band** (`galerie-einleitung.tsx`): Kennzeile, Titel,
   Erklärung aus den Galerie-Texten (`headline`, `subtitle`, `description`);
   Experten sehen weiter die Kopfzeile von heute.
5. **Karten:** im geführten Profil `cardDensity = 'compact'` als Vorgabe
   (kompakte Kachel aus PR #405), Umschalter weg; `sessionStorage`-Wert nur
   im Expertenmodus lesen.
6. Tests: Umschalter (beide Parameter, Zahlen), Vorgabe-Adresse, Leiste je
   Profil (Snapshot-frei per Rollen-Abfragen), Experten-Vergleich unverändert.

### G3 · Config, Brücke, Doku (gebaut 19.10.2026; Punkt 3 ist Inhaltsarbeit des Owners)

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

### G4 · Feinschliff nach Figma (gebaut 19.10.2026; Punkt 4 → G5)

Der Vergleich der gebauten Ansicht mit dem Entwurf zeigt drei Abweichungen,
die am Galerie-Baustein hängen (Kopfnavigation, Schriften und Farben gehören
zur Website-Hülle, siehe Vorrat):

1. **Nur das Band, kein Library-Kopf.** Im geführten Profil zeigt
   `GalleryStickyHeader` heute noch Titel, Beschreibung und die Ansichtszeile
   „Inhalte erkunden ⓘ“ (`seitenkopf`, `ansicht` in `gallery-root.tsx`
   ~1186), darunter erst das Band. Figma hat nur das Band. Neu: bei
   `gefuehrt` entfallen Kopf und Ansichtszeile; das Band übernimmt Titel
   und Erklärung; die Werkzeugzeile (Suche, Umschalter, Einladung) rückt
   in die Leiste (Punkt 3). Experte unverändert.
2. **Ruhige Knöpfe.** `profil-umschalter.tsx` (zwei Pillen mit Symbol) und
   die Einladung zum Beitragen (`kopfAktionen`, `CaptureContentButton`,
   heute derselbe Knopf wie für Experten) werden im geführten Profil zu
   schlichten Textknöpfen am rechten Rand der Leiste: „Experte“ als
   Textlink (zurück: „Einfach“), die Einladung als Text „Beitragen“ mit
   Tooltip, der anonym zur Anmeldung führt (Entscheid 1). Form und Abstand
   nach dem Figma-Rahmen Desktop (2:2); Knopfzeile ohne Umbruch
   (Owner-Regel 08.10.).
3. **Suche in die Leiste.** Das Suchfeld steht heute in der Ansichtszeile
   des Kopfs (`werkzeuge` in `gallery-sticky-header.tsx`). Bei `gefuehrt`
   wandert es in `FilterContextBar` neben Fokus-Umschalter und
   Filter-Knopf, wie in Figma. Die Leiste bleibt einzeilig; unter `lg`
   schrumpft zuerst das Suchfeld.
4. **Offen, Owner-Entscheid vor dem Bau:** der Knopf „In Story Mode
   ansehen“ (`ctaLabel` an der Leiste, `gallery-root.tsx` ~1225) steht in
   Figma nicht; dort gibt es unten ein Mitreden-Band. Varianten: (a)
   Story-Knopf im geführten Profil weg, Mitreden-Band als neuer Slot der
   App (Text aus den Galerie-Texten oder eigenes Feld); (b) Story-Knopf
   bleibt als Einstieg „Fragen stellen“; (c) beides. Bis zum Entscheid
   bleibt der Knopf.
5. Tests: Kopf je Profil (geführt ohne Seitenkopf), Leiste mit Suchfeld,
   Experten-Vergleich unverändert; Live-Prüfung bei 1280 px und mobil.

**Gebaut (19.10.2026):** `gallery-root.tsx` rendert `GalleryStickyHeader` nur
im Expertenmodus; `FilterContextBar` bekommt zwei Slots `suche` und
`werkzeugeRechts` (vor dem Story-Knopf); neue Bausteine `galerie-suche.tsx`
(Explorer-Paket) und `beitragen-einladung.tsx` (App: anonym Clerk-Anmeldung
im Modal, danach `/library/create?from=gallery`; angemeldet der rechte-
gegatete `CaptureContentButton` in der Variante `ruhig`); `ProfilUmschalter`
Variante `ruhig` (ein Textknopf zum anderen Profil); der Slot `kopfAktionen`
bekommt `{ profil }` als zweiten Parameter. Mobil (< lg): Zähler weg (die
Fokus-Zahl zeigt ihn), „Im Fokus“ nur als Stern mit Zahl, Suche als eigene
Zeile unter der Leiste — die Knopfzeile bricht nie um. Der Library-Kopf der
öffentlichen Slug-Seite (`/explore/<slug>`, Name der Library) gehört zur
Schale und bleibt (Figma: „Marke“).

### G5 · Mitreden-Band statt Story-Knopf (gebaut 19.10.2026; Punkt 4 Inhalt offen)

Figma-Rahmen Desktop (2:2), Gruppe „Mitreden-Band“ (2:159): ein Band über
die volle Breite unter dem Kartenraster, dunkler Grund (Fläche `dark-green`
des Site-Themes), links Überschrift und eine Zeile Text, rechts ein Knopf
„Mitreden →“. Der Knopf „In Story Mode ansehen“ entfällt im geführten
Profil; Experten behalten ihn.

1. **Texte und Ziel aus der Config, nicht aus dem Code.** Neue Text-Gruppe
   `publicPublishing.mitreden` mit `headline`, `text`, `buttonLabel`,
   `href` — feldweise wie `gallery` und `story` (2.56.0): weggelassen =
   unverändert, `''` = Feld leer, unbekannte Felder abgewiesen. `href` ist
   ein relativer Pfad (`/…`) oder `https://…`, alles andere weist die
   Prüfung ab (`public-publishing-validation.ts`). Fehlen `headline` oder
   `href`, gibt es **kein Band** — nichts wird still erfunden. Setzbar über
   `veroeffentlichung_setzen` (Brücke, `TOOLSET_VERSION` + `NEU_IN_VERSION`)
   und im Formular Einstellungen → Veröffentlichung (Abschnitt neben den
   Galerie-Texten, nach `library-config-field.md`).
2. **Baustein `mitreden-band.tsx`** im Explorer-Paket, montiert in
   `gallery-root.tsx` unter der Liste des geführten Profils (nur `lade`-
   Zweig, nur `gefuehrt`, nur mit Texten). Ein `<a href>` — kein Router,
   damit das Embed (anonym, ADR 0008 a) denselben Baustein zeigt; relative
   Ziele laufen dort gegen den Host der Einbettung, das Embed-Readme nennt
   das. Farben über die Theme-Tokens der Hülle (Site-Theme auf der
   Website, Standard-Theme in der App), kein eigenes Grün im Code. Mobil:
   Text und Knopf untereinander, Knopf volle Breite.
3. **Story-Knopf weg im geführten Profil:** `ctaLabel`/`onCta` an beiden
   `FilterContextBar`-Aufrufen nur bei `profil !== 'gefuehrt'`. Der
   Story-Modus bleibt über die Schale (Reiter „Story Mode“) erreichbar.
4. **Inhalt (Owner über die Brücke):** Klima-Library bekommt Überschrift,
   Zeile und Knopf aus dem Figma-Text und als Ziel die Mitreden-Seite der
   Website; anonym prüfen.
5. Tests: Prüfung (`href`-Form, Pflichtfelder, feldweiser Merge), Band
   mit/ohne Texte, Story-Knopf je Profil, Experten-Vergleich unverändert;
   Live bei 1280 px, mobil und einmal im Embed.

**Gebaut (19.10.2026):** Typen in `@ks/contracts`, `src/types/library.ts` und
`ExplorerLibraryPayload`; `public-publishing-validation.ts` (Schlüssel,
`MITREDEN_HREF_RE`, Merge, `geaenderteFelder`); PUT-Route, Client-Abbildung
und beide Slug-Routen reichen `mitreden` durch; Brücke 2.60.0
(`veroeffentlichung_setzen` nimmt `mitreden`, Sicht zeigt es); Formular
Veröffentlichung mit `mitreden-fields.tsx` unter den Galerie-Texten;
Baustein `mitreden-band.tsx` unter der Liste des `lade`-Zweigs, nur
`gefuehrt`, nur mit Überschrift und Ziel; Story-Knopf an beiden Leisten nur
bei `experte`. Farben: Standard-Tokens der Hülle (`bg-primary`), kein eigenes
Grün — die Slug-Seite legt das Site-Theme nur auf die Website, nicht auf die
Galerie (Vorrat). Live ohne Texte belegt (kein Band, Story-Knopf weg,
Experte unverändert); das Band selbst nur im Test — sichtbar, sobald die
Klima-Library die Texte bekommt (Punkt 4, nach Deploy 2.60.0).

### G6 · Kopf und Band bündig (gebaut 20.10.2026, nach Sichtung mit Logo)

Mit dem Website-Logo verschwindet der Textkopf der Erkunden-Seite (das war
schon so gebaut), aber drei Reste blieben: ein 40-px-Platzhalter plus 12 px
Hinweis-Polster unter der Navigation, das Logo in einem festen 96-px-Kasten
(ein breites Logo saß darin mittig unter der Zeile) und das Band auf 1024 px
zentriert mit eigenem grauen Kasten.

1. `site-logo.tsx`: Bild mit `h-auto max-h-24 max-w-[7rem]` statt fester
   Höhe; nach dem Laden misst die Komponente den Überhang unter der TopNav
   (`h-16`, Logo `top-2`) und setzt ihn als CSS-Variable
   `--site-logo-ueberhang` am Dokument (0 bei breiten, 40 px bei
   quadratischen Logos).
2. `explorer-header.tsx`: der Platzhalter ist so hoch wie diese Variable
   (Vorgabe 2.5 rem ohne Wert, wie bisher); das Hinweis-Polster gibt es nur,
   wenn der Slot etwas rendert (`[&:not(:empty)]:pb-2`).
3. `galerie-einleitung.tsx`: kein Kasten, kein seitlicher Innenabstand,
   keine zentrierte Spalte — Kennzeile, Titel und Erklärung stehen auf 16 px
   wie „36 Quellen“ und die erste Karte (Figma: Einleitung direkt auf der
   Seite).

## 4. Reihenfolge und Aufwand

| Welle | Aufwand | Hängt an |
|---|---|---|
| G1 | ein Tag | PR #405 gemergt (kompakte Kachel) nicht nötig, aber hilfreich |
| G2 | ein Tag | G1 (Profil-Hook), PR #405 für Punkt 5 |
| G3 | ein halber Tag | G1 (Feldname), parallel zu G2 möglich |
| G4 | ein halber Tag | G1–G3 gemergt; Punkt 4 erst nach Owner-Entscheid |
| G5 | ein halber Tag | G4 gemergt (PR #408); Inhalt danach über die Brücke |
| G6 | eine Stunde | Logo an der Library gesetzt (Owner 19.10.) |

Je Welle eine PR; `pnpm test`, `pnpm lint`, `npx tsc --noEmit` mit
Vorher/Nachher-Vergleich; vor dem Merge `pnpm build` und
`bash scripts/welle-pre-merge-check.sh` beim Owner. Live-Prüfung anonym
im privaten Fenster und als Mitglied (Expertenmodus unverändert), dazu das
Embed (`@ks/embed`) einmal montieren.

## 5. Nicht in diesem Plan (Vorrat)

- Kopfnavigation der Schale (Archiv, Wartekorb, Library-Wechsler) je
  Profil — gehört zu `TopNav`/SiteConfig, nicht zur Galerie.
- Retrieval-Strategie und Sprachen je Profil (ADR 0010, Teil 2 und 4).
- Fragen stellen („Story“) als eigener Einstieg in der Bürgeransicht — mit
  Entscheid 5 vorerst nur über den Reiter der Schale, nicht in der Galerie.
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
4. **G4 (19.10., nach Sichtung):** Library-Kopf im geführten Profil weg,
   Umschalter und Einladung als ruhige Knöpfe, Suche in die Leiste.
   Story-Knopf und Mitreden-Band: siehe Entscheid 5.
5. **Mitreden-Band statt Story-Knopf (19.10., nach G4):** im geführten
   Profil entfällt „In Story Mode ansehen“, unten steht das Mitreden-Band
   aus Figma; Texte und Ziel kommen aus `publicPublishing.mitreden` (G5).
