# Echtzeit-Diktat: mitlesen, während man spricht — und nichts mehr verlieren

> Status: **Vorschlag** · 05.09.2026 · Auslöser: verlorene Diktate in der
> Standard-Komponente; Wunsch nach mitlaufender Transkription wie im Chat

## 1. Ausgangslage

Zwei Beschwerden, die gern in einem Satz genannt werden, aber nicht dasselbe
Problem sind:

**(a) Das Diktat war weg.** Der Anwender hat gesprochen, das Speichern schlug
fehl, und der Text war nicht mehr herstellbar — er musste alles wiederholen.
Das ist ein Datenverlust und der ärgerlichere der beiden Punkte.

**(b) Man sieht nicht, was ankommt.** Man spricht in ein stummes Feld und
erfährt erst nach dem Stopp, ob die Maschine mitgekommen ist. Im Chat sieht man
den Text mitlaufen, er zieht sich beim Weitersprechen selbst zurecht — das
erzeugt Vertrauen, und dieses Vertrauen fehlt hier.

Der zweite Punkt lindert den ersten übrigens **nicht**: Auch mitlaufender Text
geht verloren, wenn er nirgends liegt. Deshalb §3.

## 2. Was heute passiert — der Weg des Tons

| Schritt | Ort | Verhalten |
|---|---|---|
| Aufnahme | `src/components/shared/use-dictation-transcription.ts:250` | `recorder.start()` **ohne** `timeslice` — ein einziges Blob am Ende |
| Puffer | `audioChunksRef` (Z. 202) | nur Arbeitsspeicher, nichts auf Platte |
| Stopp | `onstop` (Z. 210) | Blob bauen, Stream schließen, `onAudioBlob?.()` (Z. 226) |
| Transkription | `transcribe()` → `/api/secretary/process-audio` | synchron, ein Durchlauf |
| Secretary | `src/app/api/secretary/process-audio/route.ts:85` | Proxy auf `{SECRETARY}/audio/process`, Batch |
| Text | `extractSecretaryAudioText` | wird an die Komponente gereicht, dort angehängt |

**Die Stelle, an der das Diktat stirbt:** Scheitert der Request, greift `catch`
(Z. 243) — und `finally` (Z. 246) leert `audioChunksRef`. Der Ton ist damit
unwiederbringlich fort, obwohl er vollständig aufgenommen war. Der einzige
Ausgang ist der optionale Rückruf `onAudioBlob`, und den nutzt **genau ein**
Konsument: `src/components/public/testimonial-recorder.tsx:131`. Werkbank
(`artefakt-korrektur.tsx`), Pipeline-Sheet und Erfassungs-Wizard reichen ihn
nicht — dort passiert der Verlust.

Drei Wege führen heute zum selben Ende:

1. **Transkription scheitert.** Secretary nicht erreichbar, 502, oder ein
   ungültiges LLM-Modell — genau der Fall aus
   [`mcp-storage-stand.md`](mcp-storage-stand.md) §4d.
2. **Der Tab stirbt während der Aufnahme.** Reload, Absturz, Anruf auf dem
   Handy: Der Puffer liegt im Speicher, der Speicher ist weg.
3. **Text da, Speichern scheitert.** Die Transkription lief, aber der
   Kurations-POST kommt nicht durch. Der Text steht im Feld — und geht beim
   nächsten Navigieren mit.

Alle drei enden gleich: Der Anwender spricht neu.

## 3. Zwei Probleme, eine Reihenfolge

Das Sicherheitsnetz kommt zuerst. Es ist unabhängig davon, welchen Weg man
für die Live-Anzeige wählt, es behebt alle drei Verlustwege aus §2 allein, und
es macht jede spätere Live-Schicht ungefährlich — denn eine Live-Anzeige, auf
die man sich verlässt, obwohl nichts gesichert ist, verschiebt das Problem nur
nach hinten.

## 4. Wie eine Echtzeit-Transkription funktioniert

Streaming-Erkennung liefert zwei Sorten Ergebnis:

- **Vorläufig** (*interim*): die beste Vermutung nach dem, was bis jetzt zu
  hören war. Sie darf sich ändern.
- **Endgültig** (*final*): ein abgeschlossenes Stück, meist an einer Sprechpause.
  Es ändert sich nicht mehr.

Der Text „korrigiert sich selbst", weil der Decoder mit jedem weiteren Wort
mehr Kontext hat: „in Meran" wird zu „in Meran am" wird zu „in Mehrannahme" —
und mit dem nächsten Wort wieder zurück. Für die Oberfläche heißt das: **zwei
Zonen**. Bestätigter Text steht normal, vorläufiger grau/kursiv dahinter. Nur
so ist das Umspringen erklärbar statt beunruhigend.

Wichtig für die Wegwahl: **Whisper ist kein Streaming-Modell.** Es arbeitet auf
Fenstern von 30 Sekunden und braucht das Fenster ganz. Es gibt kein „Whisper
live" — nur häufiges Nachschieben kleiner Ausschnitte (Weg B) oder ein Modell,
das für Streaming gebaut ist (Weg C).

