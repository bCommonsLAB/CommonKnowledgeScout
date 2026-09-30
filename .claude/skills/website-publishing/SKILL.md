---
name: website-publishing
description: Website-Seiten einer Library über die KnowledgeScout-MCP-Brücke anlegen, prüfen und publizieren (dokument_publizieren, dokument_felder_setzen, bild_veroeffentlichen, veroeffentlichung_setzen, seite_pruefen) und die Website-/Galerie-Einstellungen (Galerie-Texte, Logo, Hintergrundbild) sinnvoll füllen. Verwende diesen Skill, wenn der Benutzer eine Website oder Landingpage für eine Library erstellen, Seiten publizieren, Fokus-Tags setzen, Website-Inhalte, Galerie-Texte, Logo oder Hintergrundbild einrichten oder verbessern will — oder alle öffentlichen Libraries auf die Blob-Bild-Konvention umstellen möchte.
---

# Website-Publishing: Inhalte einer öffentlichen Library füllen

Stand 27.09.2026, Werkzeugsatz 2.36.0. Original im Archiv unter
`Organisation/Skills/website-publishing/SKILL.md`; diese Datei ist die
Repo-Kopie und wird nach dem Original nachgezogen.

Ziel: Die Felder unter **Einstellungen → Veröffentlichung** (Galerie-Texte,
Website-Logo-URL, Hintergrundbild-URL, Icon) für eine Library passend zu ihrem
Inhalt befüllen — und die Website-Seiten der Library anlegen, prüfen und
publizieren (Abschnitt am Ende).

## Grundregeln (nicht verhandelbar)

1. **Kein Library-Inhalt ins Repository.** Texte, Bildnamen, IDs und URLs einer
   Library gehören in MongoDB/Blob — niemals in Git-Dateien, auch nicht in
   Beispiel- oder Doku-Form.
2. **Erst vorschlagen, dann speichern.** Alle Textentwürfe dem User zeigen und
   absegnen lassen, bevor irgendetwas persistiert wird.
3. **Bild-URLs müssen anonym ladbar sein.** Storage-Links (Nextcloud/OneDrive)
   sind auth-gegated und funktionieren NICHT. Blob-Konvention:
   `https://<account>.blob.core.windows.net/knowledgescout/<library-id>/website/images/<datei>`
4. **MongoDB nur lesend** für Analyse. Settings schreibt `veroeffentlichung_setzen`
   (dieselbe Validierung wie das Formular Einstellungen → Veröffentlichung;
   nur Owner, nie den API-Schlüssel) oder das Formular selbst.

## Ablauf

### Schritt 1 — Library identifizieren

- In Cowork: `bibliotheken_auflisten` (Id und Name), dann
  `veroeffentlichung_lesen` (öffentlich, Slug, siteEnabled, Logo, Galerie-Texte)
  und `seite_pruefen` (publizierte Seiten mit Befunden).
- Mit Datenbankzugang: Library-ID, Slug und Owner-Email aus der Collection
  `libraries`, read-only (`config.publicPublishing.slugName`, `.isPublic`).
  **DB-Wahl explizit klären:** Prod-DB heißt `common-knowledge-scout-prod`.
- Für „alle öffentlichen Libraries": alle mit `config.publicPublishing.isPublic: true`
  auflisten und einzeln (mit User-Freigabe pro Library) durchgehen.

### Schritt 2 — Inhalt analysieren

- Stichprobe aus der Docs-Collection der Library lesen (Titel, Themen, Sprache,
  Zielgruppe) — read-only.
- Live-Ansicht ansehen: `/explore/<slug>` im Browser-Panel öffnen (Galerie und
  ggf. Website-Landingpage), um Ton und vorhandene Texte zu erfassen.

### Schritt 3 — Galerie-Texte entwerfen

Vier Felder, in der Sprache der Library, konkret statt generisch:

| Feld | Zweck |
|---|---|
| Überschrift | Was Besucher hier entdecken (z. B. worum die Sammlung geht) |
| Untertitel | Einladung/Nutzen in einem Satz |
| Einleitung | 2–3 Sätze: Was gibt es, wie navigiert man, Hinweis auf Story-/Frage-Modus |
| Filter-Erklärung | Wie die Themenfilter helfen |

Semantik: **Leeres Feld = eingebaute Standard-Texte.** Nur füllen, was besser
als der Standard ist. Entwürfe dem User zur Freigabe vorlegen (Regel 2).

### Schritt 4 — Bilder in den Blob legen

1. User legt kuratierte Bilder (Logo, Hintergrund, Hero, Sektionsbilder) im
   Library-Storage unter `web/images/` ab (Ordner ggf. anlegen).
