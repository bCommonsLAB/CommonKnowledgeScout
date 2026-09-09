# Handover: Live-Diktat und Audio-Schnittstelle lokal testen

Stand: September 2026. Selbsttragend — alles Nötige steht hier, kein Chatverlauf erforderlich.

## Ausgangslage

| Was | Wo |
|---|---|
| Live-Transkription (Erfassungsschritt „Erzähl mir was") | in `master` |
| Freitext-Kontext (`prompt`) im Live-Weg | in `master` |
| Kontext im Batch-Weg (`prompt`/`keywords`/`languages`) | Secretary `main` |
| **Fix der WebSocket-Verbindung** | **offen in PR #244** |

**Ohne PR #244 funktioniert das Live-Diktat nicht.** Es wurde mit einem dritten
Unterprotokoll (`openai-beta.realtime-v1`) verbunden, das die abgeschaltete Beta-Form
des Anbieters wählt. Jede Verbindung scheiterte mit
`The Realtime Beta API is no longer supported`.

Also zuerst: PR #244 mergen oder den Branch auschecken
(`claude/openai-live-transcription-xvp2js`).

## Schritt 0 — Secretary lokal

Der Dienst muss laufen (Standard `localhost:5001`) und in der LLM-Konfigurationsmaske
(`/llm-config`) müssen zwei Use-Cases zugeordnet sein:

| Use-Case | Modell |
|---|---|
| Transcription (Audio/Video) | `gpt-transcribe` |
| Live-Transcription (Realtime/Diktat) | `gpt-live-transcribe` |

Fehlen die Modelle in der Auswahl: `python scripts/seed_llm_models.py` im
Secretary-Repo (braucht nur `pymongo` und `MONGODB_URI`, siehe
`docs/handover-transkriptions-modelle.md` dort). Nach dem Speichern **den Dienst neu
starten** — die LLM-Konfiguration wird beim Start gelesen.

## Schritt 1 — Ticket ziehen (kostenlos, 10 Sekunden)

Der wichtigste Test: Er beweist, dass der Dienst ein Ticket bekommt und das Modell für
Realtime zugelassen ist. Ein Ticket kostet nichts — abgerechnet werden erst Audiominuten.

```bash
curl -X POST "http://localhost:5001/api/realtime/transcription-session" \
  -H "Content-Type: application/json" \
  -H "X-Secretary-Api-Key: $SECRETARY_SERVICE_API_KEY" \
  -d '{"language":"de"}'
```

Erwartet:

```json
{"status":"success","data":{"value":"ek_…","model":"gpt-live-transcribe",
 "websocket_url":"wss://api.openai.com/v1/realtime?intent=transcription", …}}
```

## Schritt 2 — KnowledgeScout starten

In `.env.local`:

```
SECRETARY_SERVICE_URL=http://localhost:5001
SECRETARY_SERVICE_API_KEY=<gleicher Wert wie beim Dienst, falls gesetzt>
```

Dann `pnpm dev` und **`http://localhost:3000`** aufrufen. `localhost` ist ein sicherer
Kontext, das Mikrofon ist erlaubt; über eine IP-Adresse oder http auf einem anderen Host
verweigert der Browser den Zugriff.

## Schritt 3 — Live-Diktat

Erkunden → Creation-Wizard → Schritt „Erzähl mir was" → Mikrofon.

**Erwartet:** Der Text erscheint *während* des Sprechens. Unter dem Feld steht grau der
noch nicht abgeschlossene Teil; beim Satzende rutscht er ins Textfeld. Die Statuszeile
zeigt „Nimmt auf (0:12)".

**Gegenprobe der Verbindungsform:** DevTools → Network → WS → die Verbindung anklicken →
Request Headers. `Sec-WebSocket-Protocol` darf **nur zwei** Einträge haben:
`realtime, openai-insecure-api-key.ek_…`. Steht dort ein dritter mit `openai-beta.`,
läuft noch der alte Stand.

## Schritt 4 — Verlustsicherung (der eigentliche Test)

1. Aufnahme starten, ein paar Sätze sprechen
2. DevTools → Network → **Offline** schalten
3. Weitersprechen — die Statuszeile wird gelb: „Verbindung unterbrochen — es wird weiter
   aufgenommen (12 s gepuffert). Nichts geht verloren."
4. Nach etwa 20 Sekunden wieder online

**Erwartet:** Der Text der Offline-Zeit kommt vollständig nach, in richtiger Reihenfolge.

Bei **über zwei Minuten** offline greift die zweite Stufe: Im Text steht
`[… Aufnahme wird nachgearbeitet …]`; nach dem Beenden der Aufnahme wird die Lücke aus
dem Mitschnitt nachtranskribiert und ersetzt den Platzhalter.

## Schritt 5 — Batch-Weg mit Kontext

```bash
curl -X POST "http://localhost:5001/api/audio/process" \
  -H "X-Secretary-Api-Key: $SECRETARY_SERVICE_API_KEY" \
  -F "file=@kurze-aufnahme.m4a" \
  -F "source_language=de" \
  -F "prompt=Hofgespräch über Bodenaufbau im Vinschgau" \
  -F "keywords=Vinschgau, Terra Preta, Sortenvielfalt" \
  -F "useCache=false"
```

Der aussagekräftige Vergleich: dieselbe Datei zweimal, einmal ohne und einmal mit
`keywords`, dann die **Eigennamen** gegenprüfen. An Fließtext wirst du kaum einen
Unterschied sehen — die Wirkung liegt bei Namen, Orten und Fachbegriffen.

Ist `whisper-1` als Modell konfiguriert, steht im Dienst-Protokoll eine Warnung, dass
die Begriffsliste verworfen wurde. Das ist beabsichtigt: Nicht jedes Modell kennt
`keywords`, und verworfene Felder werden gemeldet statt stillschweigend geschluckt.

## Fehlerbilder

| Symptom | Ursache |
|---|---|
| `The Realtime Beta API is no longer supported` | PR #244 fehlt |
| `503 NO_MODEL_CONFIGURED` | Maske ohne Zuordnung, oder Dienst nach dem Speichern nicht neu gestartet |
| `502 UPSTREAM_REJECTED` | Modell nicht realtime-fähig — die Originalmeldung steht in der Antwort |
| `404` beim Ticket | Pfad: ohne `/api` probieren, je nach `SECRETARY_SERVICE_URL` |
| Mikrofon-Knopf fehlt | kein sicherer Kontext (nicht `localhost`/HTTPS) oder Browser ohne MediaRecorder |
| „Mikrofon ist in eingebetteten Ansichten blockiert" | Seite läuft im iframe — in neuem Tab öffnen |
| Aufnahme läuft, kein Text, keine Fehlermeldung | Schritt 1 per curl gegenprüfen |
| Text erscheint doppelt | echter Fehler in der Puffer/Mitschnitt-Weiche — bitte melden, mit dem Zeitpunkt der Störung |

## Was noch NICHT funktioniert

- **Sprecher-Labels.** Der Batch-Weg fordert `verbose_json` an, nicht `diarized_json`,
  und wertet keine Sprecher-Segmente aus. Geplant, nicht gebaut — siehe
  `docs/plans/geplant/audio-namensraum-und-diarisierung_c4f81a37.plan.md` (seit 2026-09-09 geplant, ohne Termin).
- **Live-Kontext außerhalb des Wizards.** Nur der Erfassungsschritt läuft auf `live`;
  Testimonial-Recorder, Werkbank-Korrektur, Pipeline-Sheet und Edit-Draft nutzen
  weiterhin den Batch-Weg. Umstellen wäre je ein `mode="live"`.
- **Übersetzung im Live-Weg.** Der Batch-Weg übersetzt `source_language → target_language`
  mit; die Live-Erkennung liefert nur die gesprochene Sprache.

## Wenn es hakt

Nützlich zum Mitbringen:

1. Die Konsolenausgabe im Wortlaut (die Zeilen mit `[live-transcription]`)
2. Aus DevTools → Network → WS: die gesendeten Unterprotokolle und, falls die Verbindung
   steht, die ersten Frames
3. Die Antwort des curl-Aufrufs aus Schritt 1
4. Ob der Text nach dem **Beenden** der Aufnahme doch noch ankommt — dann funktioniert
   die Nachtranskription und nur die Live-Strecke hakt
