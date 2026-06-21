# Konzept: Landingpage-Vereinfachung über `detailViewType: website`

> Status: Konzept / Diskussionsgrundlage. Noch keine Implementierung.
> Branch: `claude/relaxed-mendel-fhwj8r`. Datum: 2026-06-21.
> Voraussetzung: A0-Feld-Contract + `detail-view-types`-Registry (auf `master`).

## 1. Ziel

Eine veröffentlichte Library soll wie eine Webseite mit Landingpage wirken. Das
heutige Feature (HTML-Snapshot im Ordner `web/` → Azure) ist zu kompliziert:
drei Speichersysteme, kein Editor, zwei Publish-Begriffe, Inhalt steht außerhalb
des Dokumentmodells (nicht durchsuchbar, kein RAG, keine Übersetzung).

**Idee:** Eine Webseite wird wie **jedes andere Dokument** behandelt — ein
Markdown-Dokument mit flachem Frontmatter und eingebetteten Bildern, gerendert
über einen neuen `detailViewType: website`. So entsteht am Ende eine
Markdown-Seite mit Sektionen (Hero mit Titel/Subtitel, Inhalts-Sektionen,
Zitat, CTA), die über den bestehenden Wizard importiert und über die bestehende
Capture→Inbox→Promotion-Pipeline publiziert wird.

## 2. Ist-Zustand (Kurzfassung, Details siehe Recherche)

- Datenmodell: `Library.config.publicPublishing` in MongoDB
  (`src/types/library.ts:426-489`) — Meta/Texte + `siteUrl`/`siteVersion`.
- Startseite: rohe HTML/CSS/JS im Storage-Ordner `web/`, beim Publish rekursiv
  als versionierter Snapshot nach Azure (`src/app/api/library/[libraryId]/publish-site/route.ts`).
- Öffentliche Anzeige: `/explore/[slug]` rendert iframe auf die Azure-URL
  (`src/app/explore/[slug]/page.tsx`).
- Komplexitäts-Treiber: 3 Speichersysteme, kein Editor, `isPublic` ≠
  `sitePublished`, Gating-Logik über 4 Dateien, kein Rollback, Inhalt nicht im
  Dokumentmodell.

## 3. Soll-Zustand

Webseite = Dokument vom Typ `website` in der Library. Es nutzt unverändert:

- **detailViewType-Registry** als Erweiterungspunkt
  (`src/lib/detail-view-types/registry.ts:31`).
- **MarkdownPreview** für Body + Bildauflösung (relative Pfade →
  Storage-Streaming-URL).
- **Capture→Inbox→Promotion** wie jedes Dokument (ADR 0004).
- **Wizard-Import von URL** wie beim Session-Import (Secretary).

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
source_url: https://oldiesforfuture.it             # Import-Herkunft (Provenienz)
---

## Wer sind wir?
![Gruppenfoto](images/IMG-20230419-WA0003.jpg)

Wir „Oldies for Future" wollen uns mit den jungen Menschen solidarisieren …

## Warum machen wir das?
![](images/oldies-for-future-warum_web.jpg)

Das gegebene kapitalistische Wirtschaftssystem …

> Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.
> — Marie von Ebner-Eschenbach
```

Felder folgen bestehenden Konventionen: `video_url`, `coverImageUrl`, `title`
existieren bereits (`src/lib/detail-view-types/registry.ts:223`,
`src/components/settings/FacetDefsEditor.tsx:24`).

## 5. Sektions-Mapping (analysierte Beispielseite „Oldies for Future")

Die analysierte Webflow-Seite hat folgende Struktur. ~80 % ist sauber
abbildbarer Inhalt, der Rest ist „Chrome" (Layout/Animationen), der bewusst
entfällt.

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
| CMS-Blogliste „Visionäre Geschichten"| aus Galerie speisen (separat)         |

## 6. Video: PeerTube über `video_url` (Wiederverwendung Event-Muster)

Events tragen Video bereits als `video_url` (Templates extrahieren
PeerTube-Embed-URLs, z. B. `https://peertube.uno/videos/embed/…`,
`template-samples/event-creation-de.md:20,124`). Das Embed-Muster ist
einsatzbereit in `EventSummary` (`src/components/event-summary.tsx:35-47`):
iframe mit `aspect-video`, `sandbox`, `loading="lazy"`, Fallback auf Cover.

**Gap (zu schließen):** Die Render-Whitelist `isSafeVideoIframeSrc`
(`src/lib/media/safe-video-iframe.ts:18-22`) kennt nur YouTube/Vimeo/mp4/webm.
PeerTube-Hosts fehlen → PeerTube-`video_url` wird heute (auch bei Events) nicht
eingebettet, sondern fällt auf das Cover zurück.

→ **Aktion:** PeerTube-Host(s) in `isSafeVideoIframeSrc` aufnehmen (z. B. Pfad
`/videos/embed/` als Heuristik oder konfigurierbare Host-Allowlist). Davon
profitieren Events sofort mit. Der `website`-Renderer nutzt anschließend exakt
das `EventSummary`-Embed-Muster.

