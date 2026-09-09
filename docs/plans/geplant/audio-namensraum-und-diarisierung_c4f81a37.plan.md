---
name: audio-namensraum-und-diarisierung
overview: "Alle Audio-Endpunkte des Secretary unter /audio zusammenführen (realtime/* zieht um), einen eigenen Endpunkt für die Sprecher-Erkennung ergänzen und im KnowledgeScout die Wahl zwischen beiden Wegen samt Auswertung der Sprecher-Segmente einbauen."
todos:
  - id: a1-namensraum-umzug
    content: "Secretary: /realtime/transcription-session und /realtime/usage nach /audio/* umziehen, Namespace 'realtime' ersatzlos entfernen (harter Schnitt, Owner-Entscheidung). Tests auf die neuen Pfade."
    status: pending
  - id: a2-scout-pfad
    content: "KnowledgeScout: TICKET_PATH in lib/secretary/realtime-ticket.ts auf 'audio/transcription-session' umstellen, Dienst-Doku nachziehen. Zusammen mit A1 ausrollen."
    status: pending
  - id: b1-use-case-diarisiert
    content: "Secretary: Use-Case 'diarized_transcription' im Enum, in der Maske (Label, Default) und in available_models; Seed-Skript ergänzt gpt-4o-transcribe-diarize für diesen Use-Case."
    status: pending
  - id: b2-endpunkt-diarisiert
    content: "Secretary: POST /audio/process-diarized mit response_format=diarized_json und chunking_strategy (ab 30 s Pflicht); Antwort mit Sprecher-Segmenten statt einem Block."
    status: pending
  - id: b3-sprecher-ueber-segmentgrenzen
    content: "Secretary: Entscheiden und umsetzen, wie Sprecher-Kennungen über mehrere Datei-Segmente hinweg zusammengeführt werden (siehe Risiko 2). Ohne diesen Schritt ist Diarisierung auf Material unter 25 Minuten begrenzt."
    status: pending
  - id: b4-doku-endpunkt
    content: "Dienst-Doku aktualisieren: docs/_secretary-service-docu/audio.md (KnowledgeScout) und die Secretary-Doku um den neuen Endpunkt, sein Antwortformat und den Zielkonflikt prompt/Diarisierung."
    status: pending
  - id: c0-library-voreinstellung
    content: "KnowledgeScout: Per-Library-Feld 'transkription_mit_sprechern' nach der Checkliste docs/contracts/library-config-field.md (Typen, toClientLibraries, Form-Schema, ALLE form.reset-Stellen, Submit, FormField)."
    status: pending
  - id: c1-scout-auswahl
    content: "KnowledgeScout: Übersteuerung pro Datei im Transformations-Dialog (audio-transform.tsx, eingebunden über audio-player.tsx) — Voreinstellung der Library ist vorbelegt. Endpunktwahl bis in external-jobs/secretary-request.ts durchreichen."
    status: pending
  - id: c2-scout-auswertung
    content: "KnowledgeScout: Sprecher-Segmente zu Absätzen mit Präfix aufbereiten (aufeinanderfolgende Segmente desselben Sprechers zusammenfassen); extract-audio-text.ts erweitern, speakers als flaches Frontmatter-Feld."
    status: pending
  - id: d-stimmproben
    content: "Optional, spätere Welle: known_speaker_names/known_speaker_references, damit statt 'Sprecher A' die echten Namen erscheinen."
    status: pending
---

# Audio-Namensraum und Sprecher-Erkennung

## Warum

Zwei Dinge sollen zusammenkommen:

1. **Aufräumen.** Alles, was mit Audio zu tun hat, gehört unter `audio`. Heute steht
   die Live-Transkription in einem eigenen Namensraum `realtime`, weil sie dort
   entstanden ist — fachlich ist sie aber Audio-Verarbeitung wie `audio/process`.
2. **Sprecher-Erkennung.** `gpt-4o-transcribe-diarize` liefert Transkripte mit
   Sprecher-Zuordnung, wird aber heute nirgends angesprochen.

## Ist-Zustand

```
POST /audio/process                      Datei-Transkription (Volltext)
POST /realtime/transcription-session     Ticket für die Live-Transkription
POST /realtime/usage                     Verbrauchsmeldung der Live-Sessions
```

Sprecher-Erkennung gibt es nicht. Der Provider fordert `verbose_json` an (Rückfall
`json`), liest nur `response.text` und baut daraus **ein einziges** Segment
(`openai_provider.py`, `TranscriptionSegment(segment_id=0, start=0)`). Selbst mit dem
Diarisierungsmodell käme nichts an, weil `response_format: "diarized_json"` fehlt.

## Zielbild