2. Über die Brücke: `bild_veroeffentlichen` mit der `libraryId` (ohne weitere
   Angabe alle Bilddateien aus `web/images/`; `quellPfad` für eine Datei).
   Die Antwort nennt je Datei die anonyme URL; Nicht-Bilder (HTML, PDF)
   werden laut übersprungen, vorhandene Blobs nur mit `ueberschreiben: true`
   ersetzt. `bilder_auflisten` zeigt, was schon im Blob liegt.
3. Ohne Brücke (lokal): `node --import tsx scripts/mirror-website-images-to-blob.ts --user <owner-email> --library <library-id>`,
   braucht `AZURE_STORAGE_CONNECTION_STRING` in `.env`.
4. Die URLs für Logo-/Hintergrundbild-Feld, `hero_image` und
   Sektions-Bilder `![alt](url)` verwenden.

### Schritt 5 — Eintragen und verifizieren

- Freigegebene Werte mit `veroeffentlichung_setzen` eintragen: `gallery`
  (headline, subtitle, description, filterDescription, menuLabel,
  moreLinkLabel), `logoUrl`, `backgroundImageUrl`, `icon`; für die Website
  `siteEnabled: true`; zum Veröffentlichen `isPublic: true` mit `slugName`,
  `publicName` und `description` (Mindestlängen wie im Formular). Nur genannte
  Felder ändern sich, leere URL-Felder löschen. `isPublic: true` macht die
  Inhalte anonym lesbar — vorher ausdrücklich bestätigen lassen.
- **Design-Profil** (ab 2.36.0): `siteTheme` setzt Schriften, Akzent und
  Farben je Fläche der Website — siehe Schritt 4b im Abschnitt „Website-Seiten"
  unten. Ohne Profil rendert die Seite in der Gestaltung der Vorlage.
- Alternativ als Copy-Paste-Block für das Formular **Einstellungen →
  Veröffentlichung**.
- Verifizieren: `veroeffentlichung_lesen`, dann `/explore/<slug>` neu laden —
  Texte über der Galerie, Logo oben links in der Navigation (rendert nur bei
  gesetzter URL, Explore-Seite und eigene Domain). Bild-URLs zusätzlich in
  einem privaten/anonymen Kontext prüfen (müssen ohne Login laden).

## Stolperfallen

- Logo erscheint NUR im Site-Kontext (Explore-Slug oder gemappte Domain), nicht
  in der internen App-Ansicht.
- Der Landingpage-Renderer löst relative Bildpfade nicht auf — immer absolute
  Blob-URLs verwenden.
- `siteEnabled` steuert die Website-Landingpage am Slug; ohne dieses Flag gibt
  es nur die Galerie.


## Website-Seiten über die Brücke anlegen und publizieren (Werkzeugsatz 2.36.0)

Der Weg einer Website ohne App-Oberfläche. Muster: die Library „Oldies for
Future" (vier Dokumente in `Webseite/Seiten/`). Jede schreibende Aktion nur
nach Bestätigung durch den Menschen, mit `begruendung`. Vorher `bruecke_info`:
meldet sie eine Version unter 2.36.0, fehlen Werkzeuge oder Felder —
Erweiterung in den Einstellungen aus- und einschalten.

1. **Bestand lesen.** `seite_pruefen` mit der `libraryId`: zeigt, ob die
   Library öffentlich ist, ob `siteEnabled` gesetzt ist, welche Seiten
   schon publiziert sind und welche Befunde sie tragen.
2. **Seiten schreiben.** `ordner_anlegen` für `Webseite/Seiten` (falls
   fehlt), dann je Seite `datei_anlegen`:
   - Startseite: `detailViewType: "website"`, `title`, `language`,
     `targetLanguage`, `menu_order: 1`, Hero-Felder (`hero_subtitle`,
     `hero_image`, `hero_layout` mit `overlay`, `cover` oder `campaign`,
     `cta_label`, `cta_url`, optional `hero_title`, wenn die Hero-Überschrift
     vom Titel abweichen soll (`title` bleibt der Menüpunkt); bei `campaign` zusätzlich `hero_kicker`
     für die Kennzeile im Bild, `hero_title2` für die kursive Zweitzeile,
     `cta2_label`/`cta2_url` für den zweiten Button), Body als
     Sektionen `<!-- section layout=… bg=… kicker="…" --> … <!-- /section -->`
     (`kicker` = Versalzeile über der Überschrift, optional).
   - Kontakt: `menu_order` hoch, `slug`, `contact_email`, Sektion
     `layout=contact-form`.
   - Impressum: `menu_area: "footer"`.
   - Fußzeile: `site_role: "footer-content"`, `menu_area: "hidden"`.
   Erlaubte `layout`: image-left, image-right, full-image, text-only, video,
   contact-form, banner (Raster an dieser Stelle; ab Welle S1). Erlaubte `bg`: default, light, dark, brand, linen, mint,
   dark-green, neutral. Bild-URLs absolut aus dem Blob (Regel 3 oben):
   erst `bild_veroeffentlichen` (Schritt 4 oben), dann die URLs eintragen.
   Frontmatter flach, snake_case, keine verschachtelten Objekte.
   Welche Farbe hinter `bg=dark-green` oder `bg=light` liegt, entscheidet
   das Design-Profil (Schritt 4b) — die Namen sind Flächen, keine Farben.
   Blöcke innerhalb einer Sektion (ab Welle S3): `<!-- stats -->` gefolgt
   von einer Liste `- **600+** Maßnahmen` ergibt Kennzahl-Kacheln;
   `<!-- chips label="Träger & Partnernetzwerk" -->` gefolgt von einer Liste
   ergibt Chips; `<!-- box label="Bald" kind=card -->` … `<!-- /box -->`
   ergibt eine weiße Karte (`kind=note`: durchscheinender Hinweis-Streifen);
   ein Blockquote (`> …`) bekommt einen Randstreifen. Kacheln brauchen
   `**Wert**` am Zeilenanfang, sonst weist `seite_pruefen` die Seite ab.
