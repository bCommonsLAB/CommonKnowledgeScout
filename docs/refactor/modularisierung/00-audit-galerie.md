# Bestands-Audit: die Galerie (Vorarbeit zur naechsten Modularisierungs-Welle)

Stand: 2026-08-29. Erstellt nach dem Merge von PR #217 (M4e + M4).

Dieses Audit liegt bewusst hier und nicht unter `docs/refactor/galerie/`: Es
folgt nicht dem Playbook-Format der Welle-3-Audits (Rules/Tests/Docs-Inventar),
sondern dem Muster der Eingangsmessung aus
[`AGENT-BRIEF-M4.md`](AGENT-BRIEF-M4.md) — messen, dann Optionen, dann Verdikt.

Die Messung selbst hat keinen Code angefasst. **Galerie-Eine-Quelle und Galerie-Vertrag wurden anschliessend
umgesetzt** — siehe die Nachtraege am Ende. **Galerie-Adressierung steht noch aus** und ist die
Welle, die das Einbetten tatsaechlich freischaltet.

## Warum ueberhaupt

Der M4-Nachtrag haelt fest: `ExplorerRoot` ist **montierbar**, aber noch nicht
**einbettbar**, weil die Galerie als Slot aus der App hereingereicht wird
(`src/app/explore/[slug]/page.tsx:21`, per `next/dynamic`). Solange das so ist,
kann eine fremde Seite den Explorer nicht laden, ohne die ganze App zu sein.

Der Hand-off nannte „~15.000 Zeilen". Das stimmt fuer den Kern. Es ist aber
nicht die Zahl, die die Welle bestimmt.

## 1. Der Kern — was „die Galerie" heisst

| Ort | Dateien | Zeilen |
|---|---:|---:|
| `src/components/library/gallery/` | 72 | 11.960 |
| `src/hooks/gallery/` | 16 | 2.240 |
| `src/lib/gallery/` | 15 | 1.394 |
| **Summe** | **103** | **15.594** |

- **75 von 103** Dateien tragen `'use client'`.
- **21** Dateien liegen ueber der 200-Zeilen-Grenze aus `AGENTS.md`.
  Die groesste ist `gallery-root.tsx` mit **1.319** Zeilen — sie ist das
  Gegenstueck zu dem, was M4 beim Explorer auf 59 Zeilen Montagepunkt
  heruntergebracht hat.
- Genau **ein** Montagepunkt existiert: `src/app/library/gallery/client.tsx`
  reicht `GalleryRootProps` durch (4 Props: `libraryIdProp`, `showSiteTab`,
  `defaultToSite`, `hideWebsiteDocs`).
- **43** Testdateien beruehren Galerie-Code. Als Netz fuer die unten
  vorgeschlagenen Wellen ist das brauchbar.

## 2. Der Fremdkegel — was beim Verschieben mitkommt

Gemessen ueber die nicht-relativen Importe des Kerns, eine Ebene tief:

| Gruppe | Was | Zeilen |
|---|---|---:|
| Detail-Ansichten | 7 `ingestion-*-detail`-Wrapper (504) + 7 Detail-Komponenten (2.547) + `src/lib/detail-view-types/` (1.089) | 4.140 |
| Mapper und Typen | `doc-meta-mappers` (689), `lib/i18n/get-localized` (259), `types/item` (227), `graph/synergy-sum` (121), `types/source-*` (158), `shadow-twin-folder-name` (81), `detail-view-type-utils` (42) | 1.577 |
| Chat-Kopplung | `chat-reference-list` (469), `lib/chat/dynamic-facets` (347), `types/query-log` (132), `types/chat-response` (47), `atoms/chat-references` (12) | 1.007 |
| Website und Story | `website-landing-live` (219), `atoms/story-context` (220), `story-mode-header` (82) | 521 |
| Filterleiste | `filter-context-bar` (434) | 434 |
| Utils | `document-navigation` (130), `document-slug` (62), `format-upserted-at` (47), `decode-storage-file-id` (39) | 278 |
| Auth | `lib/auth/user-email` (64), `lib/auth/user-display-name` (71) | 135 |
| Rest | `capture-content-button`, `view-type-badge`, `library-verification-badge`, zwei kleine Atome | 151 |
| **Summe** | | **~8.240** |

**Kern + Kegel ≈ 23.800 Zeilen.** Das ist die Zahl, an der der Zuschnitt haengt —
nicht die 15.000.

Sauber ist dagegen die Paket-Seite: der Kern zieht heute schon `@ks/ui` (46x),
`@ks/i18n/react` (38x), `@ks/shell/react` (2x, aus M4e) und `@ks/viewers` (1x).
Die Arbeit aus M4b–M4e traegt hier.

## 3. Die Befunde, die den Zuschnitt bestimmen

### Befund 1 — `src/lib/gallery/` ist nicht die Galerie

Der Ordnername verspricht UI-Code. Tatsaechlich nutzen ihn beide Seiten:

| Datei | Zeilen | Server/API | UI |
|---|---:|---:|---:|
| `types.ts` | 346 | 8 | 46 |
| `sdg-meta.ts` | 120 | 2 | 6 |
| `rating.ts` | 124 | 2 | 0 |
| `column-sort.ts` | 119 | 2 | 0 |
| `gallery-sort.ts` | 57 | 1 | 0 |
| `relations-limits.ts` / `relations-staleness.ts` | 56 | 4 | 0 |

Zu den Server-Konsumenten gehoeren `lib/repositories/vector-repo.ts`,
`lib/repositories/doc-meta-formatter.ts`, `lib/external-jobs/phase-template.ts`,
`phase-doc-relations.ts`, `phase-overlap-report.ts` und
`lib/website/site-navigation.ts`.

`DocCardMeta` ist faktisch der repoweite Dokument-Typ. Wer den Ordner ins
Modul verschiebt, zieht entweder Server-Code mit oder bricht ihn. Der Typ
gehoert nach `@ks/contracts` — dort liegt mit `GalleryGraphConfig` bereits ein
galerienaher Vertrag, das Muster ist also gesetzt.

### Befund 2 — die Galerie kennt Routen, nicht nur einen Router

**10 Dateien** importieren `next/navigation` (8 im Komponenten-Baum, 2 in den
Hooks). Das allein waere das M4-Problem und mit dem M4-Mittel loesbar.

