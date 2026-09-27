---
name: website-publishing
description: Website-Seiten einer Library über die KnowledgeScout-MCP-Brücke anlegen, prüfen und publizieren (dokument_publizieren, dokument_felder_setzen, seite_pruefen) und die Website-/Galerie-Einstellungen (Galerie-Texte, Logo, Hintergrundbild) sinnvoll füllen. Verwende diesen Skill, wenn der Benutzer eine Website oder Landingpage für eine Library erstellen, Seiten publizieren, Fokus-Tags setzen, Website-Inhalte, Galerie-Texte, Logo oder Hintergrundbild einrichten oder verbessern will — oder alle öffentlichen Libraries auf die Blob-Bild-Konvention umstellen möchte.
---

# Website-Publishing: Inhalte einer öffentlichen Library füllen

Ziel: Die Felder unter **Einstellungen → Veröffentlichung** (Galerie-Texte,
Website-Logo-URL, Hintergrundbild-URL, Icon) für eine Library passend zu ihrem
Inhalt befüllen.

## Grundregeln (nicht verhandelbar)

1. **Kein Library-Inhalt ins Repository.** Texte, Bildnamen, IDs und URLs einer
   Library gehören in MongoDB/Blob — niemals in Git-Dateien, auch nicht in
   Beispiel- oder Doku-Form.
2. **Erst vorschlagen, dann speichern.** Alle Textentwürfe dem User zeigen und
   absegnen lassen, bevor irgendetwas persistiert wird.
3. **Bild-URLs müssen anonym ladbar sein.** Storage-Links (Nextcloud/OneDrive)
   sind auth-gegated und funktionieren NICHT. Blob-Konvention:
   `https://<account>.blob.core.windows.net/knowledgescout/<library-id>/website/images/<datei>`
4. **MongoDB nur lesend** für Analyse. Schreiben von Settings läuft über das
   Settings-Formular des Users (validiert + merged serverseitig via
   `PUT /api/libraries/[id]/public`, Clerk-Auth erforderlich).

## Ablauf

### Schritt 1 — Library identifizieren

- Library-ID, Slug und Owner-Email ermitteln: MongoDB-Collection `libraries`,
  read-only (`config.publicPublishing.slugName`, `.isPublic`).
- **DB-Wahl explizit klären:** Prod-DB heißt `common-knowledge-scout-prod` und
  fehlt ggf. in `.env` — beim User nachfragen, ob Dev oder Prod gemeint ist.
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

### Schritt 4 — Bilder in den Blob spiegeln

1. User legt kuratierte Bilder (Logo, Hintergrund) im Library-Storage unter
   `web/images/` ab (Ordner ggf. anlegen).
2. Spiegeln (alle Bilddateien des Ordners, oder via `--files` gezielt):

   ```bash
   node --import tsx scripts/mirror-website-images-to-blob.ts --user <owner-email> --library <library-id>
   ```

3. Das Skript druckt die fertigen öffentlichen URLs — diese für Logo-/
   Hintergrundbild-Feld verwenden. Benötigt `AZURE_STORAGE_CONNECTION_STRING`
   in `.env`.

### Schritt 5 — Eintragen und verifizieren

- Freigegebene Werte dem User als Copy-Paste-Block für das Formular
  **Einstellungen → Veröffentlichung** geben (Felder: Überschrift, Untertitel,
  Einleitung, Filter-Erklärung, Website-Logo-URL, Hintergrundbild-URL, Icon).
- Nach dem Speichern verifizieren: `/explore/<slug>` neu laden — Texte über der
  Galerie, Logo oben links in der Navigation (rendert nur bei gesetzter URL,
  Explore-Seite und eigene Domain). Bild-URLs zusätzlich in einem privaten/
  anonymen Kontext prüfen (müssen ohne Login laden).

## Stolperfallen

- Logo erscheint NUR im Site-Kontext (Explore-Slug oder gemappte Domain), nicht
  in der internen App-Ansicht.
- Der Landingpage-Renderer löst relative Bildpfade nicht auf — immer absolute
  Blob-URLs verwenden.
- `siteEnabled` steuert die Website-Landingpage am Slug; ohne dieses Flag gibt
  es nur die Galerie.


## Website-Seiten über die Brücke anlegen und publizieren (Werkzeugsatz 2.32.0)

Der Weg einer Website ohne App-Oberfläche. Muster: die Library „Oldies for
Future" (vier Dokumente in `Webseite/Seiten/`). Jede schreibende Aktion nur
nach Bestätigung durch den Menschen, mit `begruendung`.

1. **Bestand lesen.** `seite_pruefen` mit der `libraryId`: zeigt, ob die
   Library öffentlich ist, ob `siteEnabled` gesetzt ist, welche Seiten
   schon publiziert sind und welche Befunde sie tragen.
2. **Seiten schreiben.** `ordner_anlegen` für `Webseite/Seiten` (falls
   fehlt), dann je Seite `datei_anlegen`:
   - Startseite: `detailViewType: "website"`, `title`, `language`,
     `targetLanguage`, `menu_order: 1`, Hero-Felder (`hero_subtitle`,
     `hero_image`, `hero_layout`, `cta_label`, `cta_url`), Body als
     Sektionen `<!-- section layout=… bg=… --> … <!-- /section -->`.
   - Kontakt: `menu_order` hoch, `slug`, `contact_email`, Sektion
     `layout=contact-form`.
   - Impressum: `menu_area: "footer"`.
   - Fußzeile: `site_role: "footer-content"`, `menu_area: "hidden"`.
   Erlaubte `layout`: image-left, image-right, full-image, text-only, video,
   contact-form. Erlaubte `bg`: default, light, dark, brand, linen, mint,
   dark-green, neutral. Bild-URLs absolut aus dem Blob (Regel 3 oben).
3. **Publizieren.** `dokument_publizieren` mit `quellPfad` oder `sourceIds`
   (bis 30). Die Antwort nennt je Seite Warnungen (fehlende Felder,
   relative Bilder) und harte Fehler (ungültiger Marker). Warnungen erst
   beheben; nur wenn sie bewusst bleiben sollen, `trotzWarnungen: true`.
   Ein zweiter Aufruf nach einer Textänderung aktualisiert den Eintrag.
4. **Auswahl markieren.** Soll das Banner unter der Seite eine kuratierte
   Auswahl zeigen, `dokument_felder_setzen` mit `sourceIds` der Dokumente
   und `listen: { tags: ["fokus"] }`. Nicht `prioritaets_index` setzen —
   den rechnet die Pipeline.
5. **Prüfen.** Erneut `seite_pruefen`: Startseite, Menüreihenfolge,
   Footer-Links, Sektionen je Seite, keine Fehler. Danach die Seite unter
   `/explore/<slug>` ansehen (Site-Modus braucht `siteEnabled`, heute noch
   im Formular Einstellungen → Veröffentlichung).
6. **Zurücknehmen.** `dokument_depublizieren` entfernt nur den Eintrag;
   Datei und Twin bleiben.

Noch nicht über die Brücke: Bilder in den Blob (Skript, Schritt 4 oben) und
die Veröffentlichungs-Einstellungen (Formular). Beides steht im Plan
`docs/plans/mcp-bruecke-website-publizieren.plan.md` (B3, B4).
