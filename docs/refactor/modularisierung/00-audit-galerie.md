# Bestands-Audit: die Galerie (Vorarbeit zur naechsten Modularisierungs-Welle)

Stand: 2026-08-29. Erstellt nach dem Merge von PR #217 (M4e + M4).

Dieses Audit liegt bewusst hier und nicht unter `docs/refactor/galerie/`: Es
folgt nicht dem Playbook-Format der Welle-3-Audits (Rules/Tests/Docs-Inventar),
sondern dem Muster der Eingangsmessung aus
[`AGENT-BRIEF-M4.md`](AGENT-BRIEF-M4.md) — messen, dann Optionen, dann Verdikt.
Es ist reine Doku; es wurde kein Code geaendert.

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
Begruendung steht in Befund 3d und im Abschnitt „G3 im Detail". Ihre Bauart
unterscheidet sich:

- `divaTexture` und `refurbedDevice` tragen ihre Besonderheit **in eigenen
  Dateien** (plus, bei `divaTexture`, 594 Zeilen eigene API-Routen).
- `climateAction` hat die groesste Scheibe (1.325 Zeilen) und den staerksten
  Grund: **770 Zeilen davon liegen heute im generischen Galerie-Ordner** —
  SDG-Rad, SDG-Icons, SDG-Profil, Stakeholder-Positionen, `sdg-meta`,
  `stakeholder-meta`. Der Schnitt ist sauber: diese Bausteine haben genau drei
  Konsumenten (`climate-action-detail.tsx`, `detail-overlay.tsx`,
  `doc-meta-mappers.ts`), alle klimabezogen.

### Befund 3c — es gibt fuenf Kopien der Typ-Liste

Die neun Typen stehen **fuenfmal** hartkodiert im Repo:

| Ort | Form |
|---|---|
| `detail-view-types/registry.ts:31` | `DETAIL_VIEW_TYPES` — die Quelle |
| `lib/chat/config.ts:128` | `z.enum([...])`, obwohl `detailViewTypeSchema` daneben liegt |
| `chat/chat-panel.tsx:175` | `validDetailViewTypes` |
| `hooks/gallery/use-gallery-config.ts:9` | lokale `type DetailViewType`-Union |
| `gallery/gallery-root/helpers.ts:19` | `VALID_DETAIL_VIEW_TYPES` |

Fuenf Listen, von Hand synchron gehalten. Dazu die Negativ-Liste aus Befund 3
und der stille Wegwurf im Parser (`template-parser.ts:85`).

**Das ist die eigentliche Krankheit** — nicht die Modulgrenze. Wer nur Pakete
schneidet und diese fuenf Listen stehen laesst, hat Kosmetik betrieben.

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
| **B — drei Vorarbeits-Wellen** (G1 Typen, G2 Adressierung, G3 eine Quelle) | G1: `types.ts` (346 Z.) nach `@ks/contracts`, 54 Importstellen. G2: Adressier-Protokoll statt `next/navigation`, 10 Dateien + `document-navigation` (130 Z.). G3: vier Verteilstellen fragen die Registry, vier Listen-Kopien fallen weg (siehe unten) | **empfohlen.** Jede Welle passt einzeln ins Budget, jede ist fuer sich verhaltensneutral (G4). **G3 traegt sich selbst** — es repariert die stillen Fallbacks und haengt an keiner Modularisierungs-Entscheidung. |
| **C — nur die Kachelwand** (`document-card` + Raster, ohne Tabelle, Graph, Detail) | ~2.400 Zeilen | zurueckgestellt. Liefert schnell etwas Einbettbares, verschiebt Befund 2 aber nur (`document-card.tsx` importiert selbst `next/navigation` und `next/image`) — und Landkarte §5 will fuer M5 „Galerie/Story", nicht Kacheln. |

**Empfehlung: B, in der Reihenfolge G1 → G2 → G3.** G2 ist die Welle, die das
Einbetten tatsaechlich freischaltet; G1 muss davor, weil sonst jede Bewegung
des Kerns Server-Code mitreisst.

### G3 im Detail — eine Quelle, eine Verteilstelle. Keine Pakete.

Die erste Fassung dieses Audits empfahl „ein Paket pro `detailViewType`".
**Das wird hier zurueckgenommen**, weil Befund 3d es widerlegt: die
Faehigkeiten (Kommentare, Sterne, Graph, Story) spannen bereits ueber alle
Typen. Ein Typ-Paket wuerde sie entweder duplizieren oder eine Abhaengigkeit
quer durch fuenf Pakete ziehen. Und die Typ-Bindung, die ein Paket aufloesen
soll, umfasst nur 8 von 103 Dateien.

Was stattdessen zaehlt und fuer sich allein traegt:

- **G3 — eine Quelle statt fuenf Listen, eine Verteilstelle statt vier
  Zweigen.** Die vier Verteilstellen aus Befund 3d fragen die Registry, statt
  Typen zu vergleichen; die vier Kopien der Typ-Liste verschwinden zugunsten
  von `DETAIL_VIEW_TYPES`; `template-parser.ts:85` meldet einen unbekannten
  Wert, statt ihn wegzuwerfen. Ergebnis: ein neuer Typ ist **additiv**, und
  ein Typ ohne Renderer ist ein Fehler statt einer Buch-Ansicht.
  Das ist die Welle mit dem besten Verhaeltnis von Aufwand zu Wirkung — und
  sie haengt an keiner Modularisierungs-Entscheidung.
- **G3+ (klein, optional) — die Prio-Spalte entkosten.** Aus
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

- **Nach G1**: ein Test, der Importe aus `src/lib/gallery/**` in
  `src/lib/repositories/**` und `src/lib/external-jobs/**` verbietet.
- **Nach G2**: ein Test, der `next/navigation` im Galerie-Baum verbietet.
- **Nach G3**: ein Test, der jeden Wert aus `DETAIL_VIEW_TYPES` auf einen
  angemeldeten Renderer abbildet — ein neuer `detailViewType` ohne Renderer
  laesst ihn rot werden. **Heute waere dieser Test rot** (`testimonial`, `blog`),
  er ist also zugleich der Nachweis, dass G3 etwas repariert. Ein zweiter Test
  haelt fest, dass die Typ-Liste nur EINMAL existiert.

## 6. Was dieses Audit NICHT beantwortet

- **Ob die Galerie ohne Clerk laeuft.** Drei Dateien lesen `useAuth`/`useUser`
  direkt (`gallery-root.tsx:43`, `use-library-role.ts:4`,
  `use-is-library-owner.ts:4`). Beim Explorer reichten zwei Booleans; ob das
  hier traegt, ist ungeprueft. Haengt an derselben offenen Frage wie die TopNav:
  wie traegt `@ks/shell` Auth abschaltbar? Das ist ein ADR, keine Welle.
- **Die Basis-URL fuer Modul-Fetches.** Offen aus M4, bewusst nicht gebaut (G3),
  braucht das Token-Modell aus ADR 0008.
- **Die Zuordnung der 11 `/api/chat/*`-Routen.** M4 hat den Namensraum dem
  Explorer zugeschrieben; was davon der Galerie gehoert und was dem Chat, ist
  offen — und die Kuratierungs-Routen widersprechen der M4-Ausnahmeliste.
- **Story und Chat.** Dieses Audit misst nur die Galerie.
  `src/components/library/story/` und `src/components/library/chat/` gehoeren
  laut Landkarte §5 in dasselbe Modul und sind nicht vermessen.