Schwerer wiegt `src/utils/document-navigation.ts`: die Datei verzweigt auf
**zwei fest verdrahtete Routen-Formen** — `/explore/:slug` und
`/library/gallery` — und navigiert im Unbekannt-Fall nach `/library/gallery`
([Zeile 55](../../../src/utils/document-navigation.ts:55) beim Oeffnen,
[Zeile 122](../../../src/utils/document-navigation.ts:122) beim Schliessen).

In einer fremden Seite eingebettet ist das ein Sprung auf eine Seite, die es
dort nicht gibt. **Das ist der konkrete Blocker fuers Einbetten — nicht die
Groesse.** M4 hat den Slug zur Prop gemacht; hier braucht es dasselbe eine
Ebene hoeher: ein injizierbares Adressier-Protokoll (Dokument oeffnen /
schliessen) statt `useRouter` im Modul.

### Befund 3 — die Detail-Ueberlagerung verteilt per Negativ-Liste

`detail-overlay.tsx` (488 Zeilen) importiert **7 detailViewType-Ansichten fest**. Eine
Registry fuer genau diese Zuordnung existiert
(`src/lib/detail-view-types/registry.ts`, 681 Zeilen) und wird an zehn Stellen
benutzt, drei davon im Galerie-Baum selbst (`gallery-root.tsx`,
`graph-sums-panel.tsx`, `view-type-lead-filter.tsx`). Nur die Ueberlagerung
laeuft an ihr vorbei — und zwar so:

```tsx
{viewType !== 'session' && viewType !== 'climateAction' && … && (
  <IngestionBookDetail … />
)}
```

`DETAIL_VIEW_TYPES` kennt **neun** Typen (`book`, `session`, `testimonial`,
`blog`, `climateAction`, `divaDocument`, `divaTexture`, `refurbedDevice`,
`website`). Die Ueberlagerung behandelt sechs davon ausdruecklich; alles
uebrige faellt auf die Buch-Ansicht. Damit rendern `book`, `testimonial`,
`blog` **und jeder kuenftige Typ** als Buch. `testimonial-detail.tsx`
existiert und ist nicht angeschlossen; fuer `blog` gibt es keine Ansicht.

**Das ist ein stiller Fallback** und verletzt
[`no-silent-fallbacks.md`](../../contracts/no-silent-fallbacks.md). ADR 0003
protokolliert denselben Drift auf der anderen Seite derselben Registry: der
Wizard-Preview kennt 4 von 8 Typen und faellt still auf `session` zurueck.

Folge fuer die Modularisierung: jede Einbettung zieht 4.140 Zeilen
Detailansicht mit, auch wenn die fremde Seite nur Kacheln zeigen will.

### Befund 3b — die Typen sind vertikal schneidbar, die Registry ist nur Daten

**Die Einheit ist `detailViewType`, nicht `docType.`** ADR 0003 trennt beides:
`docType` ist die Schema-Identitaet (welche Felder, welcher Extractor),
`detailViewType` der Renderer. Das Verhaeltnis ist **n:1**. Gemessen an
`template-samples/`:

| Beobachtung | Zahl |
|---|---|
| verschiedene `docType`-Werte | 11 |
| `detailViewType`-Werte in der Registry | 9 |
| Beispiel n:1 | `preisliste`, `katalogdokument`, `holzarten-referenz` → alle `divaDocument` |
| Vorlagen **ohne** `docType`, die `book` deklarieren | 9 |

Ein Schnitt entlang `docType` waere also zu fein und wuerde Renderer
duplizieren. Der Schnitt entlang `detailViewType` ist der richtige.

**Nebenbefund dazu**: drei Vorlagen deklarieren `detailViewType`-Werte, die
`DETAIL_VIEW_TYPES` gar nicht kennt — `musterkarte`
(`commoning-musterkarte-de.md`), `methode` (`commoning-methode-de.md`) und
`divaProductProfile` (`gaderform-bett-steckbrief-de.md`). Ein Gate dagegen
existiert (`template-integrity.ts:68` meldet „unbekannter detailViewType" als
Fehler), aber der Parser laesst den Wert an anderer Stelle **still fallen**:
`template-parser.ts:85` uebernimmt ihn nur bei `isValidDetailViewType`, sonst
bleibt das Feld `undefined` — ohne Warnung, direkt neben einem leeren
`catch {}`. Was so entwertet bei der Ueberlagerung ankommt, faengt die
Negativ-Liste aus Befund 3 ein und rendert es als Buch.

Ein Registry-Eintrag enthaelt `requiredFields`, `optionalFields`, i18n-Schluessel,
`mediaConfig` und `translatable` — **reine Daten, kein Code**. Die Registry muss
also nicht geteilt werden; sie muss erweiterbar werden.

Die Scheibe pro `detailViewType` ist dagegen echt und zusammenhaengend:

| Typ | UI-Zeilen | eigenes Drumherum |
|---|---:|---|
| `divaTexture` | 1.203 | + 594 Zeilen API-Routen unter `/api/diva-texture/*` |
| `climateAction` | 1.325 | davon **770** (SDG-Rad, SDG-Icons, Stakeholder) im *generischen* Galerie-Ordner |
| `session` | ~1.100 | eigener Hook-Ordner `src/hooks/library/session-detail/` |
| `divaDocument` | 438 | — |
| `book` | 337 | — |

Sie sind aber **nicht gleich gross und nicht gleich fremd**: `website` ist mit
der Landingpage verflochten, `book` und `divaDocument` sind duenn, und die acht
Mapper liegen zusammen in **einer** Datei (`doc-meta-mappers.ts`, 689 Zeilen).

Verdikt zu „ein Paket pro Typ": richtig als Richtung, zu fein als erster
Schritt. Der wirksame Schnitt ist die **explizite Anmeldung**, nicht die
npm-Grenze — ist jeder Typ erst ein geschlossener Ordner, der sich unter seinem
Namen anmeldet, ist der spaetere Schnitt zu Paketen mechanisch. Neun
Paketgrenzen auf einmal kosten dagegen neunmal das, was der Build-Fehler nach
M4b gekostet hat.

