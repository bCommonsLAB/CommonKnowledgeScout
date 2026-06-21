# Konzept: Landingpage-Vereinfachung über `detailViewType: website`

> Status: Konzept / Diskussionsgrundlage. Entscheidungen E1–E8 festgelegt.
> Branch: `claude/relaxed-mendel-fhwj8r`. Datum: 2026-06-21.
> Voraussetzung: A0-Feld-Contract + `detail-view-types`-Registry (auf `master`).

## 1. Ziel & Anforderungen

Eine veröffentlichte Library soll wie eine eigene Webseite mit Landingpage
wirken und ihre Inhalte anteasern. Das heutige Feature (HTML-Snapshot im Ordner
`web/` → Azure) ist zu kompliziert: drei Speichersysteme, kein Editor, zwei
Publish-Begriffe, Inhalt außerhalb des Dokumentmodells (nicht durchsuchbar, kein
RAG, keine Übersetzung).

**Kernidee:** Eine Webseite = **normales Dokument** mit `detailViewType: website`
(flaches Frontmatter + Markdown-Body mit eingebetteten Bildern).

**Anforderungen:** (1) Side-Banner teasert wichtigste Dokumente an + Button zur
Galerie. (2) Landingpage = Homepage. (3) Dynamisches Menü aus allen
`website`-Dokumenten (Home/Galerie/Story). (4) Schneller, login-freier Render +
UX-Best-Practices.

## 2. Festgelegte Entscheidungen

| ID | Thema | Entscheidung |
| -- | ----- | ------------ |
| E1 | Sektions-Layout | **Leichte Sektions-Konvention** im Body (§5.2) |
| E2 | Startseite-Markierung | **Library-Config-Feld** zeigt auf ein Startseiten-Dokument |
| E3 | gallery/story-Texte | **Behalten** für Galerie/Story (klare Trennung) |
| E4 | `web/`-Snapshot | **Sofort ersetzen/abklemmen** (§11) |
| E5 | Side-Banner | **Wichtigste** nach `prioritaets_index` (`sort=rating`) |
| E6 | Menü | **Manuell** über `menu_order`, **alle** `website`-Docs |
| E7 | Homepage | **Eine Library = ganze Site**: Root `/` IST die Landingpage |
| E8 | Performance | **Quick-Wins zuerst** (Caching/Header/`next/image`), RSC später |

## 3. Soll-Zustand

Webseite = Dokument vom Typ `website`. Wiederverwendet unverändert:

- **detailViewType-Registry** als Erweiterungspunkt
  (`src/lib/detail-view-types/registry.ts:31`).
- **MarkdownPreview** für Body + Bildauflösung (relative Pfade →
  Storage-Streaming-URL).
- **Capture→Inbox→Promotion** wie jedes Dokument (ADR 0004).
- **Wizard-Import von URL** wie beim Session-Import (Secretary).
- **Öffentliche Docs-API** (anonym) für Banner/Menü (§6/§7).

## 4. Datenmodell (flach, snake_case, AGENTS-konform)

Frontmatter trägt nur **skalare** Hero-/Meta-Felder. Sektionen + ihr Layout
leben im Markdown-Body (E1) — kein verschachteltes Frontmatter (AGENTS-Regel).

```yaml
---
detailViewType: website
title: Oldies for Future
hero_subtitle: Wir solidarisieren uns mit jungen Menschen für eine lebenswerte Zukunft.
hero_image: images/oldies-for-future-headimage-2_web.jpg
video_url: https://peertube.uno/videos/embed/XXXX   # optional (PeerTube/YouTube/Vimeo)
language: de
cta_label: Jetzt mitmachen
cta_url: https://…/kontakt
menu_order: 1                    # Position im dynamischen Menü (E6)
prioritaets_index: 90            # steuert Side-Banner-Ranking (E5)
source_url: https://oldiesforfuture.it   # Import-Herkunft (Provenienz)
---
```

Die Startseite wird **nicht** im Frontmatter markiert, sondern über ein
**Library-Config-Feld** (E2), das auf die `fileId`/`slug` des
Startseiten-Dokuments zeigt (Checkliste: `library-config-field.mdc`).

## 5. Body & Sektions-Konvention (E1)

### 5.1 Sektions-Mapping (Beispiel „Oldies for Future")

~80 % ist sauber abbildbarer Inhalt; „Chrome" (Nav, Cookie-Banner, Parallax,
Animationen) entfällt bewusst.

| Quelle (HTML)                  | Ziel im Dokument                    |
| ------------------------------ | ----------------------------------- |
| `<title>` / `<meta desc>`      | `title` / `hero_subtitle`           |
| Erstes Cover-Bild              | `hero_image`                        |
| Vimeo-Embed                    | `video_url` (→ PeerTube)            |
| `h2` + `<p>` + Sektions-Bild   | eine Sektion (s. u.)                |
| Zitat-Block                    | Markdown-Blockquote                 |
| CMS-Blogliste                  | Side-Banner aus Galerie (§6)        |

