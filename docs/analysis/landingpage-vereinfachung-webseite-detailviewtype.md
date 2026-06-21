# Konzept: Landingpage-Vereinfachung über `detailViewType: website`

> Status: Konzept / Diskussionsgrundlage. Noch keine Implementierung.
> Branch: `claude/relaxed-mendel-fhwj8r`. Datum: 2026-06-21.
> Voraussetzung: A0-Feld-Contract + `detail-view-types`-Registry (auf `master`).

## 1. Ziel

Eine veröffentlichte Library soll wie eine Webseite mit Landingpage wirken und
ihre Inhalte anteasern. Das heutige Feature (HTML-Snapshot im Ordner `web/` →
Azure) ist zu kompliziert: drei Speichersysteme, kein Editor, zwei
Publish-Begriffe, Inhalt steht außerhalb des Dokumentmodells (nicht
durchsuchbar, kein RAG, keine Übersetzung).

**Kernidee:** Eine Webseite wird wie **jedes andere Dokument** behandelt — ein
Markdown-Dokument mit flachem Frontmatter und eingebetteten Bildern, gerendert
über einen neuen `detailViewType: website`.

**Zusätzliche Anforderungen (Stand 2026-06-21):**

1. **Side-Banner**: Teasert die wichtigsten/neuesten Dokumente der Library an,
   mit Button „mehr Inhalte" → Galerie.
2. **Homepage**: Die Landingpage ist zugleich die Startseite.
3. **Dynamisches Menü**: Alle Dokumente vom Typ `website` werden als Menü
   gelistet — auf Home, Galerie und Story.
4. **Ladezeit (kritisch)**: Möglichst schneller Render **ohne** Login-Blockade,
   plus UX-Best-Practices für Landingpages.

## 2. Ist-Zustand (Kurzfassung)

- Datenmodell: `Library.config.publicPublishing` in MongoDB
  (`src/types/library.ts:426-489`) — Meta/Texte + `siteUrl`/`siteVersion`.
- Startseite: rohe HTML/CSS/JS im Storage-Ordner `web/`, beim Publish rekursiv
  als versionierter Snapshot nach Azure (`src/app/api/library/[libraryId]/publish-site/route.ts`).
- Öffentliche Anzeige: `/explore/[slug]` rendert iframe auf die Azure-URL
  (`src/app/explore/[slug]/page.tsx`).
- Komplexitäts-Treiber: 3 Speichersysteme, kein Editor, `isPublic` ≠
  `sitePublished`, Gating über 4 Dateien, kein Rollback, Inhalt nicht im
  Dokumentmodell.

## 3. Soll-Zustand

Webseite = Dokument vom Typ `website`. Es nutzt unverändert:

- **detailViewType-Registry** als Erweiterungspunkt
  (`src/lib/detail-view-types/registry.ts:31`).
- **MarkdownPreview** für Body + Bildauflösung (relative Pfade →
  Storage-Streaming-URL).
- **Capture→Inbox→Promotion** wie jedes Dokument (ADR 0004).
- **Wizard-Import von URL** wie beim Session-Import (Secretary).
- **Öffentliche Docs-API** (anonym) für Teaser/Menü, siehe §10/§11.

## 4. Datenmodell (flach, snake_case, AGENTS-konform)

Frontmatter trägt nur **skalare** Hero-/Meta-Felder. Alle Sektionen leben im
Markdown-Body — kein verschachteltes Frontmatter (AGENTS-Regel).

```yaml
---
detailViewType: website          # neuer Registry-Wert
title: Oldies for Future
hero_subtitle: Wir solidarisieren uns mit jungen Menschen für eine lebenswerte Zukunft.
hero_image: images/oldies-for-future-headimage-2_web.jpg
video_url: https://peertube.uno/videos/embed/XXXX   # optional, PeerTube/YouTube/Vimeo
language: de
cta_label: Jetzt mitmachen
cta_url: https://…/kontakt
menu_order: 1                    # optional, Position im dynamischen Menü (§11)
is_landing_page: true            # optional, markiert die Startseite (§9, Entscheidung E2)
source_url: https://oldiesforfuture.it             # Import-Herkunft (Provenienz)
---

## Wer sind wir?
![Gruppenfoto](images/IMG-20230419-WA0003.jpg)

Wir „Oldies for Future" wollen uns mit den jungen Menschen solidarisieren …

> Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.
> — Marie von Ebner-Eschenbach
```