**Drei Typen waeren die Kandidaten, falls je Pakete entstehen**: `divaTexture`,
`refurbedDevice` und `climateAction` — alle drei fachlich sehr speziell. Ob es
dazu kommt, entscheidet aber erst M6 per Messung, nicht dieses Audit; die
Begruendung steht in Befund 3d und im Abschnitt „Eine-Quelle im Detail". Ihre Bauart
unterscheidet sich:

- `divaTexture` und `refurbedDevice` tragen ihre Besonderheit **in eigenen
  Dateien** (plus, bei `divaTexture`, 594 Zeilen eigene API-Routen).
- `climateAction` hat die groesste Scheibe (1.325 Zeilen) und den staerksten
  Grund: **770 Zeilen davon liegen heute im generischen Galerie-Ordner** —
  SDG-Rad, SDG-Icons, SDG-Profil, Stakeholder-Positionen, `sdg-meta`,
  `stakeholder-meta`. Der Schnitt ist sauber: diese Bausteine haben genau drei
  Konsumenten (`climate-action-detail.tsx`, `detail-overlay.tsx`,
  `doc-meta-mappers.ts`), alle klimabezogen.

### Befund 3c — die Typ-Liste stand dreizehnmal neben der Quelle

Erste Zaehlung ergab fuenf Kopien. Beim Umbau (Welle Galerie-Eine-Quelle) kamen weitere dazu —
die vollstaendige Liste, wie sie vorgefunden wurde:

| Ort | Form |
|---|---|
| `detail-view-types/registry.ts:31` | `DETAIL_VIEW_TYPES` — galt als Quelle |
| `packages/contracts/src/library-chat.ts:147` | Union im Vertrag; **konnte die App-Quelle nicht importieren** |
| `lib/chat/config.ts:128` | `z.enum([...])`, obwohl `detailViewTypeSchema` daneben lag |
| `chat/chat-panel.tsx:175` | `validDetailViewTypes` |
| `hooks/gallery/use-gallery-config.ts:9` | lokale `type DetailViewType`-Union |
| `gallery/gallery-root/helpers.ts:19` | `VALID_DETAIL_VIEW_TYPES` |
| `lib/templates/template-types.ts:73` | `TemplatePreviewDetailViewType` |
| `lib/templates/detail-view-type-utils.ts:27` und `:35` | zwei Arrays in einer Funktion |
| `settings/chat/hooks/use-chat-form.ts:85` und `:314` | `z.enum` + `validDetailViewTypes` |
| `settings/library/hooks/use-library-form.ts:56` | `z.enum` |
| `templates/structured-template-editor.tsx:631–639` | neun feste `<SelectItem>` |
| `gallery/detail-overlay.tsx:38` | Prop-Union |

Dazu eine kuratierte Teilliste in `settings/chat/content-type-section.tsx`
(sieben von neun, mit Erklaertexten) — keine Drift-Kopie, aber eine Stelle, aus
der ein neuer Typ still herausfaellt.

Und dazu die Negativ-Liste aus Befund 3 sowie der stille Wegwurf im Parser
(`template-parser.ts:85`).

**Das ist die eigentliche Krankheit** — nicht die Modulgrenze. Wer nur Pakete
schneidet und diese Listen stehen laesst, hat Kosmetik betrieben.

Bemerkenswert ist die zweite Zeile: `@ks/contracts` **konnte** die Quelle gar
nicht benutzen, weil ein Paket nicht aus `src/` importiert. Solange die
Aufzaehlung in der App lag, war eine Kopie im Vertrag unvermeidlich. Das ist
der Grund, warum die Liste in Galerie-Eine-Quelle ins Paket gewandert ist
und nicht umgekehrt.

### Befund 3d — die Faehigkeiten spannen ueber die Typen, die Typ-Bindung ist klein

Von den **103** Dateien im Galerie-Kegel kennen genau **8** einen konkreten
Typ — und zwei davon (`climate-action-card`, `diva-texture-card`) duerfen das.
Es bleiben **vier echte Verteilstellen** und zwei Listen:

| Ort | Was der Sonderfall tut |
|---|---|
| `gallery/document-card.tsx:87` | waehlt die Kartenvariante |
| `gallery/detail-overlay.tsx:471` | Negativ-Liste (Befund 3) |
| `gallery/virtualized-items-view.tsx:298` | haengt eine **Extra-Spalte** (Prio-Indikator) an |
| `gallery/graph/doc-graph.tsx:161` | eigener Zweig im Graphen |
| `gallery/gallery-root/helpers.ts:19` | Kopie der Typ-Liste (Befund 3c) |
| `hooks/gallery/use-gallery-config.ts:9` | Kopie der Typ-Liste (Befund 3c) |

Umgekehrt gilt: **die Faehigkeiten sind bereits typ-uebergreifend.**
`SourceCommentsBadge` wird von **allen fuenf** Kartenvarianten benutzt
(Standard, Session, ClimateAction, DivaTexture, RefurbedDevice), ebenso
`SourceStarsBadge`. Die 763 Zeilen Kommentar-Code enthalten **keinen einzigen**
Verweis auf einen `detailViewType`. Dasselbe gilt fuer Sterne, Graph und Story.

Daraus folgt eine Dreiteilung — und sie ist der Grund, warum „ein Paket pro
Typ" als erster Schritt in die Irre fuehrt:

| Art | Beispiel | Wohin |
|---|---|---|
| **Faehigkeit**, typ-uebergreifend | Kommentare (763 Z., 5 Karten), Sterne, Graph, Story | bleibt generisch im Kern — **nie** in ein Typ-Paket |
| **Einstellung im Typ-Kostuem** | Prio-Spalte: `libraryDetailViewType === 'climateAction'` — das ist der Typ der *Library*, also faktisch eine Bibliotheks-Einstellung | wird ein Konfigurations-Schalter, kein Typ-Zweig |
| **Echte Typ-Darstellung** | SDG-Rad (770 Z.), Textur-Klassifikation | Anmeldung; Paket nur, wenn eine Messung es rechtfertigt |

Wer eine Faehigkeit spaeter auf einem weiteren Typ braucht — Kommentare auf
`book`, Prio-Spalte auf `session` — will genau **nicht**, dass sie in einem
Typ-Paket liegt. Der Prio-Indikator ist heute schon der Fall, der falsch
einsortiert ist.

### Befund 4 — die Filterleiste zeigt rueckwaerts