3. **Publizieren.** `dokument_publizieren` mit `quellPfad` oder `sourceIds`
   (bis 30). Die Antwort nennt je Seite Warnungen (fehlende Felder,
   relative Bilder) und harte Fehler (ungültiger Marker). Warnungen erst
   beheben; nur wenn sie bewusst bleiben sollen, `trotzWarnungen: true`.
   Ein zweiter Aufruf nach einer Textänderung aktualisiert den Eintrag.
   Der Text bleibt unverändert — kein Sprachmodell (anders als
   `transformation_starten`).
4. **Auswahl markieren.** Soll das Banner eine kuratierte Auswahl zeigen,
   `dokument_felder_setzen` mit `sourceIds` der Dokumente und
   `listen: { tags: ["fokus"] }`; am Startseiten-Doc dann `banner_tag: "fokus"`,
   optional `banner_title` und `banner_limit` (3–12), und die Seite neu
   publizieren. `heading_case: "none"` schaltet die Großschreibung der
   Überschriften ab. Nicht `prioritaets_index` setzen —
   den rechnet die Pipeline und überschreibt ihn bei jedem Transform-Lauf.
   Nicht publizierte Quellen meldet die Zeile als `nicht_publiziert`.
4b. **Design-Profil übertragen** (wenn die Site nicht wie die Vorlage
   aussehen soll). Aus der Gestaltungsvorlage (Figma, Styleguide) ablesen:
   Überschriften- und Fließtextschrift, Akzentfarbe der Buttons, je Sektion
   Hintergrund- und Textfarbe. Dann `veroeffentlichung_setzen` mit
   `siteTheme`, z. B.
   `{ "fontHeading": "newsreader", "fontBody": "plus-jakarta", "accent": "#c85a32",
   "buttonShape": "rounded", "surfaces": { "default": { "bg": "#faf8f5", "text": "#1c3829" },
   "light": { "bg": "#f4f1ea", "text": "#1c3829" }, "dark-green": { "bg": "#1c3829",
   "text": "#f4f6f4", "kicker": "#9cc5a1" }, "brand": { "bg": "#224851", "text": "#f0f6f7" } } }`.
   Regeln: Schriften nur aus `geist`, `newsreader`, `plus-jakarta` (andere
   brauchen einen Code-Eintrag); Farben als `#rrggbb`; Flächen nur aus
   `default, light, dark, brand, linen, mint, dark-green, neutral`; nur
   genannte Flächen weichen von der Vorlage ab; das Profil ersetzt das
   gespeicherte als Ganzes (vorher `veroeffentlichung_lesen`); `siteTheme`
   ist ein Objekt, kein JSON-Text; `siteThemeLoeschen: true` löscht es.
   Ungültige Werte weist die Brücke ab. Die Seiten selbst
   ändern sich nicht — nur die Farbe hinter den `bg`-Namen.
5. **Prüfen.** Erneut `seite_pruefen`: Startseite, Menüreihenfolge,
   Footer-Links, Sektionen je Seite, keine Fehler. `siteEnabled: true` mit
   `veroeffentlichung_setzen`, dann die Seite unter `/explore/<slug>`
   ansehen.
6. **Zurücknehmen.** `dokument_depublizieren` entfernt nur den Eintrag;
   Datei und Twin bleiben.

Nicht über die Brücke: die Domain-Zuordnung (`PUBLIC_DOMAIN_LIBRARY_MAP`
im Deployment, DNS) und der API-Schlüssel der Library.
