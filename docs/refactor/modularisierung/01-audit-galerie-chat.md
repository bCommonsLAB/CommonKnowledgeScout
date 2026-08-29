# Bestands-Audit: die Chat-Kopplung der Galerie

Stand: 2026-08-29. Fortsetzung von
[`00-audit-galerie.md`](00-audit-galerie.md), dessen Befund 2 und Fremdkegel
die Chat-Kopplung als „ungeschnitten" auswiesen.

Reine Doku; es wurde kein Code geaendert.

## Die Frage

Das erste Audit stellte fest: „Sieben Galerie-Dateien haengen am Chat. Die
Galerie laesst sich nicht als Paket schneiden, ohne den Chat mitzunehmen oder
diese Verbindung zu kappen."

Der Chat ist gross — `src/components/library/chat/` (38 Dateien, 7.459 Zeilen)
plus `src/lib/chat/` (32 Dateien, 9.907 Zeilen). Ihn mitzunehmen waere eine
Verdopplung des Vorhabens.

**Die Messung ergibt etwas anderes als erwartet.** Die Frage „wie schneiden wir
die Galerie vom Chat los" ist falsch gestellt.

## 1. Die Kopplung besteht fast nur aus Typen

Was die Galerie tatsaechlich aus dem Chat-Bereich importiert:

| Art | Woher | Wie oft |
|---|---|---|
| Typen | `@/types/chat-response`, `@/types/query-log` | 9 Dateien |
| Atom | `@/atoms/chat-references-atom` | 4 Dateien |
| **Komponente** | `chat/chat-reference-list` | **2 Dateien** |
| Slot (lazy) | `chat/chat-panel` per `next/dynamic` | 1 Datei |

Nur **drei** Galerie-Dateien fassen ueberhaupt Chat-*Code* an. Der Rest sind
Typen — und dort wird es interessant.

## 2. Die Galerie greift durch die Typen hindurch

Gezaehlt ueber den gesamten Galerie-Kegel:

| Ausdruck | Treffer |
|---|---|
| `ChatResponse['references']` | 10 |
| `QueryLog['sources']` | 7 |
| `ChatResponse` (meist nur als Traeger fuer den Index-Zugriff) | 9 |
| `QueryLog` (dito) | 10 |

Die Galerie will fast nie die Chat-Antwort. Sie will die **Referenzen** — und
muss dafuer durch einen Chat-Typ hindurchgreifen.

Was sie wirklich braucht, sind zwei kleine Formen:

```ts
// aus ChatResponse['references']
{ number, fileId, fileName?, description, detailViewType? }

// aus QueryLog['sources']
{ id, fileName?, chunkIndex?, score? }
```

Beides beantwortet dieselbe Frage: **welches Dokument wurde zitiert, und
warum**. Das ist kein Chat-Begriff. `ChatResponse` traegt daneben
`answer` und `suggestedQuestions`, `QueryLog` 132 Zeilen Retrieval-Diagnostik
(Zeitmessungen, Cache-Hashes, Prompt-Infos) — davon nutzt die Galerie nichts.

## 3. Der Befund, der die Fragestellung umdreht

**`ChatReferenceList` liegt im Chat-Ordner und wird ausschliesslich von der
Galerie benutzt.**

Vier Konsumenten, alle in der Galerie: `grouped-items-grid`,
`grouped-items-table`, `reference-group-header`, `references-legend`. Der
Chat-Bereich selbst rendert die Komponente **nirgends** — geprueft ueber jede
Erwaehnung des Namens im Repo (ausser der Datei selbst und ihren Tests).

568 Zeilen (Komponente + Helfer) Galerie-Oberflaeche, einsortiert unter `chat/`.

## 4. Die Abhaengigkeit zeigt ueberwiegend in die andere Richtung

| Richtung | Dateien |
|---|---|
| Chat → Galerie | **7** |
| Galerie → Chat | **3** |

Der Chat liest `GalleryFilters` (14 Vorkommen), `galleryFiltersAtom` (4) und
`useGalleryData` (2). Er haengt an der Galerie **staerker** als umgekehrt.

