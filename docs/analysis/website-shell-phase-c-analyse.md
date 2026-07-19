# Analyse: Website-Shell Phase C — Logo, Kontakt, Fusszeile, Pflege, Mehrsprachigkeit

> Status: ENTSCHIEDEN (2026-07-19, siehe §4) — bereit fuer Umsetzung ab C1.
> Kontext: Landingpage „Oldies for Future" (detailViewType `website`) laeuft auf
> `oldiesforfuture.org` (Variante B, host-gemappt). Phase A+B (Original-Treue,
> Sektionen, Video, TopNav-Modi, Domain-Kopplung) sind auf `master`.
> Verbindlicher Contract: `.cursor/rules/website-landingpage.mdc`.

## 0. Offene Punkte (User-Anforderung)

1. **Logo** oben links in der TopNav (hoeher als die Leiste, ueberlappt den
   Folge-Abschnitt; Menue rueckt nach rechts).
2. **„Jetzt mitmachen"-Buttons** → eigene Kontakt-Seite (Vorlage:
   `template-samples/oldiesforfuture-original/Oldies For Future - Kontakt.html`),
   „Kontakt" als letzter Menuepunkt.
3. **Fusszeile** der Website: eigene, dynamisch angehaengte „Webseite" mit Links
   auf Impressum/Datenschutz. Zusaetzlich: Der **KnowledgeScout-Footer muss auf
   der Domain ersetzt/unterdrueckt** werden (rendert dort aktuell weiter).
4. **Pflege im Frontend** (Settings → Public): Homepage-Doc, Menue-Zuordnung,
   Footer-Doc, Logo.
5. **Mehrsprachigkeit**: Werden uebersetzte Websites in der Nutzersprache geladen?

## 1. Ist-Stand (recherchiert)

### 1.1 KnowledgeScout-Fusszeile
- `src/components/home/conditional-footer.tsx` blendet sich nur auf
  `/library/gallery*` und `/explore/*` aus — auf `/` rendert er IMMER,
  auch auf der host-gemappten Domain-Root (Bug bestaetigt, Screenshot User).
- Er wird im RootLayout NEBEN `AppLayout` gerendert und kennt weder Host noch
  `rootLandingSlug`.

### 1.2 Original-Kontaktseite (Webflow)
- Hero: Eyebrow „jetzt mitmachen" + Text „Wir informieren dich regelmaessig
  ueber unsere Aktionen. Bringe deine Ideen mit ein!"
- Formular `Lang Form`: `Name` (required), `Nachname`, `Email` (required),
  `Nachricht` (textarea), Newsletter-Checkbox, Privacy-Checkbox (required),
  Submit „senden", Success-/Error-Meldung.
- Mailjet-ENV existiert bereits in der App (Versand-Infrastruktur vorhanden).

### 1.3 Uebersetzungs-Pipeline
- Registry-`translatable` fuer `website`: `title`, `hero_subtitle`, `cta_label`
  (gallery+detail), `markdown` (detail), `tags`.
- Ablage: `docMetaJson.translations.{gallery|detail}.{locale}.{feld}`;
  `WebsiteLandingLive` laedt mit `x-locale`-Header und overlayt via
  `localizeDocMetaJson(json, locale, fallbackLocale)` → **JA, uebersetzte
  Websites werden automatisch in der Nutzersprache geladen, wenn die
  Uebersetzung existiert** (Sprachwahl: LanguageSwitcher → Cookie → Middleware).
