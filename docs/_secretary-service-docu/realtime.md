# Realtime — Live-Transkription (Secretary Service)

Endpunkte für die Live-Transkription. Anders als `audio/process` verarbeitet der
Secretary hier **kein Audio**: Er stellt nur ein kurzlebiges Ticket aus, mit dem der
Browser die Verbindung zum KI-Anbieter selbst aufbaut. Der Anbieter-Schlüssel bleibt
dadurch im Dienst, der Audiostrom nimmt den kürzesten Weg.

## `POST /api/realtime/transcription-session`

Stellt ein Ticket für eine Live-Transkriptions-Session aus.

**Request (JSON, alle Felder optional):**

| Feld | Typ | Bedeutung |
|---|---|---|
| `language` | string | ISO-639-1 des Sprechers. Leer oder `auto` = Anbieter erkennt selbst. |
| `prompt` | string | Freitext zur Führung der Erkennung. |
| `keywords` | string[] | Namen und Fachwörter, die häufig vorkommen. |
| `ticket_seconds` | int | Gültigkeit des Tickets (10–7200, Standard 120). |

**Response:**

```json
{
  "status": "success",
  "data": {
    "value": "ek_...",
    "expires_at": 1800000000,
    "model": "gpt-4o-transcribe",
    "provider": "openai",
    "websocket_url": "wss://api.openai.com/v1/realtime?intent=transcription",
    "session": { "type": "transcription", "audio": { "input": { "…": "…" } } }
  }
}
```

**Fehler:**

| Status | Code | Bedeutung |
|---|---|---|
| 503 | `NO_MODEL_CONFIGURED` | Für den Use-Case `live_transcription` ist kein Modell zugeordnet oder der Provider ist nicht `openai`. |
| 502 | `UPSTREAM_REJECTED` | Der Anbieter hat die Session abgelehnt (z.B. Modell nicht realtime-fähig). |
| 500 | `INTERNAL_ERROR` | Unerwarteter Fehler. |

Es gibt **keinen** stillen Rückfall auf `audio/process`. Wer den Batch-Weg als
Rückfallebene will, entscheidet das sichtbar im Client.

## `POST /api/realtime/usage`

Meldet den Verbrauch einer beendeten Live-Session zurück. Nötig, weil der Audiostrom
nicht über den Secretary läuft und der Verbrauch sonst unsichtbar bliebe.

**Request:** `model` (erforderlich), `audio_seconds`, `input_tokens`, `output_tokens`,
`sessions`.

## Modellzuordnung

Provider und Modell kommen aus der **LLM-Konfigurationsmaske** des Secretary
(Use-Case `live_transcription`, MongoDB; `config.yaml` nur als Rückfall) — nicht aus
einer Konstante im Code. Damit die Maske Modelle anbietet, müssen sie dort unter
„Available LLMs" existieren und den Use-Case führen; das Skript
`python -m src.scripts.seed_realtime_models` legt die realtime-fähigen Modelle an.

Realtime-fähige Modelle: `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`,
`gpt-4o-transcribe-diarize` (mit Sprecher-Labels), `gpt-realtime-whisper`.