> **Korrektur (nachtraeglich, 2026-08-29)**: Die erste Fassung nannte diese
> Gegenrichtung „das eigentliche Mass" und forderte, sie aufzuloesen. Das war
> falsch. Laut [`modul-landkarte.md`](../../architecture/modul-landkarte.md) §5
> gehoeren Galerie UND Chat demselben Modul `@ks/module-explorer`. Ein
> Chat→Galerie-Import ist damit **paketintern** und verletzt keine Grenzregel
> (§4 erlaubt `apps/* → @ks/module-*`; verboten waere nur Modul→Modul).
>
> Die Beobachtung bleibt richtig und nuetzlich — sie zeigt, wie verwoben die
> beiden sind. Aber sie ist **kein Hindernis fuer das Galerie-Paket**, und die
> Zahl 7 ist kein Fehlerzaehler.

## 5. Was hier wirklich vorliegt

Galerie und Chat teilen sich eine **Mittelschicht, die keinen Namen hat**.
Weil sie keinen hat, liegen ihre Teile mal beim einen, mal beim anderen:

| Baustein | Zeilen | Liegt heute bei | Gehoert |
|---|---:|---|---|
| Referenz-Vokabular (`references`, `sources`) | 9 von 179 | Chat (`types/chat-response`, `types/query-log`) | beiden |
| `chatReferencesAtom` — Chat schreibt, Galerie liest | 12 | neutral (`src/atoms/`) | der Uebergabe |
| `ChatReferenceList` + Helfer | 568 | Chat | **nur der Galerie** |
| `galleryFiltersAtom` / `GalleryFilters` | 7 | Galerie | beiden |
| `chat-panel` | — | Chat | dem Chat (Slot) |

Das ist dasselbe Muster wie Befund 1 des ersten Audits (`src/lib/gallery/` war
nicht die Galerie) und wie Befund 3c (eine Werteliste an dreizehn Orten): Ein
geteilter Begriff ohne Zuhause wandert dorthin, wo er zuerst gebraucht wurde,
und sieht danach wie eine Abhaengigkeit aus.

## 6. Optionen

