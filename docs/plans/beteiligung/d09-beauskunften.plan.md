---
name: d09-beauskunften
overview: "Detailkonzept D9: Teilnehmende und Moderation fragen die Library und bekommen Antworten mit Quellenangabe. Was im Suchindex steht und was nicht, Zugang für Contributors im Chat-Loader, Eingrenzung auf Handlungsfeld und Thema über Facetten, mobile Einbettung am Tisch, Quelle auf den Beamer."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D9 · Beauskunften

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Abschnitt 5: Teilnehmende und die Library),
[D8](d08-ergebnis-und-ingest.plan.md) (Facetten, `sourceLabel`),
[D11](d11-rechte-und-sichtbarkeit.plan.md). Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| T-S9.1 Was liegt dazu vor? | Unterlagen zum Thema mit Herkunft; eine Frage stellen, Antwort mit Quelle |
| M-S9.2 Nachschlagen | Die Moderation sucht im Gespräch eine Zahl oder Quelle; „Quelle auf Beamer zeigen“ |

## 2. Was im Suchindex steht

| Inhalt | Im Index | Grund |
|---|---|---|
| Unterlagen der Reihe (Grundsatzdokument, Planungsdokumente in `Veranstaltungen/{Reihe}/Unterlagen/`) | ja, über die normale Pipeline | Arbeitsgrundlage |
| Textstellen | ja, über die normale Pipeline (Transformation mit einer schlanken Vorlage, damit `handlungsfeld` und `thema` als Facetten stehen) | Frage „was steht im Ziel 3?“ |
| Organisations-Dokumente | ja, mit `organisationen` im Frontmatter | Quelle mit Herkunft |
| Ergebnisse, **freigegeben** | ja (D8) | veröffentlichtes Wissen |
| Ergebnisse, vom Tisch bestätigt | nein | noch nicht freigegeben (Owner 21.09.) |
| **Einzelbeiträge** | **nein** (V1) | Vertrauensraum; Beiträge sind im Archiv, nicht im Index (D5) |
| Planungsdateien (`_reihe.md`, `_treffen.md`, `_tisch.md`, `_organisation.md`) | nein | Planung, keine Auskunft; sie werden nie ingestiert (sie tauchen nur dann im Index auf, wenn jemand sie ausdrücklich ingestiert; `.md` ohne Twin wird nicht automatisch verarbeitet) |

Bei V2/V3 (D11) kämen Beiträge in den Index, nur für die berechtigten
Rollen sichtbar. Das braucht einen Filter nach `docType` mit Ausschluss
(4).

## 3. Zugang

Beabsichtigt darf eine Contributorin heute nicht chatten: Der Loader
lässt eigene Libraries zu, dann Co-Creator (`isCoCreatorOrOwner`,
`loader.ts:296-302`), sonst nur öffentliche Libraries (`:306-315`). Der
Zweig für `requiresAuth` (`:320-330`) läuft nur für eigene Libraries.
**Wirksam** kommt sie heute durch, weil `isCoCreatorOrOwner` über
`getLibrary` jedes aktive Mitglied durchlässt (Prüfbericht 24.09. §1,
O10). Die Öffnung unten ist deshalb kein neues Recht, sondern macht ein
unbeabsichtigtes explizit und konfigurierbar.

**Änderung:** `loadLibraryChatContext` lässt aktive Mitglieder jeder
Rolle zu. Dazu gehört `contributor`, **wenn die Library eine Einstellung
`chat.allowMemberRoles` mit dieser Rolle enthält** (für das SHF:
`['moderator', 'contributor']`). Ohne Einstellung bleibt es wie heute.
Das ist eine bewusste, konfigurierte Öffnung, kein stiller Standard.

- Die Entwurfsregel gilt beabsichtigt: Contributors sehen keine Entwürfe
  (`publication-filter.ts:57-63`); wirksam heute wie oben (O10).
- Das Kontext-Cache von 5 min (`CACHE_TTL_MS`, `loader.ts:49`) bleibt;
  Rechteänderungen wirken also verzögert.
- Es gilt der Contract `contracts-ingestion-chat`.

## 4. Eingrenzung auf das Thema

Die Frage am Tisch gehört zu einem Handlungsfeld und oft zu einer
Textstelle:
- Der Chat-Stream nimmt Facetten-Filter heute aus den URL-Parametern, wenn
  ihr Schlüssel eine konfigurierte Facette ist (`stream/route.ts:189-204`).
  Daraus wird `$in` (`filters.ts:105-139`).
- Die Tisch-Ansicht ruft den Chat deshalb mit `?handlungsfeld=…` (und
  optional `?thema=…`) auf. Die Facetten aus D8 machen das möglich.
- Einen **Ausschluss** (`$nin`) gibt es heute nicht. Er ist bei V1 nicht
  nötig, weil Beiträge nicht im Index stehen. Bei V2/V3 kommt ein
  Ausschluss-Parameter dazu, zum Beispiel `?not_docType=beitrag`.