- Uebersetzungen entstehen NUR ueber den Publish-Flow
  (`POST …/docs/publish` → `enqueueTranslationJobsForLocales`; UI-Button
  „Re-Translate"). Direkt in Mongo geschriebene Seed-Docs haben KEINE
  Uebersetzungen und loesen keine aus.
- **Luecke:** Kein Test/Guard, dass die Sektions-Marker
  (`<!-- section … -->`) eine Uebersetzung des `markdown` ueberleben.

### 1.4 Settings → Public heute
- Felder: slugName, publicName, description, icon (Lucide-Auswahl), Switches
  (isPublic, requiresAuth, siteEnabled, showOnHomepage),
  `backgroundImageUrl` (reines URL-Textfeld), Gallery-Texte. KEIN Datei-Upload.
- Wiederverwendbarer Upload existiert: `POST /api/creation/upload-image`
  → `AzureStorageService.uploadImage` (Auth + X-Library-Id) — als Muster fuer
  einen Logo-Upload geeignet.

### 1.5 TopNav / Logo-Platz
- Bar: `fixed`, `h-16`, KEIN `overflow-hidden` → ein hoeheres, ueberlappendes
  Logo ist moeglich (absolute Positionierung, z-Index ueber der Bar, Inhalt
  darunter wird ueberlagert wie in der Webflow-Vorlage).
- Einfuegepunkt: links vor den `publicNavItems` (nach dem Mobile-Hamburger).

### 1.6 Menue-Metadaten
- `menu_order` fliesst bereits durch: Mongo-Projektion (`vector-repo.ts`) →
  `doc-meta-formatter.ts` → `DocCardMeta` → `website-landing-live.tsx`.
- Neue flache Frontmatter-Felder (z.B. `menu_area`) muessen an denselben
  4 Stellen durchgereicht werden.

## 2. Konzept & Empfehlungen

### 2.1 Navigations-Modell: dokumentgetrieben (Empfehlung)
Die Website wird ueber die website-Dokumente selbst gepflegt (flaches,
Obsidian-kompatibles Frontmatter — Repo-Regel), NICHT ueber eine separate
Settings-Struktur. Neue flache Felder:

| Feld | Werte | Bedeutung |
|------|-------|-----------|
| `menu_order` | Zahl | (existiert) Reihenfolge im Menue; kleinster Wert = Homepage (E2-Interim) |
| `menu_area` | `main` (Default) \| `footer` \| `hidden` | Wo das Doc verlinkt wird |
| `site_role` | `page` (Default) \| `footer-content` | `footer-content`: Sektionen dieses Docs werden als Website-Fusszeile unter JEDER Seite gerendert |

- „Kontakt" = website-Doc mit hohem `menu_order` → letzter Menuepunkt.
- „Impressum"/„Datenschutz" = `menu_area: footer` → nicht im Top-Menue,
  verlinkt in der Fusszeile.
- Fusszeilen-INHALT (#oldiesforfuture, Claim, Links) = eigenes Doc mit
  `site_role: footer-content` → „dynamisch angehaengte Webseite" (User-Wunsch).

**Voraussetzung: Deep-Link zwischen Website-Seiten.** Das Menue wechselt heute
per React-State (`setSelectedFileId`) — es gibt keine verlinkbare URL pro
Website-Seite. Neuer Query-Param `?site=<slug|fileId>` in `WebsiteLandingLive`
(nuqs/searchParams): macht jede Website-Seite verlinkbar (CTA → Kontakt,
Footer → Impressum) und funktioniert identisch auf Domain-Root und
`/explore/<slug>`.

### 2.2 Fusszeile (zwei Teile)
1. **KS-Footer unterdruecken** auf der Domain-Root: `ConditionalFooter` erhaelt
   dieselbe Host-Entscheidung wie das Layout (Prop `rootLandingSlug` vom
   RootLayout bzw. gemeinsamer Wrapper). Auf `/explore/*` ist er bereits aus.
2. **Website-Footer rendern**: `WebsiteLandingLive` laedt das
   `site_role: footer-content`-Doc (gleicher Docs-Fetch, Filter clientseitig)
   und rendert dessen Sektionen unter dem Banner — auf jeder Website-Seite.
   Links im Footer-Markdown zeigen auf `?site=impressum` etc.

### 2.3 Logo
- Neues Per-Library-Feld `publicPublishing.logoUrl` (Checkliste
  `library-config-field.mdc` + Public-API-Payloads + Explore-Payload).
- Stufe 1: URL-Textfeld in Settings → Public (analog `backgroundImageUrl`);
  Bild liegt im oeffentlichen Blob (`…/website/images/`, mirror-Skript oder
  manuell).
- Stufe 2 (Komfort): Upload-Button nach Muster `POST /api/creation/upload-image`.
- Anzeige: TopNav im Site-Kontext (exploreContext ODER Domain-Root):
  Logo links, `absolute`, Hoehe > 64px, `z-50+`, ueberlappt den Inhalt;
  Nav-Items ruecken per Platzhalter-Breite nach rechts. Fallback ohne Logo:
  aktueller Zustand.

### 2.4 Kontakt-Seite mit Formular (ENTSCHIEDEN: echtes Formular + Mailjet)
- Neues Sektions-Layout `contact-form` (generisch, wie `video`):
  Marker `<!-- section layout=contact-form -->`, Felder wie Original
  (Name*, Nachname, Email*, Nachricht, Newsletter, Privacy*).
- **Empfaenger-Adresse dokumentgetrieben**: flaches Frontmatter-Feld
  `contact_email` im Kontakt-Doc (KEIN Settings-Feld). Die Contact-API liest
  es serverseitig aus dem Meta-Doc. Fehlt `contact_email`, ist das Formular
  deaktiviert mit klarem Hinweis (kein stiller Fallback auf Owner-Email).
  Hinweis: Das Feld ist damit — wie eine Impressums-Adresse — oeffentlich
  im Doc sichtbar; fuer Oldies unkritisch (info@… steht ohnehin im Impressum).
- Neue oeffentliche API `POST /api/public/libraries/[slug]/contact`
  (Rate-Limit, Honeypot), Versand via vorhandener Mailjet-ENV.
- CTA `cta_url` der Home zeigt auf `?site=kontakt`.

### 2.5 Pflege in Settings → Public (Stufe 2, optional)
ENTSCHIEDEN: Pflege ist DOKUMENTGETRIEBEN (Frontmatter der website-Docs),
nicht in Settings. Einzige Settings-Ausnahme: `logoUrl` (Per-Library-Feld,
§2.3), weil das Logo kein Dokument ist. Eine spaetere Komfort-UI „Website"
(C5) bleibt optional und aendert nur dieselben Frontmatter-Felder.

### 2.6 Mehrsprachigkeit — Antwort & Restarbeiten
**Antwort: Ja** — die Anzeige-Seite ist fertig (x-locale + Overlay). Offen:
1. **Marker-Guard**: Unit-/Integrationstest „Sektions-Marker + Bild-URLs
   ueberleben die Uebersetzung von `markdown`" (Konzept-Guard, nie gebaut).
2. **Uebersetzungen erzeugen**: Seed-Docs einmal durch den Publish-/
   Re-Translate-Flow schicken (Library braucht `translations.targetLocales`,
   z.B. `["it", "en"]`). Direkter Mongo-Write erzeugt keine Uebersetzungen.
3. Menue-Labels uebersetzen sich mit (`title` ist translatable).

## 3. Phasenvorschlag (Aufwand grob)

| Phase | Inhalt | Aufwand |
|-------|--------|---------|
| C1 | `?site=`-Deep-Link + `menu_area`/`site_role` durchreichen + Website-Footer rendern + KS-Footer auf Domain-Root aus | mittel |
| C2 | Logo: Feld + Settings (URL) + TopNav-Anzeige | klein–mittel |
| C3 | Kontakt: `contact-form`-Sektion + Contact-API (Mailjet) + Kontakt-Doc + CTA-Verlinkung | mittel |
| C4 | i18n: Marker-Guard-Test, targetLocales setzen, Re-Translate ausloesen, verifizieren | klein–mittel |
| C5 | Settings-Komfort-UI „Website" (Menuepflege, Upload) | mittel |

Empfohlene Reihenfolge: **C1 → C2 → C3 → C4**, C5 nach Bedarf.

## 4. Entscheidungen (User, 2026-07-19)

1. **Pflege dokumentgetrieben** (Frontmatter der website-Docs). Settings-UI
   (C5) optional/spaeter. ✓
2. **Kontakt: echtes Formular + Mailjet.** Empfaenger-Adresse als flaches
   Frontmatter-Feld `contact_email` im Kontakt-Doc (dokumentgetrieben). ✓
3. **Footer-Modell bestaetigt**: eigenes Doc mit `site_role: footer-content`
   (Inhalt als Markdown-Sektionen) + `menu_area: footer` fuer Impressum/
   Datenschutz. Zusaetzlich KS-Footer auf der Domain-Root unterdruecken. ✓

Startpunkt der Umsetzung: **C1** (neue Session).