## 5. Die drei Wege

| | **A · Browser-Erkennung** | **B · Stückweise an Secretary** | **C · Streaming-Anbieter** |
|---|---|---|---|
| Technik | `webkitSpeechRecognition` | `recorder.start(5000)` + `/audio/process` | WebSocket zu Deepgram / AssemblyAI / OpenAI Realtime |
| Latenz | ~200 ms, Wort für Wort | 4–8 s je Segment | ~300 ms, Wort für Wort |
| Selbstkorrektur | ja, laufend | nein (nur Voll-Durchlauf am Ende) | ja, laufend |
| Wohin geht der Ton | Google (Chrome) / Apple (Safari) | eigener Secretary | zum Anbieter |
| Browser | Chrome, Edge, Safari — **kein Firefox** | überall | überall |
| Neuer Schlüssel | nein | nein | **ja** |
| Laufende Kosten | keine | Whisper-Minuten wie heute + Overhead | pro Audiominute |
| Aufwand | klein (~80 Zeilen im Hook) | mittel | mittel + Betrieb |

**Zu A.** Genau das Bild, das gewünscht ist, und es kostet nichts. Zwei Haken.
Erstens der **Datenschutz**: Chrome schickt den Ton an Google, Safari an Apple.
Bei einem Archiv mit Namen, Terminen und Gesundheitsdaten ist das eine
Entscheidung, keine Nebensache — deshalb §10.1. Zweitens die **Reichweite**:
Firefox kann es nicht, iOS-Safari bricht nach etwa einer Minute ab und muss neu
angestoßen werden. A liefert außerdem nur Text, keinen Ton — der MediaRecorder
läuft unverändert daneben weiter. Es ist kein Entweder-oder.

**Zu B.** Kein neuer Anbieter, kein neuer Schlüssel, derselbe Datenweg wie
heute. Der Haken steckt im Format: Nach dem ersten webm-Stück fehlt den
folgenden der Kopf, sie sind allein nicht dekodierbar. Sauber wird es, wenn der
Recorder je Segment neu startet — geschnitten an einer Sprechpause, und den
Pegel dafür gibt es schon (`audio-oscilloscope.tsx` hängt bereits einen
Analyser an denselben Stream). Der Text erscheint dann absatzweise statt
wortweise. Am Ende läuft ein Voll-Durchlauf über die ganze Aufnahme, dessen
Ergebnis die zusammengesetzte Fassung ersetzt — das ist die Selbstkorrektur,
nur spät. Nebeneffekt: Jedes Segment ist sofort Text, also selbst ein Stück
Sicherheitsnetz.

**Zu C.** Das Chat-Erlebnis, unverfälscht. Der Anbieter-Schlüssel darf nie in
den Browser: Eine Route stellt ein kurzlebiges Sitzungs-Token aus, damit
spricht der Browser direkt mit dem Anbieter. Der architektonische Einwand wiegt
schwerer als die Technik: **KnowledgeScout hält heute keinen einzigen
KI-Schlüssel** — alles läuft über den Secretary (`SECRETARY_SERVICE_URL`,
`src/lib/env.ts:70`). Ein Anbieter-Schlüssel in der App bricht dieses Muster.
Der ehrliche Ort wäre ein Streaming-Endpunkt **im Secretary**; der liegt in
einem anderen Repo und kennt heute nur Batch (`/audio/process`) plus SSE für
den Job-*Fortschritt* — kein Teiltranskript
(`docs/_secretary-service-docu/jobs.md:304`).

## 6. Empfehlung

**Die Wahrheit bleibt Whisper über den Secretary. Live ist eine Anzeige, keine
Quelle.** Damit ist die Qualität unverändert, und die Live-Schicht darf
austauschbar bleiben.

1. Der Ton wird ab der ersten Sekunde stückweise weggeschrieben (§7).
2. Live-Text erscheint sofort — Weg A, wo der Browser es kann —, sichtbar als
   vorläufig gekennzeichnet.
3. Beim Stopp läuft der Whisper-Durchlauf wie heute; sein Ergebnis **ersetzt**
   den Live-Text (siehe aber §10.3).
4. Scheitert er, bleibt der Live-Text stehen, das Diktat liegt weiter im
   Browser, und der Knopf heißt „Erneut übertragen" — daneben „Als Datei
   sichern".
5. Beim nächsten Öffnen: „Es liegt ein nicht übertragenes Diktat vom 04.09.,
   14:32 (2:14) vor."

Wo Weg A nicht kann, gilt das heutige Verhalten plus die Punkte 1, 4 und 5 —
und die Komponente **sagt**, dass sie nicht mitschreibt. Ein stiller Rückfall
auf „kein Live-Text" wäre genau der Fall, den
[`no-silent-fallbacks.md`](../contracts/no-silent-fallbacks.md) verbietet.

Weg C bleibt Ausbaustufe: Der Hook bekommt die Live-Quelle als austauschbares
Stück (`LiveTranskriptQuelle` mit `start/stop` und den beiden Textzonen), A ist
die erste Implementierung, C die zweite — ohne Umbau der Oberfläche.