## 5. Oberfläche am Tisch

- Heute läuft `ChatPanel({libraryId, variant: 'embedded'})`
  (`src/components/library/chat/chat-panel.tsx:52-55`) im Story-Modus der
  Galerie. Eine eigene mobile Chat-Seite gibt es nicht. Im Embed ist der
  Chat bewusst ausgeschlossen (`docs/STAND.md`, Vorhaben 1).
- **Neu:** eine Seite `/t/[qrToken]/fragen` bzw. ein Bereich im
  Tisch-Ablauf. Sie montiert `ChatPanel variant="compact"` mit den
  Facetten-Filtern des Tisches und zeigt die Unterlagen des
  Handlungsfelds als Liste (Galerie-Daten mit Filter `handlungsfeld`).
- **Quelle auf den Beamer:** Die Moderation markiert eine Quelle. Der
  Beamer (D4) zeigt deren Titel, `sourceLabel` und die zitierte Stelle.
  Das ist eine Aktion `mirror_source {fileId, chunkRef?}` in der
  Tisch-Laufzeit.

## 6. Schnittstellen

### 6.1 Bestand

| Zweck | Bestand |
|---|---|
| Kontext und Zugang | `loadLibraryChatContext` (`src/lib/chat/loader.ts:262`) |
| Stream | `POST /api/chat/[libraryId]/stream` (`route.ts`, Facetten-Filter `:189-204`) |
| Filter | `buildVectorSearchFilter` (`src/lib/chat/common/filters.ts:105-139`) |
| Entwurfsregel | `publication-filter.ts` |
| Quellen | `DocReference` (+ `sourceLabel`, D8), `chat-document-sources.tsx` |
| Panel | `ChatPanel` (`chat-panel.tsx:52`) |
| Liste der Unterlagen | `GET /api/chat/[libraryId]/docs` mit Facetten-Filter |

### 6.2 Neu

| Baustein | Signatur |
|---|---|
| Einstellung | `chat.allowMemberRoles?: LibraryRole[]` (Library-Config-Feld nach `library-config-field.md`) |
| Loader | Zweig „aktives Mitglied mit erlaubter Rolle“ |
| Ausschluss (nur bei V2/V3) | Parameter `not_<metaKey>` → `$nin` in `buildVectorSearchFilter` |
| Tisch-Seite | `/t/[qrToken]/fragen` (Panel + Unterlagen), Aktion `mirror_source` (D4) |
| Vorlage | schlanke Transformationsvorlage für Textstellen (Facetten `handlungsfeld`, `thema`, `textstelle_id`) |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Contributor ohne Einstellung `allowMemberRoles` | Wie heute: kein Zugang (404/401), keine stille Öffnung |
| Facette nicht konfiguriert | Der Filter-Parameter wird ignoriert, wie der Bestand es tut (nur konfigurierte `metaKey`s). **Das ist ein stiller Fallback des Bestands**: D8 prüft deshalb die Facetten bei der Freigabe |
| Keine Treffer | Antwort ohne Quellen mit Hinweis; kein Rückgriff auf Wissen außerhalb der Library (Bestandsverhalten des Chats) |

## 8. Tests

- Loader: Contributor mit und ohne Einstellung; Moderator; Entwurfsregel
  für Contributors.
- Stream mit `handlungsfeld`-Filter: nur Treffer aus dem Handlungsfeld.
- Bei V2/V3: Ausschluss `not_docType=beitrag`.

## 9. Offene Fragen

1. Soll die Frage am Tisch gespeichert werden (Chat-Verlauf, `chats`,
   `queries`)? Heute speichert der Chat Verläufe. Für den Vertrauensraum
   ist zu klären, ob Fragen am Tisch der Person zugeordnet bleiben.
2. Die Library-Wunschliste der Redaktion (eine Library je Organisation) ist
   ein eigenes Vorhaben. D9 deckt die gemeinsame Library ab.

**Eingrenzung nicht starr (Owner 24.09., O18):** Die automatische
Eingrenzung auf das Handlungsfeld kann Quellen ausschließen, die sachlich
dazugehören; Zusammenhänge zwischen Handlungsfeldern sind der Normalfall.
Vorschlag: Die Eingrenzung ist Voreinstellung, nicht Zwang. Die
Tisch-Ansicht zeigt den aktiven Filter sichtbar an, mit Umschalter „in
allen Handlungsfeldern suchen“; die Antwort nennt bei erweiterter Suche,
aus welchem Handlungsfeld eine Quelle stammt (`sourceLabel`, D8). Kein
stilles Erweitern durch die App.

## 10. Aufwand

| Teil | PT |
|---|---|
| Einstellung und Loader-Zweig mit Tests | 0,5–1 |
| Tisch-Seite mit Panel, Filtern und Unterlagen-Liste (Gerüst) | 1 |
| Quelle auf den Beamer | 0,5 |
| Textstellen-Vorlage | 0,5 |
| **Summe D9** | **2,5–3** |