| Option | Umfang (gemessen) | Verdikt |
|---|---|---|
| **A — Chat mitnehmen** ins selbe Paket | 70 Dateien, 17.366 Zeilen zusaetzlich | **nein.** Verdoppelt das Vorhaben und loest die Verflechtung nicht, sondern schliesst sie ein. Die 7 Chat→Galerie-Bezuege blieben genauso bestehen, nur paketintern. |
| **B — die Mittelschicht benennen** | Referenz-Vokabular nach `@ks/contracts` (9 Zeilen Form, 9 Importstellen); `ChatReferenceList` in die Galerie verschieben (568 Zeilen, `git mv`, 4 Konsumenten unveraendert); `GalleryFilters` nach `@ks/contracts` (7 Zeilen, 18 Vorkommen im Chat) | **empfohlen.** Jeder Schritt ist fuer sich klein, verhaltensneutral und einzeln pruefbar. Danach traegt kein geteilter Begriff mehr das Etikett einer Seite. |
| **C — Referenzen ganz aus der Galerie werfen** | betrifft 4 Ansichten (`grouped-*`, `references-*`) | zurueckgestellt. Waere eine Funktions-Entscheidung („die Galerie zeigt keine Chat-Treffer mehr"), keine Umbau-Entscheidung. Gehoert dem Owner, nicht einer Refactoring-Welle. |

**Empfehlung: B**, in dieser Reihenfolge:

1. **`ChatReferenceList` zieht um** — reines `git mv` plus vier Importzeilen.
   Der billigste Schritt mit der groessten Wirkung: danach faellt die
   Komponenten-Kopplung von 2 Dateien auf 0.
2. **Referenz-Vokabular nach `@ks/contracts`** — `DocReference` und
   `QuerySource`; `ChatResponse` und `QueryLog` verweisen darauf, statt die
   Formen selbst zu tragen.
3. **`GalleryFilters` nach `@ks/contracts`** — nicht wegen der Modulgrenze
   (siehe Korrektur), sondern weil der Typ **persistiertes Vokabular** ist: Er
   steht in Cache-Schluesseln und in den Abfrage-Protokollen in MongoDB.
   Dieselbe Begruendung wie bei `DocCardMeta`.
4. ~~**Das Uebergabe-Atom injizieren**~~ — **entfaellt.** Die Injektion aus M4e
   war noetig, weil `@ks/shell` nichts ueber Galerie-Filter wissen darf
   (Paket → App waere rueckwaerts). Hier liegen beide Seiten im selben Modul;
   die Atome wandern beim Paketschnitt einfach mit und werden dort zu
   paketinternem Zustand mit Hooks nach aussen — genau wie in M4e mit den
   Auswahl-Atomen geschehen.

Schritte 1 bis 3 sind zusammen eine Welle.

## 7. Beweis-Ziele

- **Nach Schritt 1**: ein Test, der Importe aus `src/components/library/chat/`
  im Galerie-Kegel verbietet. Er ist dann sofort gruen und haelt es fest.
- **Kein Test fuer die Gegenrichtung.** Die erste Fassung forderte einen —
  siehe die Korrektur unter Befund 4. Da beide Seiten ins selbe Modul gehoeren,
  waere ein solcher Test eine erfundene Regel, die spaeter im Weg staende.

## 8. Was dieses Audit NICHT beantwortet

- **Ob `chat-panel` als Slot bleibt.** Heute laedt `gallery-root` ihn per
  `next/dynamic`. Fuer ein Paket muesste er als Prop hereinkommen — das ist
  dieselbe Frage wie bei der Galerie im Explorer (M4) und faellt mit der
  Adressierungs-Welle zusammen.
- **Ob die Galerie ueberhaupt Chat-Referenzen zeigen soll** (Option C). Das ist
  eine Produktfrage.
- **Der Zuschnitt von `src/lib/chat/`** (9.907 Zeilen). Dieses Audit misst nur
  die Beruehrungsflaeche zur Galerie, nicht den Chat selbst.


## Nachtrag (2026-08-29): Schritte 1 bis 3 sind umgesetzt

Umgesetzt in derselben Session, Branch `claude/audit-galerie-chat-kopplung`.

| Schritt | Ergebnis |
|---|---|
| 1 — `ChatReferenceList` → `gallery/reference-list.tsx` | erledigt, `git mv` samt Helfern und beiden Tests |
| 2 — `DocReference` / `QuerySource` → `@ks/contracts` | erledigt; auch das Uebergabe-Atom traegt jetzt `DocReference` |
| 3 — `GalleryFilters` → `@ks/contracts` | erledigt; sechs Chat-Dateien lesen den Typ direkt aus dem Vertrag |
| 4 — Injektion | **entfaellt**, siehe Korrektur oben |

**Was jetzt noch von der Galerie zum Chat zeigt**: das Uebergabe-Atom
(`chat-references-atom`, vier Stellen) und der Chat-Panel-Slot in
`gallery-root`. Beide sind paketintern, wenn Galerie und Chat gemeinsam nach
`@ks/module-explorer` wandern — sie sind also **keine offene Schuld**, sondern
Teil des Paketschnitts selbst.

**Was vom Chat zur Galerie zeigt**: drei Stellen, alle Zustand
(`galleryFiltersAtom` zweimal, `useGalleryData` einmal). Ebenfalls paketintern.

**Die Lehre dieses Audits**, unabhaengig vom Ergebnis: Beide Male, als etwas
wie eine Abhaengigkeit aussah, war es ein geteilter Begriff ohne Zuhause. Und
einmal war die Grenze, die ich verteidigen wollte, gar keine — sie stand nur in
meinem Kopf, nicht in der Landkarte. Wer eine Regel durchsetzen will, sollte
zuerst nachsehen, ob es sie gibt.