## 7. Das Sicherheitsnetz im Einzelnen

- `recorder.start(1000)` — jede Sekunde ein Stück statt eines Blobs am Ende.
- Jedes Stück sofort nach IndexedDB, Sitzung als Datensatz:
  `{ id, gestartet, mime, chunks[], kontext: { libraryId, sourceId, artefakt },
  textLive, textFinal, status }`. Der Kontext muss mit — sonst weiß die
  Wiedervorlage nicht, zu welcher Datei das Diktat gehörte.
- **Gelöscht wird erst, wenn der Konsument quittiert hat** — also wenn der
  Kurations-POST mit 200 zurückgekommen ist, nicht schon wenn das Feld gefüllt
  ist. Sonst bleibt Verlustweg 3 aus §2 offen.
- Aufräumen: erledigte Sitzungen nach sieben Tagen, Kappe bei ~200 MB, beides
  sichtbar statt still.
- Grenze, die man kennen muss: Ein privates Fenster oder Speicherdruck unter
  iOS kann IndexedDB verwerfen. Deshalb zusätzlich „Als Datei sichern" — der
  letzte Ausweg gehört in die Hand des Anwenders, nicht in die des Browsers.

## 8. Diktieren pro Datei und pro Shadow Twin

Das meiste steht schon, aus K1–K5
([`korrekturauftrag-diktat.md`](korrekturauftrag-diktat.md) §9): Feld,
Schreibweg mit Drift-Guard, Werkbank-Knopf, `korrekturen_lesen` /
`korrektur_melden` an der Brücke. Für den Aufräum-Alltag fehlen drei Dinge:

**(a) Der Ort.** Der Knopf hängt nur in der Werkbank
(`artefakt-kopf.tsx:135`). Beim Durchsehen des aufgeräumten Archivs ist man
aber in Galerie und Datei-Vorschau. Dieselbe Komponente gehört dorthin — in den
Twin-Tab der Vorschau, über denselben Schreibweg, kein zweiter.

**(b) Pro Twin, nicht nur pro Familie.** Route und Hook nehmen die
Artefakt-Referenz bereits entgegen (`parseCurationArtifactRef`,
`kuration.korrigiere(familie, artefakt, auftrag)`); angeboten wird sie nur am
führenden Artefakt. Der Auftrag ans Transkript ist aber ein anderer als der an
die Zusammenfassung — beide sind serverseitig schon getrennt adressierbar, die
Oberfläche muss es nur anbieten.

**(c) Der Fluss.** Heute: aufklappen, diktieren, absenden, zuklappen, nächste
Datei suchen. Beim Durchgehen von zwanzig Dateien ist „absenden und weiter zur
nächsten" der eigentliche Arbeitsgang. Vorschlag, keine Entscheidung.

## 9. Wellen-Schnitt

| Welle | Inhalt | Hängt ab von | Aufwand |
|---|---|---|---|
| **D1** | Sicherheitsnetz: `timeslice`, IndexedDB, Wiedervorlage, „Erneut übertragen", „Als Datei sichern" | — | mittel |
| **D2** | Zwei Textzonen + `LiveTranskriptQuelle` als Schnittstelle, Weg A dahinter, ehrliche Meldung wo es nicht geht | D1, §10.1 | mittel |
| **D3** | Korrektur-Diktat in der Datei-Vorschau (§8a) | — | klein |
| **D4** | Auftrag je Artefakt statt nur am führenden (§8b) | D3 | klein |
| **D5** | Weg C als zweite Live-Quelle, wenn A nicht reicht | D2, §10.2 | groß |

D1, D3 und D4 sind voneinander unabhängig und brauchen keine Entscheidung —
D1 behebt den Verlust, D3/D4 machen das Diktieren am Archiv brauchbar.
D2 wartet auf §10.1.

## 10. Offene Entscheidungen

1. **Darf der Ton für die Live-Anzeige an Google bzw. Apple?** Ohne Ja gibt es
   Weg A nicht. Denkbar: pro Library abschaltbar, Vorgabe „aus" für Libraries
   mit personenbezogenen Inhalten.
2. **Wenn nein:** Weg B (langsamer, kein neuer Anbieter, sofort machbar) oder
   Weg C mit Streaming im Secretary (anderes Repo, laufende Kosten)?
3. **Ersetzt Whisper den Live-Text immer?** Vorschlag: Was der Anwender selbst
   getippt oder geändert hat, wird nie überschrieben — dann steht die
   Whisper-Fassung als Vorschlag darunter, mit „übernehmen".
4. **Roh-Audio dauerhaft ablegen?** Für den Korrekturauftrag sagt
   `korrekturauftrag-diktat.md` §10.2 nein, und das bleibt richtig. Das
   Sicherheitsnetz ist davon unberührt: Es liegt temporär im Browser, nicht im
   Archiv.
5. **Was wird aus `audio-recorder-client.tsx`** (439 Zeilen, zweiter
   Aufnahmeweg im Library-Header)? Mitziehen, oder auf die Standard-Komponente
   zusammenführen? Zwei Aufnahmewege bedeuten zwei Sicherheitsnetze.