`filter-context-bar.tsx` (434 Zeilen) liegt **ausserhalb** des Galerie-Ordners,
importiert aber sechs Galerie-Bausteine (Bulk-Loeschen, Bulk-Publizieren,
Dichte-Umschalter, Sticky-Header, Relations-Neuberechnen, Ansichts-Umschalter)
und zwei Galerie-Hooks. Der Schnitt „Galerie" verlaeuft heute mitten durch sie.

Insgesamt greifen **24 Dateien ausserhalb** des Kerns auf Galerie-Interna zu.
Die meisten davon nur auf `lib/gallery/types` (Befund 1); die Komponenten-
Rueckgriffe beschraenken sich auf `filter-context-bar`, `job-report-tab` und
`website-landing-live` (die beiden letzteren auf `document-card`).

### Nebenbefund — die API-Flaeche

Kern und Hooks rufen **25 verschiedene Routen** in fuenf Namensraeumen an,
davon **11 unter `/api/chat/[libraryId]/*`** (`docs`, `docs/ids`,
`docs/by-fileids`, `facets`, `config`, `doc-meta`, `queries/:id`,
`docs/publish`, `docs/publish-bulk`, `docs/delete`), dazu
`/api/library/:id/*` (source-comments, source-user-states, doc-relations,
doc-similarity, sibling-files, shadow-twins/resolve-binary-url),
`/api/diva-texture/*`, `/api/libraries/:id` und `/api/storage/streaming-url`.

Fuer M5 (Headless-Lese-API mit Token) ist das die Liste, die ein Token
abdecken muss. `docs/publish*` und `docs/delete` sind in M4 ausdruecklich vom
Explorer-Namensraum **ausgenommen** worden (Kuratierung) — die Galerie ruft sie
trotzdem. Diese Spannung ist offen.

## 4. Optionen

| Option | Umfang (gemessen) | Verdikt |
|---|---|---|
| **A — Kern am Stueck** nach `@ks/module-explorer/react` | 103 Dateien / 15.594 Zeilen Kern + ~8.240 Zeilen Fremdkegel; 24 Rueckwaerts-Importe | **nein.** Reisst das PR-Budget (5.000 Zeilen brutto, `AGENTS.md`) um das Vierfache und laesst sich nicht schneiden, ohne Server-Code mitzunehmen (Befund 1). |
| **B — drei Vorarbeits-Wellen** (Vertrag, Adressierung, Eine-Quelle) | Vertrag: `types.ts` (346 Z.) nach `@ks/contracts`, 54 Importstellen. Adressierung: Protokoll statt `next/navigation`, 10 Dateien + `document-navigation` (130 Z.). Eine-Quelle: vier Verteilstellen fragen die Registry, vier Listen-Kopien fallen weg (siehe unten) | **empfohlen.** Jede Welle passt einzeln ins Budget, jede ist fuer sich verhaltensneutral (G4). **Eine-Quelle traegt sich selbst** — es repariert die stillen Fallbacks und haengt an keiner Modularisierungs-Entscheidung. |
| **C — nur die Kachelwand** (`document-card` + Raster, ohne Tabelle, Graph, Detail) | ~2.400 Zeilen | zurueckgestellt. Liefert schnell etwas Einbettbares, verschiebt Befund 2 aber nur (`document-card.tsx` importiert selbst `next/navigation` und `next/image`) — und Landkarte §5 will fuer M5 „Galerie/Story", nicht Kacheln. |

**Empfehlung: B, in der Reihenfolge Vertrag → Adressierung → Eine-Quelle.**
Die Adressierung ist die Welle, die das Einbetten tatsaechlich freischaltet;
der Vertrag muss davor, weil sonst jede Bewegung
des Kerns Server-Code mitreisst.

### Eine-Quelle im Detail — eine Quelle, eine Verteilstelle. Keine Pakete.

Die erste Fassung dieses Audits empfahl „ein Paket pro `detailViewType`".
**Das wird hier zurueckgenommen**, weil Befund 3d es widerlegt: die
Faehigkeiten (Kommentare, Sterne, Graph, Story) spannen bereits ueber alle
Typen. Ein Typ-Paket wuerde sie entweder duplizieren oder eine Abhaengigkeit
quer durch fuenf Pakete ziehen. Und die Typ-Bindung, die ein Paket aufloesen
soll, umfasst nur 8 von 103 Dateien.

Was stattdessen zaehlt und fuer sich allein traegt:

- **Eine-Quelle — eine Quelle statt fuenf Listen, eine Verteilstelle statt vier
  Zweigen.** Die vier Verteilstellen aus Befund 3d fragen die Registry, statt
  Typen zu vergleichen; die vier Kopien der Typ-Liste verschwinden zugunsten
  von `DETAIL_VIEW_TYPES`; `template-parser.ts:85` meldet einen unbekannten
  Wert, statt ihn wegzuwerfen. Ergebnis: ein neuer Typ ist **additiv**, und
  ein Typ ohne Renderer ist ein Fehler statt einer Buch-Ansicht.
  Das ist die Welle mit dem besten Verhaeltnis von Aufwand zu Wirkung — und
  sie haengt an keiner Modularisierungs-Entscheidung.
- **Zusatz (klein, optional) — die Prio-Spalte entkosten.** Aus
  `libraryDetailViewType === 'climateAction'` wird ein Konfigurations-Schalter.
  Das ist das Muster fuer jede Faehigkeit, die spaeter auch auf einem anderen
  Typ gebraucht wird.

**Pakete pro Typ: vertagt auf M6, und dort per Messung zu entscheiden.** Die
Frage lautet dann nicht „ist der Typ speziell?", sondern „spart eine schlanke
Site messbar Bundle, wenn dieser Renderer nicht mitgeliefert wird?". Kandidaten
waeren `divaTexture` (eigene API-Routen), `refurbedDevice` und `climateAction`
(770 Zeilen SDG-Darstellung). Vorher ist eine Paketgrenze Zeremonie — und sie
kostet jedes Mal, was der Build-Fehler nach M4b gekostet hat.

## 5. Beweis-Ziele je Welle

Nach M4-Muster (`api-gate-coverage.test.ts`): der Schnitt soll **zugesichert**
sein, nicht dokumentiert.