Felder folgen bestehenden Konventionen: `video_url`, `coverImageUrl`, `title`,
`upsertedAt` existieren bereits (`src/lib/detail-view-types/registry.ts:223`,
`src/lib/gallery/types.ts:19`, `src/components/settings/FacetDefsEditor.tsx:24`).

## 5. Sektions-Mapping (analysierte Beispielseite „Oldies for Future")

~80 % ist sauber abbildbarer Inhalt, der Rest ist „Chrome", der bewusst entfällt.

| Quelle (HTML)                       | Ziel im Dokument                       |
| ----------------------------------- | -------------------------------------- |
| `<title>`                           | `title`                                |
| `<meta description>`                | `hero_subtitle`                        |
| Erstes Cover-Bild                   | `hero_image`                           |
| Vimeo-Embed                         | `video_url` (→ PeerTube)               |
| `h2` + `<p>` + Sektions-Bild        | `## …` + Absätze + `![]()` im Body     |
| Zitat-Block                         | Markdown-Blockquote                    |
| CTA „Jetzt mitmachen" → kontakt.html| `cta_label` / `cta_url` (extern)       |
| Nav, Cookie-Banner, Parallax, Splide| entfällt (Chrome)                      |
| CMS-Blogliste „Visionäre Geschichten"| Side-Banner aus Galerie (§10)         |

## 6. Video: PeerTube über `video_url` (Wiederverwendung Event-Muster)

Events tragen Video bereits als `video_url` (Templates extrahieren
PeerTube-Embed-URLs, `template-samples/event-creation-de.md:20,124`). Das
Embed-Muster ist einsatzbereit in `EventSummary`
(`src/components/event-summary.tsx:35-47`): iframe mit `aspect-video`,
`sandbox`, `loading="lazy"`, Fallback auf Cover.

**Gap (zu schließen):** Die Render-Whitelist `isSafeVideoIframeSrc`
(`src/lib/media/safe-video-iframe.ts:18-22`) kennt nur YouTube/Vimeo/mp4/webm —
**PeerTube-Hosts fehlen**, d. h. PeerTube-`video_url` wird heute (auch bei
Events) nicht eingebettet, sondern fällt auf das Cover zurück.

→ **Aktion:** PeerTube in `isSafeVideoIframeSrc` whitelisten (Pfad
`/videos/embed/` oder konfigurierbare Host-Allowlist). Davon profitieren Events
sofort mit; der `website`-Renderer nutzt anschließend dasselbe Embed-Muster.

## 7. Wizard-Import (URL → Dokument)

Wiederverwendung des bestehenden Website-Import-Flows (Sessions), siehe
`docs/_analysis/website-import-session-feature-map.md`:

1. URL eingeben → `POST /api/secretary/import-from-url`.
2. Secretary extrahiert mit Website-Template (analog
   `ExtractSessionDataFromWebsite`): `{ title, hero_subtitle, hero_image,
   video_url, sections:[{heading,body,image}], quote, cta }`.
3. `mapStructuredDataToWebsite()` baut flaches Frontmatter + Body. Bilder
   herunterladen, als Dokument-Medien speichern (responsive `-p-500/-800` und
   decorative SVGs ignorieren).
4. Ab hier identisch zu jedem Dokument: Capture → Inbox → Promotion.

## 8. Speicherung & Publikation (unverändert)

- Capture schreibt nie in den Ziel-Provider, sondern in die Inbox
  (MongoDB + Azure Blob), ADR 0004.
- Promotion schreibt die `.md` + kopiert Medien und indexiert für RAG
  (`src/lib/submissions/promotion.ts`).

## 9. Public-Rendering & Homepage

`/explore/[slug]` rendert künftig das als Startseite markierte
`website`-Dokument über den `detailViewType: website`-Renderer (Hero +
Markdown-Body + Video + Side-Banner + dynamisches Menü + CTA), statt iframe auf
Azure. Der `web/`-Snapshot-Pfad wird damit ablösbar.