```
POST /audio/process                      Datei-Transkription (Volltext)          unverändert
POST /audio/process-diarized             Datei-Transkription mit Sprechern       neu
POST /audio/transcription-session        Ticket für die Live-Transkription       umgezogen
POST /audio/usage                        Verbrauchsmeldung                       umgezogen
```

## Entscheidungen

### Eigener Endpunkt statt Schalter am bestehenden

Die Sprecher-Erkennung ist kein Zusatz, sondern ein anderer Vertrag:

| | `/audio/process` | `/audio/process-diarized` |
|---|---|---|
| Antwortformat | `verbose_json` / `json` | `diarized_json` |
| Antwortform | ein Volltext | Segmente mit `speaker`, `start`, `end`, `text` |
| `prompt` | ja | **nein** (Anbieter erlaubt es nicht) |
| `keywords` | ja (bei `gpt-transcribe`) | nein |
| `chunking_strategy` | optional | **Pflicht ab 30 Sekunden** |
| Modell | `transcription` | `diarized_transcription` |

Ein Schalter, der die halbe Semantik umdreht, wäre schwerer zu dokumentieren und zu
testen als zwei Endpunkte mit je klarem Vertrag.

### Modellwahl bleibt in der Maske

Ein **dritter Use-Case** `diarized_transcription` statt eines Modellnamens im Code.
Damit bleibt das Muster erhalten: Der Code kennt keine Modellnamen, die Maske
entscheidet. Das Seed-Skript trägt `gpt-4o-transcribe-diarize` für diesen Use-Case ein.

### Darstellung im Markdown: Präfix je Absatz

```markdown
**Sprecher A:** Guten Morgen, schön dass es geklappt hat.

**Sprecher B:** Danke für die Einladung. Ich wollte ohnehin einmal herkommen.
```

Ein Präfix je Absatz, Leerzeile zwischen den Wechseln. **Aufeinanderfolgende Segmente
desselben Sprechers werden zusammengefasst** — sonst stünde das Präfix vor jedem Satz
und der Text wäre unlesbar. Die Segmentgrenzen des Anbieters folgen Sprechpausen, nicht
Sprecherwechseln.

Zeitmarken bleiben draußen: Sie machen den Fließtext unruhig und stehen ohnehin in
`segments` der Antwort, falls sie später gebraucht werden.

Im Frontmatter kommt nur eine flache Liste `speakers: [...]` an — die Segmente selbst
nicht, das verbietet die Frontmatter-Regel (flach, `snake_case`, keine verschachtelten
Objekte).

### Wahl: Voreinstellung pro Library, Übersteuerung pro Datei

Zwei Ebenen, wie bei anderen Einstellungen im Archiv:

1. **Per-Library-Voreinstellung** — ein neues Config-Feld. Dafür gibt es die Checkliste
   [`library-config-field.md`](../contracts/library-config-field.md); besonders Schritt 4
   (ALLE `form.reset(...)`-Stellen) ist die Stelle, an der solche Felder üblicherweise
   halb ankommen.
2. **Übersteuerung pro Datei** im Transformations-Dialog des Archivs
   (`audio-transform.tsx`, eingebunden über `audio-player.tsx:236`). Die Voreinstellung
   der Library ist vorbelegt, die Wahl gilt nur für diesen Lauf.

Die Entscheidung wandert von dort bis in `external-jobs/secretary-request.ts` — also
auch durch den Job-Weg, nicht nur den synchronen.

### Harter Umzug ohne Alias

**Owner-Entscheidung:** Der Namensraum `realtime` verschwindet ersatzlos, Clients
werden nachgezogen. Kein Übergangs-Alias, keine Frist.

Das ist hier vertretbar, weil der Bruch klein ist. Betroffen sind zwei Pfade, von denen
nur einer überhaupt aufgerufen wird:

| Pfad | Aufrufer heute |
|---|---|
| `/realtime/transcription-session` | genau eine Stelle: `lib/secretary/realtime-ticket.ts:50` |
| `/realtime/usage` | **niemand** — der Endpunkt existiert, der Client meldet noch keinen Verbrauch |

Der harte Schnitt kostet also eine geänderte Konstante im KnowledgeScout. Zwischen dem
Secretary-Deploy und dem Scout-Deploy antwortet der alte Pfad mit 404; in diesem Fenster
schlägt der Ticket-Bezug fehl und die Live-Transkription meldet das sichtbar (kein
stiller Rückfall auf den Batch-Weg). Wer das Fenster vermeiden will, rollt beide
zusammen aus.

## Antwortformat des neuen Endpunkts

```json
{
  "status": "success",
  "data": {
    "output_text": "Sprecher A: Guten Morgen … Sprecher B: Danke für die Einladung …",
    "original_text": "…",
    "speakers": ["Sprecher A", "Sprecher B"],
    "segments": [
      { "speaker": "Sprecher A", "start": 0.0, "end": 3.2, "text": "Guten Morgen …" },
      { "speaker": "Sprecher B", "start": 3.4, "end": 7.9, "text": "Danke für die Einladung …" }
    ],
    "detected_language": "de",
    "duration": 412.5
  }
}
```