- **Nach Galerie-Vertrag**: ein Test, der Importe aus `src/lib/gallery/**` in
  `src/lib/repositories/**` und `src/lib/external-jobs/**` verbietet.
- **Nach Galerie-Adressierung**: ein Test, der `next/navigation` im Galerie-Baum verbietet.
- **Nach Galerie-Eine-Quelle**: ein Test, der jeden Wert aus `DETAIL_VIEW_TYPES` auf einen
  angemeldeten Renderer abbildet — ein neuer `detailViewType` ohne Renderer
  laesst ihn rot werden. **Heute waere dieser Test rot** (`testimonial`, `blog`),
  er ist also zugleich der Nachweis, dass die Welle etwas repariert. Ein zweiter Test
  haelt fest, dass die Typ-Liste nur EINMAL existiert.

## 6. Was dieses Audit NICHT beantwortet

- **Ob die Galerie ohne Clerk laeuft.** Drei Dateien lesen `useAuth`/`useUser`
  direkt (`gallery-root.tsx:43`, `use-library-role.ts:4`,
  `use-is-library-owner.ts:4`). Beim Explorer reichten zwei Booleans; ob das
  hier traegt, ist ungeprueft. Die verwandte TopNav-Frage ist seit der
  Owner-Entscheidung vom 2026-08-29 kleiner: Im Embed gibt es keine Anmeldung,
  die Schale muss Auth dort also nicht abschaltbar tragen, sondern gar nicht.
- **Die Basis-URL fuer Modul-Fetches.** Offen aus M4, bewusst nicht gebaut
  (Garantie G3). **Kein Token-Modell noetig** — der Owner hat am 2026-08-29
  entschieden, dass das Embed ausschliesslich oeffentliche Inhalte liefert
  (Nachtrag in ADR 0008). Die Basis-URL ist damit eine Prop, keine
  Architekturfrage.
- **Die Zuordnung der 11 `/api/chat/*`-Routen.** M4 hat den Namensraum dem
  Explorer zugeschrieben; was davon der Galerie gehoert und was dem Chat, ist
  offen — und die Kuratierungs-Routen widersprechen der M4-Ausnahmeliste.
- **Story und Chat.** Dieses Audit misst nur die Galerie. Die Chat-Kopplung ist
  inzwischen nachgemessen:
  [`01-audit-galerie-chat.md`](01-audit-galerie-chat.md) — Ergebnis: sie ist
  fast nur Vokabular, und die Abhaengigkeit zeigt ueberwiegend in die
  Gegenrichtung.
  `src/components/library/story/` und `src/components/library/chat/` gehoeren
  laut Landkarte §5 in dasselbe Modul und sind nicht vermessen.

## Nachtrag (2026-08-29): Galerie-Eine-Quelle ist umgesetzt

Umgesetzt in derselben Session, Branch
`claude/welle-g3-detailviewtype-eine-quelle`.

**Was sich beim Umbau gegenueber der Messung geaendert hat:** Aus den fuenf
gefundenen Kopien wurden dreizehn (Befund 3c ist entsprechend korrigiert). Das
Messraster der ersten Runde suchte nur nach zwei Mustern; erst das Umstellen
foerderte `z.enum`-Kopien in Settings-Formularen, zwei Arrays innerhalb einer
Funktion und neun feste `<SelectItem>` zutage.

**Die Entscheidung, die das Audit nicht vorweggenommen hatte:** Die Liste ist
nach `@ks/contracts` gewandert, nicht innerhalb der App zusammengezogen worden.
Grund ist die Kopie in `packages/contracts/src/library-chat.ts` — ein Paket
kann nicht aus `src/` importieren. Solange die Aufzaehlung in der App lag, war
diese eine Kopie unvermeidbar. Das Paket haelt jetzt die Werte
(`detail-view-type.ts`), die App behaelt alles Rechnende: Zod-Schema,
`VIEW_TYPE_REGISTRY`, Labels, Renderer-Zuordnung.

**Was jetzt erzwungen ist statt dokumentiert** — drei `Record<DetailViewType, …>`:

| Ort | Was ein neuer Typ ausloest |
|---|---|
| `gallery/detail-overlay.tsx` | Typfehler, bis eine Detailansicht zugeordnet ist |
| `templates/structured-template-editor.tsx` | Typfehler, bis er eine Beschriftung hat |
| `settings/chat/content-type-section.tsx` | Typfehler, bis entschieden ist, ob er angeboten wird |

Dazu `tests/unit/detail-view-types/eine-quelle.test.ts`: der Test wird rot,
sobald irgendwo im Repo eine zwoelfte Kopie der Werteliste entsteht.

**Bewusst NICHT geaendert (Verhaltensneutralitaet):**

- `testimonial` und `blog` zeigen weiter die Buch-Ansicht. Fuer `testimonial`
  existiert `testimonial-detail.tsx`, angeschlossen war sie nie. Das Anschliessen
  ist eine Produktentscheidung, keine Refactoring-Welle.
- Die kuratierte Auswahl in den Einstellungen bleibt wie sie war: drei
  Kern-Typen, vier Branchen-Typen, `testimonial`/`blog` verborgen.
- Die Sonderfaelle aus Befund 3d (Kartenvariante, Prio-Spalte, Graph-Zweig)
  stehen unveraendert. Sie in die Anmeldung zu heben ist eine eigene Welle —
  und die Prio-Spalte gehoert dabei zur mittleren Zeile der Dreiteilung: sie
  wird ein Konfigurations-Schalter, kein Typ-Zweig.

**Ein Befund fuer den naechsten Testlauf:** Der erste lokale Vollauf meldete 14
rote Tests, alle vom Typ „Export-Vertrag" (dynamische Imports in
`chat-panel-facade`, `story-topics-contract`, `perspective-*`,
`settings/*-sections`). Einzeln brauchen sie 2,6–3,5 Sekunden und laufen gruen;
unter Vollast reissen sie das 5-Sekunden-Limit. Ein zweiter Vollauf mit
identischem Code war komplett gruen (462/462 Dateien, 3470/3470 Tests). Wer
diese Dateien rot sieht, hat eine Lastspitze vor sich, keinen Regress.

## Nachtrag (2026-08-29): Galerie-Vertrag ist umgesetzt