### 5.2 Leichte Sektions-Konvention

Sektionen werden im Body durch **HTML-Kommentar-Marker** abgegrenzt (valide in
Markdown, in Obsidian unsichtbar, parser-unabhängig — kein neuer
Markdown-Parser nötig). Der `website`-Renderer splittet den Body an den Markern,
rendert den **inneren Markdown** je Sektion über `MarkdownPreview` und vergibt
Layout-/Hintergrund-Klassen:

```markdown
<!-- section layout=image-right bg=light -->
## Wer sind wir?
![Gruppenfoto](images/IMG-20230419-WA0003.jpg)

Wir „Oldies for Future" wollen uns mit den jungen Menschen solidarisieren …
<!-- /section -->

<!-- section layout=text-only bg=dark -->
> Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.
> — Marie von Ebner-Eschenbach
<!-- /section -->
```

- `layout` ∈ `image-left | image-right | full-image | text-only`
- `bg` ∈ `default | light | dark | brand`
- Body ohne Marker = eine einzige Default-Sektion (Rückwärts-Robustheit).
- Ungültige Direktive → **sichtbarer Hinweis** in Editor/Vorschau, kein Silent
  Fallback (`no-silent-fallbacks.mdc`).

## 6. Side-Banner: wichtigste Dokumente + CTA zur Galerie (E5)

**Kein neues Backend.** Die öffentliche Docs-API liefert es anonym:

- `GET /api/chat/[libraryId]/docs?sort=rating&limit=5` → nach
  `docMetaJson.prioritaets_index` sortiert (öffentlich, `docs/route.ts:34-35`),
  anonym nutzbar bei öffentlicher Library (`docs/route.ts:75`; Middleware
  erlaubt anonyme GETs, `src/middleware.ts:124-138`).

Neue Komponente `latest-documents-banner.tsx`: rendert N Teaser über die
vorhandene `DocumentCard` (`gallery/document-card.tsx`) + Button „mehr Inhalte"
→ Galerie-Mode (`setMode('gallery')`). Thumbnail/Meta aus `DocCardMeta`
(`coverThumbnailUrl`, `prioritaets_index`, `src/lib/gallery/types.ts`).
*N (Default 5) ist noch zu fixieren — siehe §10.*

## 7. Dynamisches Menü aus `website`-Dokumenten (E6)

Der `detailViewType`-Filter existiert serverseitig und ist gegen die Registry
validiert (`docs/route.ts:84-88,118-121`):

- `GET /api/chat/[libraryId]/docs?detailViewType=website` → **alle**
  Webseiten-Dokumente, anonym. Sortierung im Frontend nach `menu_order`.

Das Menü erscheint auf **Home, Galerie und Story** (Modi `gallery|story|site`
in `gallery-root.tsx`); jeder Eintrag → `openDocumentBySlug()`. `menu_order`
fehlt → ans Ende sortieren (sichtbar, kein stilles Verschlucken).

## 8. Video, Wizard-Import, Speicherung

- **Video (PeerTube):** Feld `video_url`, Embed-Muster aus `EventSummary`
  (`src/components/event-summary.tsx:35-47`). **Gap:** `isSafeVideoIframeSrc`
  (`src/lib/media/safe-video-iframe.ts:18-22`) kennt nur YouTube/Vimeo/mp4/webm
  → PeerTube-Hosts whitelisten (hilft Events sofort mit).
- **Wizard-Import:** bestehender URL-Flow (Secretary), siehe
  `docs/_analysis/website-import-session-feature-map.md`. Website-Template
  liefert `{title, hero_subtitle, hero_image, video_url, sections, quote, cta}`;
  `mapStructuredDataToWebsite()` baut Frontmatter + Body mit Sektions-Markern;
  Bilder werden als Dokument-Medien gespeichert.
- **Speicherung:** Capture→Inbox→Promotion wie jedes Dokument (ADR 0004,
  `src/lib/submissions/promotion.ts`).

## 9. Public-Rendering, Root & Homepage (E7)

**Eine Library = ganze Site.** Root `/` rendert die Landingpage **der**
designierten Library (Auswahl über globale Konfiguration/Env, z. B.
`ROOT_LIBRARY_SLUG`, bzw. Single-Tenant-Deployment pro Library). `/` zeigt das
über E2 markierte `website`-Startseiten-Dokument (Hero + Sektionen + Video +
Side-Banner + Menü + CTA).