`segments` gibt es im `AudioResponse`-Modell bereits — neu ist nur, dass sie gefüllt
sind und ein `speaker` tragen. Der KnowledgeScout liest `segments` heute schon als
letzten Rückfall (`extract-audio-text.ts:16`), bekommt also auch ohne Anpassung
lesbaren Text; die Sprecher-Präfixe brauchen dann Welle C2.

## Risiken

### 1. Der Umzug ist ein Breaking Change

Bewusst in Kauf genommen (siehe Entscheidung oben). Praktisch heisst das: A1 und A2
gehören in dieselbe Auslieferung. Wird nur der Secretary deployt, faellt die
Live-Transkription aus, bis der Scout nachzieht — sichtbar mit Fehlermeldung, nicht
still.

Sollte es weitere Aufrufer ausserhalb dieser beiden Repositories geben (eigene
Skripte, andere Anwendungen), sind sie hier nicht erfasst und muessen mitgezogen
werden.

### 2. Sprecher-Kennungen über Segmentgrenzen — der harte Teil

`gpt-4o-transcribe-diarize` unterliegt denselben Grenzen wie die übrigen Modelle
(25 MB, bei den 4o-Modellen zusätzlich 25 Minuten). Zwei Stunden Material werden also
weiterhin in mehreren Anfragen verarbeitet — und **jede Anfrage nummeriert die Sprecher
neu.** „Sprecher A" in Segment 1 ist nicht zwingend „Sprecher A" in Segment 2.

Ohne Behandlung wäre ein diarisiertes Zwei-Stunden-Transkript wertlos: die Labels
wären zufällig verteilt. Drei Wege, absteigend nach Verlässlichkeit:

1. **Stimmproben** (`known_speaker_references`, 2–10 s je Person, bis zu 4). Dann
   vergibt der Anbieter selbst stabile Namen — über alle Segmente hinweg. Setzt
   Welle D voraus.
2. **Zusammenführen im Dienst** über Ähnlichkeit an den Segmentgrenzen. Aufwendig und
   fehleranfällig, weil die API keine Sprecher-Einbettungen herausgibt.
3. **Begrenzen**: Diarisierung nur für Material unterhalb der Modellgrenze anbieten
   und darüber ausdrücklich ablehnen, statt ein unbrauchbares Ergebnis zu liefern.

Empfehlung für den ersten Schritt: Weg 3 (klare Grenze, ehrliche Fehlermeldung), danach
Weg 1 als Ausbau. Weg 2 nur, wenn beides nicht reicht.

### 3. Cache-Schlüssel

Der Modus muss in den Schlüssel — sonst liefert `process-diarized` das zuvor
gecachte Ergebnis von `process` für dieselbe Datei. Der Kontext ist bereits im
Schlüssel (`_create_cache_key`), der Modus kommt dazu.

### 4. Frontmatter bleibt flach

Sprecher-Segmente können nicht ins Frontmatter — die Repo-Regel verlangt flache
`snake_case`-Felder ohne verschachtelte Objekte. Eine flache Liste `speakers: [...]`
ist möglich, die Segmente selbst gehören in den Fließtext (Sprecher-Präfixe) oder in
MongoDB.

## Offene Fragen

- **Preis** von `gpt-4o-transcribe-diarize` — nicht recherchiert. Vor dem Ausrollen auf
  große Bestände klären.
- **Bestehende Transkript-Templates**: Ob die Sprecher-Präfixe mit den vorhandenen
  Vorlagen für Transkripte zusammenpassen, ist noch nicht geprüft. Betrifft Welle C2.

## Reihenfolge

```
A1 (Secretary, Umzug) ═╤═ A2 (Scout, Pfad)        zusammen ausliefern
                       │
B1 (Use-Case) ─▶ B2 (Endpunkt) ─▶ B3 (Segmentgrenzen) ─▶ B4 (Doku)
                       │
                       ▶ C0 (Library-Feld) ─▶ C1 (Dialog) ─▶ C2 (Auswertung)
                                                        │
                                                        ▶ D (Stimmproben)
```

A und B sind unabhängig voneinander und können parallel laufen. C setzt B2 voraus.
A1 und A2 gehören in dieselbe Auslieferung.

## Nicht in diesem Plan

Das Chunking des Batch-Wegs (`segment_duration: 300` schneidet hart nach Zeit statt an
Sprechpausen, `chunking_strategy: "auto"` wird nicht gesetzt). Es berührt B2 — dort ist
`chunking_strategy` Pflicht — bleibt aber ein eigenes Vorhaben, weil es den gesamten
Datei-Weg betrifft, nicht nur die Diarisierung.