**Homepage:** Die Route ist bereits öffentlich (`/` und `/explore(.*)` in
`src/middleware.ts:36-49`). Ob die Landingpage **die globale Startseite** `/`
übernimmt (Single-Library-Betrieb) oder unter `/explore/[slug]` lebt und nur als
Library-Startseite dient, ist Entscheidung **E7**. Heute zeigt `/` die
Library-Liste (`src/app/page.tsx` → `home-client.tsx`).

## 10. Side-Banner: neueste/wichtigste Dokumente + CTA zur Galerie

**Kein neues Backend nötig.** Die öffentliche Docs-API liefert das bereits:

- `GET /api/chat/[libraryId]/docs?limit=5` → Default-Sort `{ year:-1,
  upsertedAt:-1 }` = neueste zuerst (`docs/route.ts:30-38,129`).
- Optional `?sort=rating` → wichtigste nach `prioritaets_index` (öffentlich,
  `docs/route.ts:34-35`).
- Anonym nutzbar bei öffentlicher Library (`docs/route.ts:75`; Middleware
  erlaubt anonyme GETs auf `/api/chat/[id]/docs`, `src/middleware.ts:124-138`).

Neue Komponente `latest-documents-banner.tsx`: rendert N Teaser über die
vorhandene `DocumentCard` (`src/components/library/gallery/document-card.tsx`) +
Button „mehr Inhalte" → Galerie-Mode (`setMode('gallery')`,
`gallery-root.tsx`). Datum/Thumbnail aus `DocCardMeta`
(`upsertedAt`, `coverThumbnailUrl`, `src/lib/gallery/types.ts`).

## 11. Dynamisches Menü aus `website`-Dokumenten

Der `detailViewType`-Filter existiert serverseitig bereits und ist gegen die
Registry validiert (`docs/route.ts:84-88,118-121`):

- `GET /api/chat/[libraryId]/docs?detailViewType=website` → genau die
  Webseiten-Dokumente, anonym, neueste zuerst (oder `menu_order`, Entscheidung E6).

Daraus wird ein Menü gebaut, das auf **Home, Galerie und Story** erscheint
(jeder Eintrag → `openDocumentBySlug()`). „Galerie" und „Story" sind die
bestehenden Modi (`mode: 'gallery'|'story'|'site'` in `gallery-root.tsx`). Das
bestehende `ViewTypeLeadFilter`
(`src/components/library/gallery/view-type-lead-filter.tsx`) zeigt, wie eine
Typ-Filterung schon heute funktioniert.

## 12. Ladezeit & UX — schneller, login-freier Render (kritisch)

**Gut:** Die Routen sind öffentlich (Middleware), und die Daten-APIs sind anonym
cachebar (`/api/public/libraries/[slug]` `revalidate=60`; `/api/markdown`
`Cache-Control: public, max-age=3600, stale-while-revalidate`).

**Bremser (verifiziert):** `/explore/[slug]/page.tsx` ist `"use client"`
(Zeile 1), wartet auf `useUser()` (Clerk, Zeile 6) und lädt die Galerie mit
`ssr:false` (Zeile 17-18) plus `cache:'no-store'`-Client-Fetches. Folge: kein
Initial-HTML mit Inhalt, Render blockiert auf Clerk-User-Load — auch für anonyme
Besucher.

**Hebel:**

1. **Landingpage als Server-Component (RSC):** Hero, Sektionen, Side-Banner und
   Menü serverseitig aus den anonymen APIs holen → Initial-HTML mit Inhalt,
   keine Login-Blockade. Interaktive Teile (Chat, auth-gated Aktionen) als
   Client-Islands in `Suspense`.
2. **ISR/Static:** `export const revalidate` auf Page-Ebene +
   `generateStaticParams` für die wichtigsten Libraries (Instant-Load).
3. **Caching-Header:** explizite `Cache-Control: public, s-maxage=…` auf den
   public APIs.
4. **Bilder:** `next/image` (Hero mit `priority` für LCP) statt CSS
   `background-image` (`library-grid.tsx`); `remotePatterns` in
   `next.config.js` sind vorhanden.
