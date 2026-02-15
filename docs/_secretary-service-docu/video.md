# Video API Endpoints

Endpoints for video file processing, YouTube video processing, and frame extraction.
Analog zu Audio: Mit `callback_url` wird die Verarbeitung **asynchron** per Webhook ausgeliefert.

## POST /api/video/process

Process a video file with audio extraction and transcription.
Unterstützt Datei-Upload, Video-URL und asynchrone Verarbeitung per Webhook.

### Request

**Content-Type**: `multipart/form-data` oder `application/json`

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | No* | - | Video file (MP4, MOV, WebM, etc.) |
| `url` | String | No* | - | Video URL (alternative to file upload) |
| `source_language` | String | No | `auto` | Source language for transcription |
| `target_language` | String | No | `de` | Target language for translation |
| `template` | String | No | - | Optional template name |
| `useCache` | Boolean | No | `true` | Whether to use cache |
| `force_refresh` | Boolean | No | `false` | Cache ignorieren |
| `callback_url` | String | No | - | If set: **asynchronous** processing, results via webhook (HTTP 202) |
| `callback_token` | String | No | - | Optional token for webhook auth |
| `jobId` | String | No | - | Optional external job id (returned in 202 ACK) |

*Either `file` or `url` must be provided.

### Request Example (File Upload, Sync)

```bash
curl -X POST "http://localhost:5001/api/video/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@video.mp4" \
  -F "source_language=en" \
  -F "target_language=de"
```

### Request Example (Async via Webhook)

```bash
curl -X POST "http://localhost:5001/api/video/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@video.mp4" \
  -F "source_language=en" \
  -F "target_language=de" \
  -F "callback_url=https://your-client.example.com/webhook/video" \
  -F "callback_token=YOUR_WEBHOOK_TOKEN" \
  -F "jobId=client-job-123"
```

### Request Example (URL)

```bash
curl -X POST "http://localhost:5001/api/video/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/video.mp4",
    "source_language": "en",
    "target_language": "de"
  }'
```

### Response (Success, Sync)

**Status Code**: `200 OK`

```json
{
  "status": "success",
  "data": {
    "metadata": { "title": "...", "duration": 300, ... },
    "transcription": { "text": "Transcribed text...", ... }
  }
}
```

### Response (Accepted, Async)

**Status Code**: `202 Accepted`

```json
{
  "status": "accepted",
  "worker": "secretary",
  "process": {
    "id": "process-id-123",
    "main_processor": "video",
    "started": "2026-01-01T00:00:00Z",
    "is_from_cache": false
  },
  "job": { "id": "client-job-123" },
  "webhook": { "delivered_to": "https://your-client.example.com/webhook/video" },
  "error": null
}
```

### Webhook-Versand

Der Webhook wird per HTTP POST an die angegebene `callback_url` gesendet:

| Eigenschaft | Wert |
|-------------|------|
| Methode | POST |
| Content-Type | application/json |
| Timeout | 30 Sekunden |
| Auth (falls `callback_token` gesetzt) | `Authorization: Bearer <callback_token>`, `X-Callback-Token: <callback_token>` |

### Webhook Payload (Async Completion)

**Transkribierter Text im Payload**

Der transkribierte Text steht an zwei Stellen:

| Pfad | Beschreibung |
|------|--------------|
| `data.transcription.text` | Transkribierter Text als String |
| `data.result` | Vollständiges Ergebnis des Video-Processors (inkl. Metadaten, etc.) |

Für den reinen Transkript-Text reicht `payload.data.transcription.text`.

**Beispiel-Payload bei Erfolg:**

```json
{
  "phase": "completed",
  "message": "Video-Verarbeitung abgeschlossen",
  "job": { "id": "client-job-123" },
  "data": {
    "transcription": { "text": "Der transkribierte Text..." },
    "result": { ... }
  }
}
```

**Bei Fehlern** wird ein anderer Payload gesendet (`phase: "error"`), dann ist `data` null und die Fehlermeldung steht in `error.message`.

### Job Status / Full Results

Für async Jobs: `GET /api/jobs/<job_id>`

---

## POST /api/video/youtube

Process a YouTube video with download and transcription.
Mit `callback_url`: asynchrone Verarbeitung per Webhook.

### Request

**Content-Type**: `multipart/form-data` oder `application/json`

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | String | Yes | - | YouTube video URL |
| `source_language` | String | No | `auto` | Source language |
| `target_language` | String | No | `de` | Target language |
| `template` | String | No | `youtube` | Optional template |
| `useCache` | Boolean | No | `true` | Whether to use cache |
| `callback_url` | String | No | - | If set: async, results via webhook (HTTP 202) |
| `callback_token` | String | No | - | Optional token for webhook auth |
| `jobId` | String | No | - | Optional external job id |

### Request Example (Sync)

```bash
curl -X POST "http://localhost:5001/api/video/youtube" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "url=https://www.youtube.com/watch?v=VIDEO_ID" \
  -F "source_language=en"
```

### Request Example (Async via Webhook)

```bash
curl -X POST "http://localhost:5001/api/video/youtube" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "url=https://www.youtube.com/watch?v=VIDEO_ID" \
  -F "source_language=en" \
  -F "callback_url=https://your-client.example.com/webhook/youtube" \
  -F "callback_token=YOUR_WEBHOOK_TOKEN" \
  -F "jobId=client-job-123"
```

### Response (Success)

```json
{
  "status": "success",
  "data": {
    "video_id": "VIDEO_ID",
    "title": "Video Title",
    "duration": 600.0,
    "transcription": "Transcribed text...",
    "metadata": {
      "uploader": "Channel Name",
      "views": 10000,
      "description": "Video description..."
    }
  }
}
```

## POST /api/video/frames

Extract frames from a video at fixed interval.
*(Kein Webhook/Async – synchroner Endpoint.)*

### Request

**Content-Type**: `multipart/form-data`

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | No* | - | Video file |
| `url` | String | No* | - | Video URL (alternative) |
| `interval_seconds` | Integer | No | `5` | Extract frame every N seconds |
| `width` | Integer | No | - | Target width (optional) |
| `height` | Integer | No | - | Target height (optional) |
| `format` | String | No | `jpg` | Image format (jpg/png) |
| `useCache` | Boolean | No | `true` | Whether to use cache |

*Either `file` or `url` must be provided.

### Request Example

```bash
curl -X POST "http://localhost:5001/api/video/frames" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@video.mp4" \
  -F "interval_seconds=10"
```

### Response (Success)

```json
{
  "status": "success",
  "data": {
    "frames": [
      {
        "timestamp": 10.0,
        "path": "/path/to/frame_10.jpg"
      },
      {
        "timestamp": 30.0,
        "path": "/path/to/frame_30.jpg"
      }
    ]
  }
}
```