Umgesetzt in derselben Session, gleicher Branch. Befund 1 ist damit erledigt;
die Tabelle dort beschreibt den Zustand VOR dieser Welle.

**Der Auslöser, den die Messung nicht benannt hatte**: `src/lib/gallery/types.ts`
trug `'use client'` — und `vector-repo`, `doc-meta-formatter`, drei
`external-jobs`-Phasen sowie die Website-Navigation importierten daraus. Eine
Client-Datei als Typquelle des Servers.

**Was wohin gegangen ist:**

| Was | Wohin | Warum |
|---|---|---|
| `DocCardMeta`, `DetailDoc`, `ChapterInfo`, `FavoriteVoter` | `@ks/contracts/doc-card-meta.ts` | Form, von beiden Seiten gebraucht |
| `column-sort`, `gallery-sort`, `rating`, `relations-limits`, `relations-staleness` | `src/lib/documents/` | rechnen, und zwar ausschliesslich serverseitig — sie waren nie Galerie |
| `sdg-meta`, `stakeholder-meta` | `src/lib/documents/` | Dokument-Fachdaten; `doc-meta-mappers` (beidseitig genutzt) haengt daran |
| `mapItemToDocCardMeta` | bleibt in `src/lib/gallery/types.ts` | rechnet und haengt am `Item`-Modell — das Paket beschreibt, es rechnet nicht |
| `GalleryTexts`, `StatsTotals`, `StatsResponse` | bleiben | drei bzw. eine Nutzungsstelle, rein UI-nah |

`src/lib/gallery/types.ts` und `src/types/source-user-state.ts` reichen die
gewanderten Typen weiter, damit die rund 70 UI-Importpfade unveraendert
bleiben. Die sechs Server-Dateien lesen dagegen direkt aus `@ks/contracts` —
sonst waere die Abhaengigkeit nur indirekt geworden statt aufgeloest.

**Ein Pfad, der beinahe durchgerutscht waere**: `external-jobs/phase-translations.ts`
→ `lib/mappers/doc-meta-mappers.ts` → `lib/gallery/sdg-meta.ts`. Indirekt, aber
genauso bindend. Deshalb sind SDG- und Stakeholder-Daten mitgewandert.

**Beweis-Ziel** (`tests/unit/detail-view-types/galerie-schnitt.test.ts`): kein
Bereich unter `src/lib/{repositories,external-jobs,website,mappers,chat}`,
`src/app/api` oder `src/utils` importiert noch aus `src/lib/gallery/`. Ein
zweiter Fall haelt fest, dass `src/lib/documents/` rahmenneutral bleibt — kein
`'use client'` in geteilter Fachlogik.

**Was in `src/lib/gallery/` bleibt** (10 → 3 Dateien plus UI-Helfer):
`api.ts`, `apply-favorite-optimistic.ts`, `cover-ref-display-name.ts`,
`doc-source-path.ts`, `gallery-card-density.ts`, `resolve-cover-url-client.ts`,
`table-sort.ts`, `types.ts`. Alles davon ist UI-nah und kann mit dem Modul
wandern.

**Damit ist der Weg fuer die Adressierung frei** — die Adressierung. Danach ist der Kern am
Stueck bewegbar.

## Nachtrag (2026-08-29): das Netz fuer Galerie-Adressierung liegt

Die Welle **Galerie-Adressierung** wurde bewusst NICHT begonnen. Zwei Gruende,
beide aus den eigenen Regeln:

- **Garantie G3 (Bedarfsgetrieben)**: `AGENTS.md` verbietet vorauseilendes
  Extrahieren ohne konkretes Ziel. Es gibt noch keine fremde Seite, in die
  eingebettet wird — M5 waere die erste. Die Schnittstelle wuerde gegen eine
  Vermutung entworfen statt gegen eine Anforderung.

  *Nachtrag 2026-08-29*: Die urspruengliche Fassung nannte hier zwei offene
  Owner-Entscheidungen als Blocker. Das war zu streng. Die Auth-Frage ist
  entschieden (Embed nur oeffentlich, ADR 0008), und die Basis-URL ist eine
  Prop. Es bleibt das Argument oben: es fehlt der Konsument, nicht die
  Entscheidung.
- **Garantie G4 (Verhaltensneutralitaet)**: Diese Welle ist die einzige der
  drei, deren Ergebnis `tsc`, `vitest` und `pnpm build` NICHT belegen koennen.
  Sie aendert Zurueck-Taste, geteilte Links und den `?doc=`-Parameter.

**Die Fläche ist groesser als in Befund 2 gemessen.** Es sind drei
ineinandergreifende Stellen, nicht eine:

| Stelle | Was sie ueber Routen weiss |
|---|---|
| `utils/document-navigation.ts` | sechs Verzweigungen auf `/explore/` und `/library` |
| `hooks/gallery/use-gallery-mode.ts:101` | eigene Verzweigung auf `/explore/` |
| `hooks/gallery/use-gallery-events.ts` | reicht Router, Pfad und Parameter durch |

**Was stattdessen entstanden ist**:
`tests/unit/utils/document-navigation-routen.test.ts` — 16 Characterization
Tests, die das HEUTIGE Verhalten festschreiben. Vorher gab es dafuer kein Netz;
der einzige vorhandene Test (`document-navigation-slug.test.ts`, 51 Zeilen)
deckt nur die Slug-Ableitung ab, nicht die Routen-Verzweigung.

Zwei Eigenheiten sind darin absichtlich festgenagelt, weil sie beim Umbau
unbemerkt verschwinden wuerden:

1. Auf einer `/library`-Route, die nicht die Galerie ist, wird `push` benutzt
   (neuer History-Eintrag) — sonst ueberall `replace`.
2. Im Unbekannt-Fall gehen bestehende URL-Parameter **verloren**: dieser Zweig
   baut die Parameter neu auf, statt die vorhandenen zu uebernehmen.

Ob Punkt 2 gewollt ist, ist offen. Der Test bewertet nicht — er haelt fest.

## Neubewertung (2026-08-29): die Adressierung ist dreigeteilt

Befund 2 nannte „10 Dateien mit `next/navigation`" und drei Stellen mit
Routen-Wissen. Beide Zahlen waren zu grob. Nachgemessen:

**Es sind vier Stellen mit Routen-Wissen, nicht drei** — `gallery-root.tsx`
selbst kennt `/explore/:slug/perspective` und `/library/gallery`
(Zeilen 210–217). Das war uebersehen.

**Aber die zehn Dateien zerfallen in drei sehr ungleiche Gruppen:**

| Gruppe | Dateien | Was sie tun | Risiko |
|---|---:|---|---|
| **Durchreicher** | 6 | holen `useRouter`/`usePathname`/`useSearchParams` NUR, um sie an `openDocumentBySlug(slug, libraryId, router, pathname, searchParams)` weiterzugeben. Sie navigieren nicht selbst | trivial |
| **Teiler** | 1 | `document-share-button` baut einen Link aus `window.location.origin` + Pfad + Parametern | trivial |
| **Echte Navigierer** | 3 | `gallery-root`, `switch-to-story-mode-button`, `use-gallery-mode`: eigene `push`/`replace` UND Routen-Formen | die eigentliche Arbeit |

Die Durchreicher sind `document-card`, `grouped-items-grid`,
`grouped-items-table`, `items-table`, `virtualized-items-view` und
`use-gallery-events`.

### Was das aendert

**Die Schnittstelle muss nicht mehr erraten werden.** Die erste Bewertung
verschob die Welle, weil man „gegen eine Vermutung entwerfen" wuerde. Das
stimmt so nicht mehr: Was das Modul koennen muss, steht im Code —

- ein Dokument oeffnen (`openDocument(slug)`)
- ein Dokument schliessen
- in den Story-Modus wechseln
- die Perspektiven-Ansicht oeffnen
- einen teilbaren Link bauen

Das ist abgelesen, nicht ausgedacht. Fuer die **sechs Durchreicher** braucht es
zudem gar keine Entwurfsentscheidung: Sie bekommen statt dreier Router-Objekte
eine Funktion hereingereicht und verlieren die Next-Bindung ersatzlos.

**Ein Fehler, der im Embed sicher auftreten wird**: `document-share-button`
baut den Teilen-Link aus `window.location.origin`. In einer fremden Seite ist
das die Adresse der fremden Seite — der geteilte Link zeigt dann ins Leere.
Das ist kein Entwurfsproblem, sondern eine fehlende Basis-URL; dieselbe, die
die Modul-Fetches ohnehin brauchen (P2-Skizze in `einsatz-szenarien.md`).

### Neue Empfehlung: die Welle teilen

| Teil | Umfang | Wann |
|---|---|---|
| **A — Durchreicher entkoppeln** | 6 Dateien, je ~7 Zeilen (drei Importe, drei Hook-Aufrufe, eine Aufrufstelle) | **jetzt.** Verhaltensneutral, mechanisch, vom Netz gedeckt |
| **C — Teilen-Link mit Basis-URL** | 1 Datei | **jetzt.** Behebt einen sicheren Embed-Fehler, unabhaengig vom Rest |
| **B — die drei echten Navigierer** | `gallery-root`, `switch-to-story-mode-button`, `use-gallery-mode` + `document-navigation.ts` | **weiter warten.** Hier faellt die Entscheidung, ob das Modul URL-Zustand ueberhaupt anfasst |

Nach A und C haengen noch **drei statt zehn** Dateien an `next/navigation`,
und die verbleibende Entscheidung ist scharf umrissen statt diffus.

### Was unveraendert gilt

Teil B laesst sich weiterhin **nicht** durch `tsc`, `vitest` oder `pnpm build`
belegen — er aendert Zurueck-Taste, geteilte Links und den `?doc=`-Parameter.
Das Netz dafuer liegt seit dem 2026-08-29
(`tests/unit/utils/document-navigation-routen.test.ts`, 16 Faelle).

Und die Leitfrage fuer B bleibt offen, weil sie eine Produktfrage ist: **Soll
eine eingebettete Galerie die Adresse der Wirtsseite veraendern?** Die
naheliegende Antwort ist nein — der Gast fasst die Adressleiste des Gastgebers
nicht an, ausser der Gastgeber bittet darum. Dann waere die Loesung nicht
„Protokoll injizieren", sondern: Das Modul fuehrt seinen Zustand selbst, und
die Voll-App klinkt sich optional in die URL ein. Das ist eine Entscheidung,
die der Owner treffen sollte, bevor jemand baut.

## Nachtrag (2026-08-29): der lange Schwanz, abgearbeitet und sortiert

Vor dem Paketumzug muss die Galerie aufhoeren, an der App zu ziehen. Gemessen
waren es **30 Importgruppen**; nach dieser Welle sind es **20**, und die
verbleibenden sind sortiert.

### Erledigt

| Was | Wohin | Umfang |
|---|---|---|
| `cn` | `@ks/util` | 10 Importe |
| `FavoriteVoter`, `GalleryGraphConfig`, `DetailViewType`, `DETAIL_VIEW_TYPES`, `isValidDetailViewType` | `@ks/contracts` | 15 Dateien |
| `formatUpsertedAt`, `tryDecodeRelativePathFromFileId` | `@ks/util` (`git mv` + Weiterleitung) | 5 Importe |
| Kommentar-Typen (6 Interfaces) | `@ks/contracts` (`git mv` + Weiterleitung) | 2 Importe |

**Der groesste Teil war kein Umzug, sondern ein Zeigefehler**: Diese Dinge
lagen laengst im Vertrag oder in `@ks/util`; die Galerie holte sie ueber
App-Weiterleitungen. Das faellt bei einer Paketgrenze sofort auf die Fuesse,
weil ein Paket `@/*` nicht aufloesen kann.

### Was bleibt — mit Entscheidung

**A. Zieht mit dem Modul um (keine Arbeit, das IST der Umzug)** — 19 Importe:
`utils/document-slug`, `atoms/gallery-filters`, `atoms/chat-references-atom`,
`atoms/gallery-data`, `utils/document-navigation`.

**B. Muss injiziert werden — echtes App-Wissen** — 6 Importe:

| Posten | Warum | Muster |
|---|---|---|
| `atoms/job-monitor-panel-open-atom` (4) | Job-Monitor ist Werkbank, nicht Galerie | wie Betrachter/Adressierung |
| `components/submissions/capture-content-button` (1) | Erfassung ist ein anderes Modul | Slot |
| `atoms/story-context-atom` (1) | Story-Zustand; gehoert zum selben Modul, aber quer | mitziehen oder Slot |