5. **Clerk:** für den öffentlichen Landingpage-Pfad nicht initialisieren / lazy.

**UX-Best-Practices:** schnelles LCP (Hero-Bild `priority`, kein Layout-Shift
durch feste Bildmaße), klare primäre CTA above-the-fold, dynamisches Menü oben,
Side-Banner mit neuesten Inhalten, Lazy-Load below-the-fold, SEO-Metadaten aus
Frontmatter (`title`/`hero_subtitle` → Next `generateMetadata`),
Barrierefreiheit (Alt-Texte, Tastaturnavigation, Kontrast — WCAG 2.1).

## 13. Implementierungs-Checkliste

Etabliertes „neuer detailViewType"-Muster + die neuen Bausteine:

1. `DETAIL_VIEW_TYPES` um `'website'` + Registry-Eintrag (requiredFields:
   `title`; optional: `hero_subtitle`, `hero_image`, `video_url`, `cta_label`,
   `cta_url`, `menu_order`) — `src/lib/detail-view-types/registry.ts`.
2. Mapper `mapToWebsiteDetail()` — `src/lib/mappers/doc-meta-mappers.ts`.
3. Detail-Komponente `website-detail.tsx` (Hero + MarkdownPreview + Video +
   CTA), analog `EventSummary`.
4. Renderer-Case in `src/components/library/detail-view-renderer.tsx`.
5. Galerie-Card (optional) in `gallery/document-card.tsx`.
6. i18n-Labels (`gallery.detailViewTypeWebsite…`).
7. PeerTube in `isSafeVideoIframeSrc` whitelisten (Querschnitt, hilft Events).
8. Import: Website-Extraktions-Template + `mapStructuredDataToWebsite` +
   Wizard-Source „Website-URL".
9. `latest-documents-banner.tsx` (§10) + dynamisches Menü (§11) über die
   bestehende Docs-API.
10. Performance: `/explore/[slug]` auf RSC + Suspense umbauen, ISR/Caching,
    `next/image`, `generateMetadata` (§12).
11. Public-Rendering auf das Startseiten-Dokument umstellen; `web/`-Snapshot
    ablösen/migrieren.

## 14. Offene Entscheidungen

- **E1 — Sektions-Layout:** Empfehlung „maximal einfach": reiner Markdown-Body,
  Renderer alterniert Bild-Position automatisch (kein Frontmatter-Metadatum).
  Optionale Sektions-Konvention später. *Zu bestätigen.*
- **E2 — Startseite-Markierung:** Library-Config-Feld zeigt auf ein eindeutiges
  Startseiten-Dokument (Empfehlung, `library-config-field.mdc`) vs.
  `is_landing_page`-Flag pro Dokument.
- **E3 — `publicPublishing.gallery/story`-Texte:** ablösen oder für die
  Galerie-Ansicht behalten?
- **E4 — Migration `web/`-Snapshot:** parallel weiter unterstützen oder
  konvertieren?
- **E5 — Side-Banner-Inhalt:** neueste (Default-Sort) oder wichtigste
  (`sort=rating`)? Alle Typen oder bestimmte? Anzahl N?
- **E6 — Menü-Reihenfolge:** manuell über `menu_order` (Empfehlung) vs.
  Datum/alphabetisch; alle `website`-Docs vs. nur markierte.
- **E7 — Homepage-Scope:** übernimmt eine Library die globale Root `/`
  (Single-Library) oder bleibt `/` die Library-Liste und die Landingpage liegt
  unter `/explore/[slug]`?
- **E8 — Performance-Tiefe:** RSC-Umbau jetzt mitnehmen (größerer Eingriff,
  beste Ladezeit) vs. zuerst Quick-Wins (Caching/Header/Bilder).

## 15. Bewusste Abgrenzung (kein 1:1-Klon)

Nicht abgebildet: eigenes CSS/JS, Scroll-/Lottie-Animationen, Parallax,
Cookie-Consent, mehrseitige Navigation (kontakt/impressum/privacy), interaktive
Widgets. Gewinn: durchsuchbar, RAG-fähig, übersetzbar, galerie-integriert, ein
Speicherort statt drei, ein Publish-Begriff, schneller login-freier Render.