Folge: Die heutige Library-Listen-Homepage (`src/app/page.tsx` →
`home-client.tsx` / `library-grid.tsx`) wird für die öffentliche Ansicht
abgelöst (bei Bedarf als interne Index-/Admin-Route erhalten). Mehrere
publizierte Libraries entsprechen mehreren Deployments/Domains.
*Annahme zu bestätigen: pro Library ein eigenes Deployment.*

## 10. Ladezeit & UX (E8 — Quick-Wins zuerst)

Routen sind bereits öffentlich (`/`, `/explore(.*)`, `/api/public(.*)` in
`src/middleware.ts:36-49`); Daten-APIs anonym cachebar
(`/api/public/libraries/[slug]` `revalidate=60`; `/api/markdown`
`Cache-Control: public, max-age=3600, stale-while-revalidate`).

**Bremser (verifiziert):** `explore/[slug]/page.tsx` ist `"use client"`
(Zeile 1), wartet auf `useUser()` (Zeile 6), lädt Galerie `ssr:false`
(Zeile 17-18) + `cache:'no-store'` → kein Initial-HTML, blockiert auf Clerk.

**Quick-Wins zuerst:** explizite `Cache-Control: public, s-maxage=…` auf den
public-APIs; `revalidate` + ggf. `generateStaticParams`; `next/image` (Hero mit
`priority` fürs LCP) statt CSS-`background-image`; Clerk auf dem öffentlichen
Pfad nicht initialisieren. **RSC-Umbau** (Landingpage als Server-Component mit
Client-Islands) als **späterer** Schritt.

**UX:** CTA above-the-fold, kein Layout-Shift (feste Bildmaße), Lazy-Load
below-the-fold, SEO via `generateMetadata` (aus `title`/`hero_subtitle`),
WCAG 2.1 (Alt-Texte, Tastatur, Kontrast).

## 11. Abkündigung `web/`-Snapshot (E4 — sofort ersetzen)

Zu entfernen/abklemmen (eigener, isolierter Cleanup-Schritt):

- Routen: `src/app/api/library/[libraryId]/publish-site/route.ts`,
  `…/depublish-site/route.ts`, `…/web/[...path]/route.ts`.
- Explore-Site-Tab + Snapshot-Logik in `src/app/explore/[slug]/page.tsx`.
- Obsolete Config-Felder in `src/types/library.ts`: `siteEnabled`,
  `sitePublished`, `siteUrl`, `siteVersion`, `sitePublishedAt`.
- Settings-UI-Teile in `src/components/settings/public/public-form.tsx`.
- **Behalten:** `slugName`, `publicName`, `isPublic`, `gallery`, `story` (E3).

## 12. Implementierungs-Checkliste

1. Registry: `'website'` zu `DETAIL_VIEW_TYPES` + Eintrag (required `title`;
   optional `hero_subtitle`, `hero_image`, `video_url`, `cta_label`, `cta_url`,
   `menu_order`, `prioritaets_index`) — `detail-view-types/registry.ts`.
2. Mapper `mapToWebsiteDetail()` — `src/lib/mappers/doc-meta-mappers.ts`.
3. Sektions-Parser (HTML-Kommentar-Marker) + `website-detail.tsx` (Hero +
   Sektionen via MarkdownPreview + Video + CTA).
4. Renderer-Case in `detail-view-renderer.tsx`; optional Galerie-Card.
5. i18n-Labels; PeerTube in `isSafeVideoIframeSrc` whitelisten.
6. Import: Website-Template + `mapStructuredDataToWebsite` + Wizard-Source
   „Website-URL".
7. Library-Config-Feld „Startseiten-Dokument" (E2, `library-config-field.mdc`).
8. `latest-documents-banner.tsx` (E5, `sort=rating`) + dynamisches Menü (E6).
9. Root `/` rendert Landingpage der designierten Library (E7).
10. Performance Quick-Wins (E8): Cache-Header, `next/image`, ISR.
11. `web/`-Abkündigung (E4, §11) als separater Cleanup.

## 13. Verbleibende Detailfragen

- N für den Side-Banner (Default 5?) und ob „Galerie"-Button zur gefilterten
  oder vollen Galerie führt.
- Genaue erlaubte Werte/Validierung der Sektions-Direktiven (§5.2).
- Mechanismus zur Auswahl der Root-Library (Env vs. globale Einstellung, E7).
- Reihenfolge der Implementierung: Vorschlag, **Renderer + Datenmodell**
  (Schritte 1–4) zuerst, dann Import, dann Banner/Menü/Root, dann Cleanup.

## 14. Bewusste Abgrenzung (kein 1:1-Klon)

Nicht abgebildet: eigenes CSS/JS, Scroll-/Lottie-Animationen, Parallax,
Cookie-Consent, mehrseitige Navigation, interaktive Widgets. Gewinn:
durchsuchbar, RAG-fähig, übersetzbar, galerie-integriert, ein Speicherort statt
drei, ein Publish-Begriff, schneller login-freier Render.