## 7. Wizard-Import (URL → Dokument)

Wiederverwendung des bestehenden Website-Import-Flows (Sessions), siehe
`docs/_analysis/website-import-session-feature-map.md`:

1. Nutzer gibt URL ein → `POST /api/secretary/import-from-url`
   (`src/app/api/secretary/import-from-url/route.ts`).
2. Secretary extrahiert mit einem **Website-Template** (analog
   `ExtractSessionDataFromWebsite`) `structured_data`:
   `{ title, hero_subtitle, hero_image, video_url, sections: [{heading, body, image}], quote, cta }`.
3. Mapper `mapStructuredDataToWebsite()` baut **flaches Frontmatter** + Body
   (Sektionen → Markdown). Bilder werden heruntergeladen und als
   Dokument-Medien gespeichert (responsive `-p-500/-800`-Varianten und
   decorative SVGs ignorieren).
4. Ab hier identisch zu jedem Dokument: Capture → Inbox → Promotion.

## 8. Speicherung & Publikation (unverändert)

- Capture schreibt nie in den Ziel-Provider, sondern in die Inbox
  (MongoDB + Azure Blob), ADR 0004.
- Promotion schreibt die `.md` + kopiert Medien in den Ziel-Ordner und
  indexiert für RAG (`src/lib/submissions/promotion.ts`).
- Eine Library kann ein `website`-Dokument als **Startseite** markieren
  (siehe Entscheidung E2), das `/explore/[slug]` statt des Azure-iframes rendert.

## 9. Public-Rendering

`/explore/[slug]` rendert künftig das als Startseite markierte
`website`-Dokument über den `detailViewType: website`-Renderer (Hero +
Markdown-Body + Video + CTA), statt iframe auf Azure. Der `web/`-Snapshot-Pfad
wird damit ablösbar (Migration/Abkündigung separat).

## 10. Implementierungs-Checkliste

Folgt dem etablierten „neuer detailViewType"-Muster:

1. `DETAIL_VIEW_TYPES` um `'website'` erweitern + Registry-Eintrag
   (requiredFields: `title`; optional: `hero_subtitle`, `hero_image`,
   `video_url`, `cta_label`, `cta_url`; translatable: title/hero_subtitle/body)
   — `src/lib/detail-view-types/registry.ts`.
2. Mapper `mapToWebsiteDetail()` — `src/lib/mappers/doc-meta-mappers.ts`.
3. Detail-Komponente `website-detail.tsx` (Hero + MarkdownPreview + Video-Embed
   + CTA) — analog `EventSummary`.
4. Renderer-Case in `src/components/library/detail-view-renderer.tsx`.
5. Galerie-Card (optional eigenes Layout) in
   `src/components/library/gallery/document-card.tsx`.
6. i18n-Labels (`gallery.detailViewTypeWebsite…`).
7. PeerTube in `isSafeVideoIframeSrc` whitelisten (Querschnitt, hilft Events).
8. Import: Website-Extraktions-Template (Secretary) +
   `mapStructuredDataToWebsite` + Wizard-Source „Website-URL".
9. Public-Rendering auf `/explore/[slug]` auf das Startseiten-Dokument umstellen.

## 11. Offene Entscheidungen

- **E1 — Sektions-Layout:** Empfehlung „maximal einfach": reiner Markdown-Body,
  der Renderer vergibt ein konsistentes Layout (z. B. Bild-Position automatisch
  alternierend nach Reihenfolge — kostet **kein** Frontmatter-Metadatum). Optional
  später: leichte Sektions-Konvention im Body. *Zu bestätigen.*
- **E2 — Startseite-Markierung:** Ein Flag pro Dokument
  (`is_landing_page: true`) oder ein Library-Config-Feld, das auf eine
  `fileId`/`slug` zeigt? Empfehlung: Library-Config-Feld (ein eindeutiges
  Startseiten-Dokument), siehe `library-config-field.mdc`.
- **E3 — `publicPublishing.gallery/story`-Texte:** Werden Headline/Subtitle aus
  MongoDB durch das Startseiten-Dokument abgelöst oder bleiben sie für die
  Galerie-Ansicht erhalten?
- **E4 — Migration `web/`-Snapshot:** Bestehende veröffentlichte Sites parallel
  weiter unterstützen oder mit Konverter ins neue Modell überführen?

## 12. Bewusste Abgrenzung (kein 1:1-Klon)

Nicht abgebildet werden: eigenes CSS/JS, Scroll-/Lottie-Animationen, Parallax,
Cookie-Consent, mehrseitige Navigation (kontakt/impressum/privacy), interaktive
Widgets. Gewinn der Vereinfachung: durchsuchbar, RAG-fähig, übersetzbar,
galerie-integriert, ein Speicherort statt drei, ein Publish-Begriff.