**C. Braucht je ein Urteil** — 12 Importe:

| Posten | Vorschlag |
|---|---|
| `lib/templates` (3) | `TemplatePreviewDetailViewType` ist schon ein Alias auf `DetailViewType` → Import direkt aus `@ks/contracts`; `getDetailViewType` rechnet → bleibt App oder zieht mit |
| `lib/detail-view-types` (3) | `getSummableFields`, `getPresentDetailViewTypes` rechnen ueber die Registry → bleiben App-seitig, Galerie bekommt das Ergebnis hereingereicht |
| `hooks/use-session-headers` (2) | siehe unten — braucht nur `isSignedIn` |
| `types/item` (1) | `Item` ist das Mongo-Modell → `@ks/contracts`, wie `DocCardMeta` |
| `types/source-user-state` (1) | Rest-Typen → `@ks/contracts` |
| `lib/{storage,mappers,i18n,graph,documents}` (5) | je eine Funktion; pruefen, ob sie mitzieht oder in `@ks/util`/`@ks/contracts` gehoert |
| `hooks/use-scroll-visibility`, `use-debounced-value` (2) | generische React-Hooks; `@ks/util` scheidet aus (React-frei), also `@ks/ui` oder mitziehen |

### Ein Befund, der eine frueher Aussage einschraenkt

Der Nachtrag zur Welle „Galerie-Betrachter" sagt, die Galerie kenne keinen
Auth-Anbieter mehr. **Das galt nur eine Ebene tief.** `use-session-headers`
ruft intern `useUser()` von Clerk, und die Galerie nutzt den Hook an zwei
Stellen.

`galerie-schnitt.test.ts` prueft das jetzt eine Ebene weiter: Ziehen die
App-Module, die die Galerie importiert, ihrerseits einen Anmeldedienst? Der
bekannte Umweg steht als **begruendete Ausnahme** darin, nicht stillschweigend.
Dass der Test greift, ist nachgewiesen — ohne die Ausnahme wird er rot.

**Warum nicht gleich behoben**: Der Hook braucht von Clerk nur `isSignedIn` —
genau das, was der Betrachter traegt. Von fuenf weiteren Aufrufern hat aber nur
einer den Wert zur Hand; der Umbau haette vier Chat-Dateien und einen App-Hook
mitgezogen. Eigene kleine Welle, keine Nebenwirkung dieser hier.

## Nachtrag (2026-08-30): Gruppe C, erste Haelfte

Von **20 Importgruppen auf 17**. Entschieden wurde nach drei Fragen: Wie viele
Zeilen? Welche Importe (also: rein oder nicht)? Wie viele Nutzer ausserhalb der
Galerie?

| Posten | Zeilen | Importe | Nutzer ausserhalb | Entscheidung |
|---|---:|---|---:|---|
| `shadow-twin-folder-name` | 81 | **keine** | 12 | → `@ks/util` |
| `synergy-sum` | 121 | **keine** | **0** | → `src/lib/gallery/` (zieht mit) |
| `use-debounced-value` | 25 | nur React | **0** | → `src/hooks/gallery/` (zieht mit) |
| `TemplatePreviewDetailViewType` | — | — | — | war laengst ein Alias auf `DetailViewType` → direkt aus `@ks/contracts` |

Die dritte Spalte war der Entscheider. **Null Importe und null Fremdnutzer**
heisst: zieht mit dem Modul, keine Diskussion. **Null Importe und zwoelf
Fremdnutzer** heisst: gehoert allen, also in den Werkzeugkasten.

### Was noch offen ist — 17 Gruppen

**Zieht mit (19 Importe)**: `utils/document-slug`, `atoms/gallery-filters`,
`atoms/chat-references-atom`, `atoms/gallery-data`, `utils/document-navigation`.

**Muss injiziert werden (6)**: `atoms/job-monitor-panel-open-atom` (4),
`components/submissions` (1), `atoms/story-context-atom` (1).

**Braucht je ein Urteil (12)**:

| Posten | Befund | Schwierigkeit |
|---|---|---|
| `lib/detail-view-types` (3) | `getSummableFields`, `getPresentDetailViewTypes` rechnen ueber die Registry; die Registry-DATEN sind rein (Audit-Befund 3b), der Rest nicht | mittel — Registry-Daten koennten in den Vertrag |
| `types/item` (1) | **444 Nutzer** im Repo | eigene Welle, kein Schwanz-Posten |
| `lib/i18n/get-localized` (1) | 259 Z., haengt an `@ks/i18n` und `@/types/doc-meta`, 8 Fremdnutzer | mittel |
| `lib/templates/detail-view-type-utils` (1) | 41 Z., drei Importe, 7 Fremdnutzer | bleibt App |
| `lib/mappers/doc-meta-mappers` (1) | 689 Z., Detailansichten-Mapper | zieht mit dem Modul |
| `lib/documents/sdg-meta` (1) | rein, aber **Fachlogik** — `@ks/util` verbietet die ausdruecklich, `@ks/contracts` rechnet nicht | **Luecke in der Paketstruktur** |
| `hooks/use-session-headers` (2) | seit der Entkopplung Clerk-frei | zieht mit; die App nimmt dann `useClerkSessionHeaders` aus dem Paket |
| `hooks/use-scroll-visibility` (1) | 62 Z., React, 3 Fremdnutzer | → `@ks/ui` |
| `types/source-user-state` (1) | Rest-Typen | → `@ks/contracts` |

### Ein Befund, der ueber den Schwanz hinausgeht

`sdg-meta` passt in kein vorhandenes Paket: Es ist rein und wird von beiden
Seiten gebraucht, ist aber **Fachlogik** — und `@ks/util` schliesst Fachlogik
ausdruecklich aus, waehrend `@ks/contracts` beschreibt statt zu rechnen.

Dasselbe wird fuer `synergy-sum` gelten, sobald es jemand ausserhalb der
Galerie braucht. Es fehlt ein Ort fuer **geteilte Dokument-Fachlogik ohne
UI** — heute behilft sich das Repo mit `src/lib/documents/`, was aus einem
Paket nicht erreichbar ist. Das ist keine Schwanz-Frage mehr, sondern eine
Zuschnitt-Frage fuer den Umzug.
