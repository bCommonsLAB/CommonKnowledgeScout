# Batch-PDF-Verarbeitung Endlosschleife
_Exported on 2/6/2026 at 17:11:47 GMT+1 from Cursor (2.4.27)_

---

**User**

ich habe ein ganzes Verzeichnis mit einer Batch-Transformation beauftragt, zu PDFs zu transkribieren, Markdown zu verwandeln, zu transformieren mit einer Template-Transformation und zu am Ende zu ingestieren in unsere Rack-Pipeline. Dazu habe ich diesen PDF-Verzeichnis-Verarbeiten-Dialog verwendet und insgesamt 17 Dokumente gefunden und gestartet. Der Prozess läuft jetzt schon ewig und mir scheint, dass ich da in Endlosschleifen hängen geblieben bin. Hier ein Log.
Ein Nachtrag, wenn ich ein Dokument aus dem Verzeichnis mit dem zum Story Creator transformiere, dann funktioniert es. Ist der Flow über diese Batch-Verarbeitung anders als hier der Flow über Story Creator?
{
  "_id": {
    "$oid": "696b67afea6d9423aefdb08f"
  },
  "jobId": "41cd0471-aad4-445b-9eac-3996afebe008",
  "jobSecretHash": "beb8ab0f32589191a47a00046e3dfbaacbb08f1b626f76619fcaece3f481cb0a",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "running",
  "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "41cd0471-aad4-445b-9eac-3996afebe008",
    "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf",
      "itemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvU3Rha2Vob2xkZXIvVm9yc2NobGFlZ2VfU0hGX0JFUkVJVFNfSU5fVU1TRVRaVU5HLnBkZg==",
      "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvU3Rha2Vob2xkZXI="
    },
    "options": {
      "targetLanguage": "en",
      "extractionMethod": "native",
      "includeOcrImages": null,
      "includePageImages": null,
      "includeImages": false,
      "useCache": true
    },
    "batchId": "9a37c8a8-e1f4-4f34-bc3a-90976073b9f7",
    "batchName": "www.klimaland.bz/RückmeldungenDerLandesverwaltung"
  },
  "createdAt": {
    "$date": "2026-01-17T10:42:55.731Z"
  },
  "updatedAt": {
    "$date": "2026-01-17T10:57:08.957Z"
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "running",
      "startedAt": {
        "$date": "2026-01-17T10:44:00.830Z"
      }
    },
    {
      "name": "transform_template",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "pending"
    }
  ],
  "parameters": {
    "targetLanguage": "en",
    "extractionMethod": "native",
    "includeOcrImages": null,
    "includePageImages": null,
    "includeImages": false,
    "useCache": true,
    "template": null,
    "phases": {
      "extract": true,
      "template": true,
      "ingest": true
    },
    "policies": {
      "extract": "do",
      "metadata": "do",
      "ingest": "do"
    },
    "batchId": "9a37c8a8-e1f4-4f34-bc3a-90976073b9f7",
    "batchName": "www.klimaland.bz/RückmeldungenDerLandesverwaltung"
  },
  "trace": {
    "events": [
      {
        "eventId": "1768646638319-cpyusjvj",
        "ts": {
          "$date": "2026-01-17T10:43:58.319Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_found_markdown",
        "level": "info",
        "message": null,
        "attributes": {
          "expectedFileName": null,
          "existingFileId": null
        }
      },
      {
        "eventId": "1768646638524-c8zrh0qm",
        "ts": {
          "$date": "2026-01-17T10:43:58.524Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_frontmatter_valid",
        "level": "info",
        "message": null,
        "attributes": {
          "hasFrontmatter": false,
          "valid": false,
          "expectedFileName": null,
          "existingFileId": null,
          "hasMarkdown": false,
          "metaKeys": [],
          "reasons": [
            "no_markdown_found"
          ]
        }
      },
      {
        "eventId": "1768646638727-fonh61sl",
        "ts": {
          "$date": "2026-01-17T10:43:58.727Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_summary",
        "level": "info",
        "message": null,
        "attributes": {
          "hasMarkdown": false,
          "hasFrontmatter": false,
          "frontmatterValid": false
        }
      },
      {
        "eventId": "1768646639274-aa2h8o5h",
        "ts": {
          "$date": "2026-01-17T10:43:59.274Z"
        },
        "spanId": "preprocess",
        "name": "process_pdf_submit",
        "level": "info",
        "message": null,
        "attributes": {
          "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
          "fileName": "Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf",
          "extractionMethod": "native",
          "targetLanguage": "en",
          "includeOcrImages": null,
          "includePageImages": null,
          "includeImages": false,
          "useCache": true,
          "template": null,
          "phases": {
            "extract": true,
            "template": true,
            "ingest": true
          },
          "startRequestId": "e44c9fca-c417-423d-8aa8-abc8ff12c8c6",
          "workerId": "1821dfdf-685f-4d3e-a7fb-8c6c58e1930c",
          "workerTickId": "715d4831-caba-4547-a640-c8f5a6e824bc",
          "pid": 23780
        }
      },
      {
        "eventId": "1768646640790-n78g4i0m",
        "ts": {
          "$date": "2026-01-17T10:44:00.790Z"
        },
        "spanId": "preprocess",
        "name": "request_ack",
        "level": "info",
        "message": null,
        "attributes": {
          "status": 202,
          "statusText": "ACCEPTED",
          "url": "http://127.0.0.1:5001/api/pdf/process",
          "extractionMethod": "native",
          "startRequestId": "e44c9fca-c417-423d-8aa8-abc8ff12c8c6",
          "workerId": "1821dfdf-685f-4d3e-a7fb-8c6c58e1930c",
          "workerTickId": "715d4831-caba-4547-a640-c8f5a6e824bc",
          "pid": 23780
        }
      },
      {
        "eventId": "1768646641189-xlrckz10",
        "ts": {
          "$date": "2026-01-17T10:44:01.189Z"
        },
        "spanId": "extract",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "extract_pdf"
        }
      },
      {
        "eventId": "1768646672666-h898hghw",
        "ts": {
          "$date": "2026-01-17T10:44:32.666Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "initializing",
          "progress": 5,
          "message": "Job initialisiert",
          "workerId": null
        }
      },
      {
        "eventId": "1768646672825-wo8rz3lr",
        "ts": {
          "$date": "2026-01-17T10:44:32.825Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "initializing",
          "progress": 5,
          "message": "Job initialisiert",
          "workerId": null
        }
      },
      {
        "eventId": "1768646673236-qmjdsd8m",
        "ts": {
          "$date": "2026-01-17T10:44:33.236Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "initializing",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "progress",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646673391-qhsvm06v",
        "ts": {
          "$date": "2026-01-17T10:44:33.391Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "initializing",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "progress",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646677596-lsiwmdwm",
        "ts": {
          "$date": "2026-01-17T10:44:37.596Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Verarbeite Datei: upload_2bc4c0b2-2ece-40ff-aa01-54f6aca36705.pdf - Args: {\"file_size\": 949594, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\712004f968bde85c\", \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646677759-12i9gfzi",
        "ts": {
          "$date": "2026-01-17T10:44:37.759Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Verarbeite Datei: upload_2bc4c0b2-2ece-40ff-aa01-54f6aca36705.pdf - Args: {\"file_size\": 949594, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\712004f968bde85c\", \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646678255-y6zccgca",
        "ts": {
          "$date": "2026-01-17T10:44:38.255Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646678482-x2596vks",
        "ts": {
          "$date": "2026-01-17T10:44:38.482Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646683068-vqbh0z9t",
        "ts": {
          "$date": "2026-01-17T10:44:43.068Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Verarbeite Datei: upload_2bc4c0b2-2ece-40ff-aa01-54f6aca36705.pdf - Args: {\"file_size\": 949594, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\712004f968bde85c\", \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646683263-44lq7k3t",
        "ts": {
          "$date": "2026-01-17T10:44:43.263Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Verarbeite Datei: upload_2bc4c0b2-2ece-40ff-aa01-54f6aca36705.pdf - Args: {\"file_size\": 949594, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\712004f968bde85c\", \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646683763-bcne3pbx",
        "ts": {
          "$date": "2026-01-17T10:44:43.763Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646683935-aa6sylcb",
        "ts": {
          "$date": "2026-01-17T10:44:43.935Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646688603-6323w6oa",
        "ts": {
          "$date": "2026-01-17T10:44:48.603Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Starte Extraktion (Methoden: ['native'])",
          "workerId": null
        }
      },
      {
        "eventId": "1768646688841-gasuyh0x",
        "ts": {
          "$date": "2026-01-17T10:44:48.841Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Starte Extraktion (Methoden: ['native'])",
          "workerId": null
        }
      },
      {
        "eventId": "1768646689246-4efdgqsx",
        "ts": {
          "$date": "2026-01-17T10:44:49.246Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646689514-kwrflaql",
        "ts": {
          "$date": "2026-01-17T10:44:49.514Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646693797-cxia3xhq",
        "ts": {
          "$date": "2026-01-17T10:44:53.797Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Starte Extraktion (Methoden: ['native'])",
          "workerId": null
        }
      },
      {
        "eventId": "1768646694015-29kj3iul",
        "ts": {
          "$date": "2026-01-17T10:44:54.015Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Starte Extraktion (Methoden: ['native'])",
          "workerId": null
        }
      },
      {
        "eventId": "1768646694438-n0xr4b8s",
        "ts": {
          "$date": "2026-01-17T10:44:54.438Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646694782-z5yegbrv",
        "ts": {
          "$date": "2026-01-17T10:44:54.782Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646699193-d4bxzidv",
        "ts": {
          "$date": "2026-01-17T10:44:59.193Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 1",
          "workerId": null
        }
      },
      {
        "eventId": "1768646699467-f7mnr5zs",
        "ts": {
          "$date": "2026-01-17T10:44:59.467Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 1",
          "workerId": null
        }
      },
      {
        "eventId": "1768646700093-f6oxxlst",
        "ts": {
          "$date": "2026-01-17T10:45:00.093Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646700480-wtvvxo24",
        "ts": {
          "$date": "2026-01-17T10:45:00.480Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646705090-g5vh28bn",
        "ts": {
          "$date": "2026-01-17T10:45:05.090Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 1",
          "workerId": null
        }
      },
      {
        "eventId": "1768646705308-cgohmk5v",
        "ts": {
          "$date": "2026-01-17T10:45:05.308Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 1",
          "workerId": null
        }
      },
      {
        "eventId": "1768646705917-udid6uba",
        "ts": {
          "$date": "2026-01-17T10:45:05.917Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646706065-fkub5h5s",
        "ts": {
          "$date": "2026-01-17T10:45:06.065Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646710841-cpwc0iau",
        "ts": {
          "$date": "2026-01-17T10:45:10.841Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 1 verarbeitet - Args: {\"duration\": 11.313878059387207, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646711134-m8c42giw",
        "ts": {
          "$date": "2026-01-17T10:45:11.134Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 1 verarbeitet - Args: {\"duration\": 11.309821367263794, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646711438-19efvi3x",
        "ts": {
          "$date": "2026-01-17T10:45:11.438Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646711859-fo3n87sh",
        "ts": {
          "$date": "2026-01-17T10:45:11.859Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646716558-ga415rrk",
        "ts": {
          "$date": "2026-01-17T10:45:16.558Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 1 verarbeitet - Args: {\"duration\": 11.313878059387207, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646716710-dmfey4dx",
        "ts": {
          "$date": "2026-01-17T10:45:16.710Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 1 verarbeitet - Args: {\"duration\": 11.309821367263794, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646717148-qmu1mw72",
        "ts": {
          "$date": "2026-01-17T10:45:17.148Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646717383-dp48edal",
        "ts": {
          "$date": "2026-01-17T10:45:17.383Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646721968-osv30kjk",
        "ts": {
          "$date": "2026-01-17T10:45:21.968Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 2",
          "workerId": null
        }
      },
      {
        "eventId": "1768646722148-aalqvy6a",
        "ts": {
          "$date": "2026-01-17T10:45:22.148Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 2",
          "workerId": null
        }
      },
      {
        "eventId": "1768646722574-vrvpfv3t",
        "ts": {
          "$date": "2026-01-17T10:45:22.574Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646722826-6qi8wyyj",
        "ts": {
          "$date": "2026-01-17T10:45:22.826Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646728207-x8osga0a",
        "ts": {
          "$date": "2026-01-17T10:45:28.207Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 2",
          "workerId": null
        }
      },
      {
        "eventId": "1768646728846-h5vpttwo",
        "ts": {
          "$date": "2026-01-17T10:45:28.846Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646729204-r4tdt6zp",
        "ts": {
          "$date": "2026-01-17T10:45:29.204Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 2",
          "workerId": null
        }
      },
      {
        "eventId": "1768646730168-p1rn3x7x",
        "ts": {
          "$date": "2026-01-17T10:45:30.168Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646731107-syuc6wtu",
        "ts": {
          "$date": "2026-01-17T10:45:31.107Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 2 verarbeitet - Args: {\"duration\": 11.54714035987854, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646731285-h5p209q0",
        "ts": {
          "$date": "2026-01-17T10:45:31.285Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646735319-v8gsanuz",
        "ts": {
          "$date": "2026-01-17T10:45:35.319Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 2 verarbeitet - Args: {\"duration\": 13.021915197372437, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646735581-xyhay6f9",
        "ts": {
          "$date": "2026-01-17T10:45:35.581Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 2 verarbeitet - Args: {\"duration\": 11.54714035987854, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646735989-xvv6rhvz",
        "ts": {
          "$date": "2026-01-17T10:45:35.989Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646736192-9emmfsou",
        "ts": {
          "$date": "2026-01-17T10:45:36.192Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646740930-a6pm8oj3",
        "ts": {
          "$date": "2026-01-17T10:45:40.930Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 2 verarbeitet - Args: {\"duration\": 13.021915197372437, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646741327-l7uulbj6",
        "ts": {
          "$date": "2026-01-17T10:45:41.327Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 3",
          "workerId": null
        }
      },
      {
        "eventId": "1768646741653-oqb8kell",
        "ts": {
          "$date": "2026-01-17T10:45:41.653Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646741933-j06wqzyt",
        "ts": {
          "$date": "2026-01-17T10:45:41.933Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646746629-wyvlab25",
        "ts": {
          "$date": "2026-01-17T10:45:46.629Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 3",
          "workerId": null
        }
      },
      {
        "eventId": "1768646747082-cu6lr4q7",
        "ts": {
          "$date": "2026-01-17T10:45:47.082Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 3",
          "workerId": null
        }
      },
      {
        "eventId": "1768646747395-i4nl6256",
        "ts": {
          "$date": "2026-01-17T10:45:47.395Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646747696-mla2mtcx",
        "ts": {
          "$date": "2026-01-17T10:45:47.696Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646752443-ikv7iv54",
        "ts": {
          "$date": "2026-01-17T10:45:52.443Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 3",
          "workerId": null
        }
      },
      {
        "eventId": "1768646752868-ndqoboui",
        "ts": {
          "$date": "2026-01-17T10:45:52.868Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 3 verarbeitet - Args: {\"duration\": 11.650458335876465, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646753033-vozyus23",
        "ts": {
          "$date": "2026-01-17T10:45:53.033Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646753565-taycmdww",
        "ts": {
          "$date": "2026-01-17T10:45:53.565Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646758163-sexp65gk",
        "ts": {
          "$date": "2026-01-17T10:45:58.163Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 3 verarbeitet - Args: {\"duration\": 11.575257778167725, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646758767-wkmaz5cy",
        "ts": {
          "$date": "2026-01-17T10:45:58.767Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 3 verarbeitet - Args: {\"duration\": 11.650458335876465, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646758925-cw1gitka",
        "ts": {
          "$date": "2026-01-17T10:45:58.925Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646759429-le1bt0xh",
        "ts": {
          "$date": "2026-01-17T10:45:59.429Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646762738-47tgmbk3",
        "ts": {
          "$date": "2026-01-17T10:46:02.738Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 3 verarbeitet - Args: {\"duration\": 11.575257778167725, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646763348-usaoomln",
        "ts": {
          "$date": "2026-01-17T10:46:03.348Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646764674-fz7r0bue",
        "ts": {
          "$date": "2026-01-17T10:46:04.674Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 4",
          "workerId": null
        }
      },
      {
        "eventId": "1768646765738-xmyzxvl3",
        "ts": {
          "$date": "2026-01-17T10:46:05.738Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646766521-0j64yzak",
        "ts": {
          "$date": "2026-01-17T10:46:06.521Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 4",
          "workerId": null
        }
      },
      {
        "eventId": "1768646766665-qp1jk1se",
        "ts": {
          "$date": "2026-01-17T10:46:06.665Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646771189-3dm4ajlu",
        "ts": {
          "$date": "2026-01-17T10:46:11.189Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 4",
          "workerId": null
        }
      },
      {
        "eventId": "1768646771457-rh3wuw9s",
        "ts": {
          "$date": "2026-01-17T10:46:11.457Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 4",
          "workerId": null
        }
      },
      {
        "eventId": "1768646771801-zwu6rfpg",
        "ts": {
          "$date": "2026-01-17T10:46:11.801Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646772097-fq3xx039",
        "ts": {
          "$date": "2026-01-17T10:46:12.097Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646777359-r45fswio",
        "ts": {
          "$date": "2026-01-17T10:46:17.359Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 4 verarbeitet - Args: {\"duration\": 12.672667741775513, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646777532-2lkicgky",
        "ts": {
          "$date": "2026-01-17T10:46:17.532Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 4 verarbeitet - Args: {\"duration\": 8.787630558013916, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646778060-ck9ebfdd",
        "ts": {
          "$date": "2026-01-17T10:46:18.060Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646778248-gatijos4",
        "ts": {
          "$date": "2026-01-17T10:46:18.248Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646784101-bryqsofe",
        "ts": {
          "$date": "2026-01-17T10:46:24.101Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 4 verarbeitet - Args: {\"duration\": 12.672667741775513, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646784524-si8q2v18",
        "ts": {
          "$date": "2026-01-17T10:46:24.524Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 4 verarbeitet - Args: {\"duration\": 8.787630558013916, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646784830-3qb1m3rl",
        "ts": {
          "$date": "2026-01-17T10:46:24.830Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646785400-hnpcsn43",
        "ts": {
          "$date": "2026-01-17T10:46:25.400Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646789768-765lb3zy",
        "ts": {
          "$date": "2026-01-17T10:46:29.768Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 5",
          "workerId": null
        }
      },
      {
        "eventId": "1768646790637-ly70x2qa",
        "ts": {
          "$date": "2026-01-17T10:46:30.637Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646791497-g1tpdkzo",
        "ts": {
          "$date": "2026-01-17T10:46:31.497Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 5",
          "workerId": null
        }
      },
      {
        "eventId": "1768646792281-haqz2abw",
        "ts": {
          "$date": "2026-01-17T10:46:32.281Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646795103-00cn7xnt",
        "ts": {
          "$date": "2026-01-17T10:46:35.103Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 5",
          "workerId": null
        }
      },
      {
        "eventId": "1768646795946-5zpp8hr8",
        "ts": {
          "$date": "2026-01-17T10:46:35.946Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646797864-lg5filcm",
        "ts": {
          "$date": "2026-01-17T10:46:37.864Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 5",
          "workerId": null
        }
      },
      {
        "eventId": "1768646798595-nhjthu3b",
        "ts": {
          "$date": "2026-01-17T10:46:38.595Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646800904-q3gnvukm",
        "ts": {
          "$date": "2026-01-17T10:46:40.904Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 5 verarbeitet - Args: {\"duration\": 11.136881589889526, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646801468-3hkedn8i",
        "ts": {
          "$date": "2026-01-17T10:46:41.468Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646804364-2rkxt2bv",
        "ts": {
          "$date": "2026-01-17T10:46:44.364Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 5 verarbeitet - Args: {\"duration\": 13.313275337219238, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646805368-7qp5o32h",
        "ts": {
          "$date": "2026-01-17T10:46:45.368Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646807711-v1j0f61r",
        "ts": {
          "$date": "2026-01-17T10:46:47.711Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 5 verarbeitet - Args: {\"duration\": 11.136881589889526, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646808457-m3d1q8a2",
        "ts": {
          "$date": "2026-01-17T10:46:48.457Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646810448-p5at6jge",
        "ts": {
          "$date": "2026-01-17T10:46:50.448Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 5 verarbeitet - Args: {\"duration\": 13.313275337219238, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646811382-6cv49smz",
        "ts": {
          "$date": "2026-01-17T10:46:51.382Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646814464-di32wc2j",
        "ts": {
          "$date": "2026-01-17T10:46:54.464Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 6",
          "workerId": null
        }
      },
      {
        "eventId": "1768646815554-lf3nni3r",
        "ts": {
          "$date": "2026-01-17T10:46:55.554Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646817264-noyuogm9",
        "ts": {
          "$date": "2026-01-17T10:46:57.264Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 6",
          "workerId": null
        }
      },
      {
        "eventId": "1768646817930-0d16kcoj",
        "ts": {
          "$date": "2026-01-17T10:46:57.930Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646821840-k03ueln6",
        "ts": {
          "$date": "2026-01-17T10:47:01.840Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 6",
          "workerId": null
        }
      },
      {
        "eventId": "1768646822667-0b8getk9",
        "ts": {
          "$date": "2026-01-17T10:47:02.667Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646823998-2yeugrw8",
        "ts": {
          "$date": "2026-01-17T10:47:03.998Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 6",
          "workerId": null
        }
      },
      {
        "eventId": "1768646824858-wlwnx4lm",
        "ts": {
          "$date": "2026-01-17T10:47:04.858Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646829352-dtz7lf2o",
        "ts": {
          "$date": "2026-01-17T10:47:09.352Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 6 verarbeitet - Args: {\"duration\": 14.325402975082397, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646830333-9c2zfg64",
        "ts": {
          "$date": "2026-01-17T10:47:10.333Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646831675-9gl5v6hp",
        "ts": {
          "$date": "2026-01-17T10:47:11.675Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 6 verarbeitet - Args: {\"duration\": 13.610079526901245, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646832527-8z6hsv0n",
        "ts": {
          "$date": "2026-01-17T10:47:12.527Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646836442-v78so1h3",
        "ts": {
          "$date": "2026-01-17T10:47:16.442Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 6 verarbeitet - Args: {\"duration\": 14.325402975082397, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646837424-v2imngad",
        "ts": {
          "$date": "2026-01-17T10:47:17.424Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646839006-h24xqljm",
        "ts": {
          "$date": "2026-01-17T10:47:19.006Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 6 verarbeitet - Args: {\"duration\": 13.610079526901245, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646839784-k4m0v4dd",
        "ts": {
          "$date": "2026-01-17T10:47:19.784Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646843078-3c5fqshs",
        "ts": {
          "$date": "2026-01-17T10:47:23.078Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 7",
          "workerId": null
        }
      },
      {
        "eventId": "1768646843894-qlj8036w",
        "ts": {
          "$date": "2026-01-17T10:47:23.894Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646845661-xxxu6w2o",
        "ts": {
          "$date": "2026-01-17T10:47:25.661Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 7",
          "workerId": null
        }
      },
      {
        "eventId": "1768646846624-4da4rh2l",
        "ts": {
          "$date": "2026-01-17T10:47:26.624Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646850136-h45lr2kz",
        "ts": {
          "$date": "2026-01-17T10:47:30.136Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 7",
          "workerId": null
        }
      },
      {
        "eventId": "1768646851132-hwx8lqr0",
        "ts": {
          "$date": "2026-01-17T10:47:31.132Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646852949-k8k7ry6p",
        "ts": {
          "$date": "2026-01-17T10:47:32.949Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 7",
          "workerId": null
        }
      },
      {
        "eventId": "1768646853753-wa1y5lxa",
        "ts": {
          "$date": "2026-01-17T10:47:33.753Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646857224-iw8lqkxt",
        "ts": {
          "$date": "2026-01-17T10:47:37.224Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 7 verarbeitet - Args: {\"duration\": 13.886902570724487, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646857990-ovd6tttk",
        "ts": {
          "$date": "2026-01-17T10:47:37.990Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646859974-1um1i4ul",
        "ts": {
          "$date": "2026-01-17T10:47:39.974Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 7 verarbeitet - Args: {\"duration\": 14.091739416122437, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646861017-qx0k3k73",
        "ts": {
          "$date": "2026-01-17T10:47:41.017Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646863690-k3lmrrfl",
        "ts": {
          "$date": "2026-01-17T10:47:43.690Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 7 verarbeitet - Args: {\"duration\": 13.886902570724487, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646864399-hhhebt8d",
        "ts": {
          "$date": "2026-01-17T10:47:44.399Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646866652-2ay9h8qr",
        "ts": {
          "$date": "2026-01-17T10:47:46.652Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 7 verarbeitet - Args: {\"duration\": 14.091739416122437, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646867585-wkcfxcvj",
        "ts": {
          "$date": "2026-01-17T10:47:47.585Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646871026-e6ng5q2l",
        "ts": {
          "$date": "2026-01-17T10:47:51.026Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 8",
          "workerId": null
        }
      },
      {
        "eventId": "1768646871801-otvg08hp",
        "ts": {
          "$date": "2026-01-17T10:47:51.801Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646872924-ugexpb0z",
        "ts": {
          "$date": "2026-01-17T10:47:52.924Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 8",
          "workerId": null
        }
      },
      {
        "eventId": "1768646873745-465ufy88",
        "ts": {
          "$date": "2026-01-17T10:47:53.745Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646877870-uponl56e",
        "ts": {
          "$date": "2026-01-17T10:47:57.870Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 8",
          "workerId": null
        }
      },
      {
        "eventId": "1768646878681-axgvdet7",
        "ts": {
          "$date": "2026-01-17T10:47:58.681Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646879749-c5hrskpl",
        "ts": {
          "$date": "2026-01-17T10:47:59.749Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 8",
          "workerId": null
        }
      },
      {
        "eventId": "1768646880598-56cso3nz",
        "ts": {
          "$date": "2026-01-17T10:48:00.598Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646884852-vdzlpbdu",
        "ts": {
          "$date": "2026-01-17T10:48:04.852Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 8 verarbeitet - Args: {\"duration\": 14.37992548942566, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646885884-s0wfn0ea",
        "ts": {
          "$date": "2026-01-17T10:48:05.884Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646887058-1i506gl2",
        "ts": {
          "$date": "2026-01-17T10:48:07.058Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 8 verarbeitet - Args: {\"duration\": 13.093178510665894, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646887984-scs9unvy",
        "ts": {
          "$date": "2026-01-17T10:48:07.984Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646892129-7ggyszga",
        "ts": {
          "$date": "2026-01-17T10:48:12.129Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 8 verarbeitet - Args: {\"duration\": 14.37992548942566, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646893043-8ffhwvu5",
        "ts": {
          "$date": "2026-01-17T10:48:13.043Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646894063-amkhnghv",
        "ts": {
          "$date": "2026-01-17T10:48:14.063Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 8 verarbeitet - Args: {\"duration\": 13.093178510665894, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646894945-rj47g9de",
        "ts": {
          "$date": "2026-01-17T10:48:14.945Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646898931-m38o8084",
        "ts": {
          "$date": "2026-01-17T10:48:18.931Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 9",
          "workerId": null
        }
      },
      {
        "eventId": "1768646899705-j6whn4bo",
        "ts": {
          "$date": "2026-01-17T10:48:19.705Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646901365-po28illl",
        "ts": {
          "$date": "2026-01-17T10:48:21.365Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 9",
          "workerId": null
        }
      },
      {
        "eventId": "1768646902142-4fc4uzwy",
        "ts": {
          "$date": "2026-01-17T10:48:22.142Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646905667-424ojbrd",
        "ts": {
          "$date": "2026-01-17T10:48:25.667Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 9",
          "workerId": null
        }
      },
      {
        "eventId": "1768646906616-7je0s6xp",
        "ts": {
          "$date": "2026-01-17T10:48:26.616Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646908083-xr2z7fmc",
        "ts": {
          "$date": "2026-01-17T10:48:28.083Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 9",
          "workerId": null
        }
      },
      {
        "eventId": "1768646908907-ngku0kqj",
        "ts": {
          "$date": "2026-01-17T10:48:28.907Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646912974-dhqbgmzm",
        "ts": {
          "$date": "2026-01-17T10:48:32.974Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 9 verarbeitet - Args: {\"duration\": 13.659480094909668, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646913755-ztpev20a",
        "ts": {
          "$date": "2026-01-17T10:48:33.755Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646915027-bfqs15m9",
        "ts": {
          "$date": "2026-01-17T10:48:35.027Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 9 verarbeitet - Args: {\"duration\": 14.035029172897339, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646915880-9pr33xnb",
        "ts": {
          "$date": "2026-01-17T10:48:35.880Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646920028-3e4z6ibw",
        "ts": {
          "$date": "2026-01-17T10:48:40.028Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 9 verarbeitet - Args: {\"duration\": 13.659480094909668, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646920937-2k3hj76b",
        "ts": {
          "$date": "2026-01-17T10:48:40.937Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646921884-3kd2dee6",
        "ts": {
          "$date": "2026-01-17T10:48:41.884Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 9 verarbeitet - Args: {\"duration\": 14.035029172897339, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646922788-pvg1sx6u",
        "ts": {
          "$date": "2026-01-17T10:48:42.788Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646927241-gmpg2d1z",
        "ts": {
          "$date": "2026-01-17T10:48:47.241Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 10",
          "workerId": null
        }
      },
      {
        "eventId": "1768646928013-ug7k3fzd",
        "ts": {
          "$date": "2026-01-17T10:48:48.013Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646928984-khjb2iax",
        "ts": {
          "$date": "2026-01-17T10:48:48.984Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 10",
          "workerId": null
        }
      },
      {
        "eventId": "1768646929944-1a1ojejc",
        "ts": {
          "$date": "2026-01-17T10:48:49.944Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646933887-5ifcd855",
        "ts": {
          "$date": "2026-01-17T10:48:53.887Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 10",
          "workerId": null
        }
      },
      {
        "eventId": "1768646934755-4zsqaazn",
        "ts": {
          "$date": "2026-01-17T10:48:54.755Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646936190-k078lvxz",
        "ts": {
          "$date": "2026-01-17T10:48:56.190Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 10",
          "workerId": null
        }
      },
      {
        "eventId": "1768646937028-5adjjstd",
        "ts": {
          "$date": "2026-01-17T10:48:57.028Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646941124-377auy2w",
        "ts": {
          "$date": "2026-01-17T10:49:01.124Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 10 verarbeitet - Args: {\"duration\": 13.799013376235962, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646941917-kyk5tcke",
        "ts": {
          "$date": "2026-01-17T10:49:01.917Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646943034-js93rdgv",
        "ts": {
          "$date": "2026-01-17T10:49:03.034Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 10 verarbeitet - Args: {\"duration\": 14.247184038162231, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646943839-larbziok",
        "ts": {
          "$date": "2026-01-17T10:49:03.839Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646947903-abkwrs6h",
        "ts": {
          "$date": "2026-01-17T10:49:07.903Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 10 verarbeitet - Args: {\"duration\": 13.799013376235962, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646948789-vfsy60wo",
        "ts": {
          "$date": "2026-01-17T10:49:08.789Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646950252-qkg3c3jy",
        "ts": {
          "$date": "2026-01-17T10:49:10.252Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 10 verarbeitet - Args: {\"duration\": 14.247184038162231, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646951230-1fuojx63",
        "ts": {
          "$date": "2026-01-17T10:49:11.230Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646955045-8zpa3svd",
        "ts": {
          "$date": "2026-01-17T10:49:15.045Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 11",
          "workerId": null
        }
      },
      {
        "eventId": "1768646955990-et4dkqfp",
        "ts": {
          "$date": "2026-01-17T10:49:15.990Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646957199-6pklh923",
        "ts": {
          "$date": "2026-01-17T10:49:17.199Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 11",
          "workerId": null
        }
      },
      {
        "eventId": "1768646958114-lmgj5uum",
        "ts": {
          "$date": "2026-01-17T10:49:18.114Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646962447-vqlf3dsa",
        "ts": {
          "$date": "2026-01-17T10:49:22.447Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 11",
          "workerId": null
        }
      },
      {
        "eventId": "1768646963536-lyg67wk5",
        "ts": {
          "$date": "2026-01-17T10:49:23.536Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646964486-w09o5ldu",
        "ts": {
          "$date": "2026-01-17T10:49:24.486Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 11",
          "workerId": null
        }
      },
      {
        "eventId": "1768646965491-nsoruqb8",
        "ts": {
          "$date": "2026-01-17T10:49:25.491Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646969393-3p7xewrl",
        "ts": {
          "$date": "2026-01-17T10:49:29.393Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 11 verarbeitet - Args: {\"duration\": 14.709465980529785, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646970239-xaqd5239",
        "ts": {
          "$date": "2026-01-17T10:49:30.239Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646971386-301sz6yb",
        "ts": {
          "$date": "2026-01-17T10:49:31.386Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 11 verarbeitet - Args: {\"duration\": 14.328022956848145, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646972342-svk1amw2",
        "ts": {
          "$date": "2026-01-17T10:49:32.342Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646976269-0dht0cug",
        "ts": {
          "$date": "2026-01-17T10:49:36.269Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 11 verarbeitet - Args: {\"duration\": 14.709465980529785, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646977064-84lu245u",
        "ts": {
          "$date": "2026-01-17T10:49:37.064Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646978315-m9d90l5g",
        "ts": {
          "$date": "2026-01-17T10:49:38.315Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 11 verarbeitet - Args: {\"duration\": 14.328022956848145, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646979166-ga09bp1u",
        "ts": {
          "$date": "2026-01-17T10:49:39.166Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646983333-uwdw7xij",
        "ts": {
          "$date": "2026-01-17T10:49:43.333Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 12",
          "workerId": null
        }
      },
      {
        "eventId": "1768646984048-4hkundmz",
        "ts": {
          "$date": "2026-01-17T10:49:44.048Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646985249-gb9y8y9n",
        "ts": {
          "$date": "2026-01-17T10:49:45.249Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 12",
          "workerId": null
        }
      },
      {
        "eventId": "1768646986302-2qjplsw3",
        "ts": {
          "$date": "2026-01-17T10:49:46.302Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646990382-w0qplcv6",
        "ts": {
          "$date": "2026-01-17T10:49:50.382Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 12",
          "workerId": null
        }
      },
      {
        "eventId": "1768646991373-k7bnesa7",
        "ts": {
          "$date": "2026-01-17T10:49:51.373Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646992146-ta6ozc0l",
        "ts": {
          "$date": "2026-01-17T10:49:52.146Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 12",
          "workerId": null
        }
      },
      {
        "eventId": "1768646993007-c6efhgq5",
        "ts": {
          "$date": "2026-01-17T10:49:53.007Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646997451-kemkgiae",
        "ts": {
          "$date": "2026-01-17T10:49:57.451Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 12 verarbeitet - Args: {\"duration\": 14.346273183822632, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646998297-4tvcgmpf",
        "ts": {
          "$date": "2026-01-17T10:49:58.297Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768646999010-cvtkqyxa",
        "ts": {
          "$date": "2026-01-17T10:49:59.010Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 12 verarbeitet - Args: {\"duration\": 13.851565837860107, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768646999936-ir1mdev9",
        "ts": {
          "$date": "2026-01-17T10:49:59.936Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647004187-k56hpcuk",
        "ts": {
          "$date": "2026-01-17T10:50:04.187Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 12 verarbeitet - Args: {\"duration\": 14.346273183822632, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647004922-qp7cuc4c",
        "ts": {
          "$date": "2026-01-17T10:50:04.922Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647006335-xhh8wgxn",
        "ts": {
          "$date": "2026-01-17T10:50:06.335Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 12 verarbeitet - Args: {\"duration\": 13.851565837860107, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647007224-qrlkvi6a",
        "ts": {
          "$date": "2026-01-17T10:50:07.224Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647011374-l6txfrbi",
        "ts": {
          "$date": "2026-01-17T10:50:11.374Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 13",
          "workerId": null
        }
      },
      {
        "eventId": "1768647012165-9eqzxgnk",
        "ts": {
          "$date": "2026-01-17T10:50:12.165Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647013207-c1lfrrql",
        "ts": {
          "$date": "2026-01-17T10:50:13.207Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 13",
          "workerId": null
        }
      },
      {
        "eventId": "1768647014006-tps342yy",
        "ts": {
          "$date": "2026-01-17T10:50:14.006Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647018060-k0mh0yj7",
        "ts": {
          "$date": "2026-01-17T10:50:18.060Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 13",
          "workerId": null
        }
      },
      {
        "eventId": "1768647018824-nl8tx1ut",
        "ts": {
          "$date": "2026-01-17T10:50:18.824Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647020186-n1i47x08",
        "ts": {
          "$date": "2026-01-17T10:50:20.186Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 13",
          "workerId": null
        }
      },
      {
        "eventId": "1768647021066-38tg256j",
        "ts": {
          "$date": "2026-01-17T10:50:21.066Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647024768-0h0iptsz",
        "ts": {
          "$date": "2026-01-17T10:50:24.768Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 13 verarbeitet - Args: {\"duration\": 13.817462682723999, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647025869-06jegz90",
        "ts": {
          "$date": "2026-01-17T10:50:25.869Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647027020-6fgd9hbw",
        "ts": {
          "$date": "2026-01-17T10:50:27.020Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 13 verarbeitet - Args: {\"duration\": 13.996856212615967, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647027953-avqgwknl",
        "ts": {
          "$date": "2026-01-17T10:50:27.953Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647032136-a55oeoay",
        "ts": {
          "$date": "2026-01-17T10:50:32.136Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 13 verarbeitet - Args: {\"duration\": 13.817462682723999, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647032906-mirex236",
        "ts": {
          "$date": "2026-01-17T10:50:32.906Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647033933-o456p3or",
        "ts": {
          "$date": "2026-01-17T10:50:33.933Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 13 verarbeitet - Args: {\"duration\": 13.996856212615967, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647034726-qrqp3t67",
        "ts": {
          "$date": "2026-01-17T10:50:34.726Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647038837-8xqcypgn",
        "ts": {
          "$date": "2026-01-17T10:50:38.837Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 14",
          "workerId": null
        }
      },
      {
        "eventId": "1768647039631-6914n9j3",
        "ts": {
          "$date": "2026-01-17T10:50:39.631Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647040752-vyuvk1fs",
        "ts": {
          "$date": "2026-01-17T10:50:40.752Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 14",
          "workerId": null
        }
      },
      {
        "eventId": "1768647041540-pickii83",
        "ts": {
          "$date": "2026-01-17T10:50:41.540Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647045737-r9d4yhgi",
        "ts": {
          "$date": "2026-01-17T10:50:45.737Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 14",
          "workerId": null
        }
      },
      {
        "eventId": "1768647046605-xxv9a8un",
        "ts": {
          "$date": "2026-01-17T10:50:46.605Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647047628-70a0x6bn",
        "ts": {
          "$date": "2026-01-17T10:50:47.628Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 14",
          "workerId": null
        }
      },
      {
        "eventId": "1768647048410-ykhfp8gk",
        "ts": {
          "$date": "2026-01-17T10:50:48.410Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647052396-tgfcllf6",
        "ts": {
          "$date": "2026-01-17T10:50:52.396Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 14 verarbeitet - Args: {\"duration\": 13.815740823745728, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647053289-xzfl8zmp",
        "ts": {
          "$date": "2026-01-17T10:50:53.289Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647054865-ygod21t6",
        "ts": {
          "$date": "2026-01-17T10:50:54.865Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 14 verarbeitet - Args: {\"duration\": 13.59130859375, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647055846-1qy8hklw",
        "ts": {
          "$date": "2026-01-17T10:50:55.846Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647059268-1fmblsnl",
        "ts": {
          "$date": "2026-01-17T10:50:59.268Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 14 verarbeitet - Args: {\"duration\": 13.815740823745728, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647060209-tpy1mnbj",
        "ts": {
          "$date": "2026-01-17T10:51:00.209Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647062055-ha2ou0l9",
        "ts": {
          "$date": "2026-01-17T10:51:02.055Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 14 verarbeitet - Args: {\"duration\": 13.59130859375, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647062940-96tj2r4b",
        "ts": {
          "$date": "2026-01-17T10:51:02.940Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647066242-d76835ht",
        "ts": {
          "$date": "2026-01-17T10:51:06.242Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 15",
          "workerId": null
        }
      },
      {
        "eventId": "1768647067122-wcllkapt",
        "ts": {
          "$date": "2026-01-17T10:51:07.122Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647068501-6prkmsan",
        "ts": {
          "$date": "2026-01-17T10:51:08.501Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 15",
          "workerId": null
        }
      },
      {
        "eventId": "1768647069319-9gs95csq",
        "ts": {
          "$date": "2026-01-17T10:51:09.319Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647073198-kds90ga9",
        "ts": {
          "$date": "2026-01-17T10:51:13.198Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 15",
          "workerId": null
        }
      },
      {
        "eventId": "1768647073919-r8hz667q",
        "ts": {
          "$date": "2026-01-17T10:51:13.919Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647075282-g38eiv02",
        "ts": {
          "$date": "2026-01-17T10:51:15.282Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 15",
          "workerId": null
        }
      },
      {
        "eventId": "1768647076195-lzjb8rra",
        "ts": {
          "$date": "2026-01-17T10:51:16.195Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647080092-67pnrxoz",
        "ts": {
          "$date": "2026-01-17T10:51:20.092Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 15 verarbeitet - Args: {\"duration\": 13.819410562515259, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647080921-3w5sc2mg",
        "ts": {
          "$date": "2026-01-17T10:51:20.921Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647081696-rayeiivi",
        "ts": {
          "$date": "2026-01-17T10:51:21.696Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 15 verarbeitet - Args: {\"duration\": 13.370087146759033, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647082574-vbxh0tj5",
        "ts": {
          "$date": "2026-01-17T10:51:22.574Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647086760-5ha1jtui",
        "ts": {
          "$date": "2026-01-17T10:51:26.760Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 15 verarbeitet - Args: {\"duration\": 13.819410562515259, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647087565-6r4swbqz",
        "ts": {
          "$date": "2026-01-17T10:51:27.565Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647088366-02ogpgcy",
        "ts": {
          "$date": "2026-01-17T10:51:28.366Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 15 verarbeitet - Args: {\"duration\": 13.370087146759033, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647089197-hwalfrhf",
        "ts": {
          "$date": "2026-01-17T10:51:29.197Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647093098-6a26qriq",
        "ts": {
          "$date": "2026-01-17T10:51:33.098Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 16",
          "workerId": null
        }
      },
      {
        "eventId": "1768647093883-w7truo94",
        "ts": {
          "$date": "2026-01-17T10:51:33.883Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647094717-in8xjwjm",
        "ts": {
          "$date": "2026-01-17T10:51:34.717Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 16",
          "workerId": null
        }
      },
      {
        "eventId": "1768647095458-1n9wyyaz",
        "ts": {
          "$date": "2026-01-17T10:51:35.458Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647099644-kcilkq66",
        "ts": {
          "$date": "2026-01-17T10:51:39.644Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 16",
          "workerId": null
        }
      },
      {
        "eventId": "1768647100630-a0yfntfu",
        "ts": {
          "$date": "2026-01-17T10:51:40.630Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647101505-xehcnlcm",
        "ts": {
          "$date": "2026-01-17T10:51:41.505Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 16",
          "workerId": null
        }
      },
      {
        "eventId": "1768647102406-pnkd3bpq",
        "ts": {
          "$date": "2026-01-17T10:51:42.406Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647106897-kcmg7pnq",
        "ts": {
          "$date": "2026-01-17T10:51:46.897Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 16 verarbeitet - Args: {\"duration\": 13.318490982055664, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647107784-095kbt2n",
        "ts": {
          "$date": "2026-01-17T10:51:47.784Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647108406-umty9smz",
        "ts": {
          "$date": "2026-01-17T10:51:48.406Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 16 verarbeitet - Args: {\"duration\": 13.242050647735596, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647109282-t7u0zfqn",
        "ts": {
          "$date": "2026-01-17T10:51:49.282Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647113965-8gt7pjhd",
        "ts": {
          "$date": "2026-01-17T10:51:53.965Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 16 verarbeitet - Args: {\"duration\": 13.318490982055664, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647114868-c5g5kmmi",
        "ts": {
          "$date": "2026-01-17T10:51:54.868Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647115483-xtnikr4b",
        "ts": {
          "$date": "2026-01-17T10:51:55.483Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 16 verarbeitet - Args: {\"duration\": 13.242050647735596, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647116327-49taunyt",
        "ts": {
          "$date": "2026-01-17T10:51:56.327Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647120273-v7my29cv",
        "ts": {
          "$date": "2026-01-17T10:52:00.273Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 17",
          "workerId": null
        }
      },
      {
        "eventId": "1768647121367-q3ortz8q",
        "ts": {
          "$date": "2026-01-17T10:52:01.367Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647121840-qxgih9vm",
        "ts": {
          "$date": "2026-01-17T10:52:01.840Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 17",
          "workerId": null
        }
      },
      {
        "eventId": "1768647122715-9rhrt72f",
        "ts": {
          "$date": "2026-01-17T10:52:02.715Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647127023-5nhyms1m",
        "ts": {
          "$date": "2026-01-17T10:52:07.023Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 17",
          "workerId": null
        }
      },
      {
        "eventId": "1768647127896-b8pjywyw",
        "ts": {
          "$date": "2026-01-17T10:52:07.896Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647128391-31lvivac",
        "ts": {
          "$date": "2026-01-17T10:52:08.391Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 17",
          "workerId": null
        }
      },
      {
        "eventId": "1768647129149-hxvtzteg",
        "ts": {
          "$date": "2026-01-17T10:52:09.149Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647134031-ay2ya804",
        "ts": {
          "$date": "2026-01-17T10:52:14.031Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 17 verarbeitet - Args: {\"duration\": 13.018945217132568, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647134935-i6yua70w",
        "ts": {
          "$date": "2026-01-17T10:52:14.935Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647135675-jnosq9ac",
        "ts": {
          "$date": "2026-01-17T10:52:15.675Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 17 verarbeitet - Args: {\"duration\": 12.995665550231934, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647136663-0qstmdix",
        "ts": {
          "$date": "2026-01-17T10:52:16.663Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647141054-qgp5og7g",
        "ts": {
          "$date": "2026-01-17T10:52:21.054Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 17 verarbeitet - Args: {\"duration\": 13.018945217132568, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647142037-47v3ldjn",
        "ts": {
          "$date": "2026-01-17T10:52:22.037Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647142695-ipvjcb6w",
        "ts": {
          "$date": "2026-01-17T10:52:22.695Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 17 verarbeitet - Args: {\"duration\": 12.995665550231934, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647143857-s7tr4xgb",
        "ts": {
          "$date": "2026-01-17T10:52:23.857Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647148548-zkwzgbdt",
        "ts": {
          "$date": "2026-01-17T10:52:28.548Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 18",
          "workerId": null
        }
      },
      {
        "eventId": "1768647149537-41v0r2d3",
        "ts": {
          "$date": "2026-01-17T10:52:29.537Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647150121-7w057khd",
        "ts": {
          "$date": "2026-01-17T10:52:30.121Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 18",
          "workerId": null
        }
      },
      {
        "eventId": "1768647151252-j84aot7e",
        "ts": {
          "$date": "2026-01-17T10:52:31.252Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647155660-3724judc",
        "ts": {
          "$date": "2026-01-17T10:52:35.660Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 18",
          "workerId": null
        }
      },
      {
        "eventId": "1768647156666-ghq7xsr0",
        "ts": {
          "$date": "2026-01-17T10:52:36.666Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 18",
          "workerId": null
        }
      },
      {
        "eventId": "1768647156715-7i13ch3v",
        "ts": {
          "$date": "2026-01-17T10:52:36.715Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647157459-w5hwgkdd",
        "ts": {
          "$date": "2026-01-17T10:52:37.459Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647162518-4oyendof",
        "ts": {
          "$date": "2026-01-17T10:52:42.518Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 18 verarbeitet - Args: {\"duration\": 14.767112493515015, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647163422-rqjy9iud",
        "ts": {
          "$date": "2026-01-17T10:52:43.422Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647163817-uhce91re",
        "ts": {
          "$date": "2026-01-17T10:52:43.817Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 18 verarbeitet - Args: {\"duration\": 13.750513792037964, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647164617-669ck7u9",
        "ts": {
          "$date": "2026-01-17T10:52:44.617Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647169102-k6bitqop",
        "ts": {
          "$date": "2026-01-17T10:52:49.102Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 18 verarbeitet - Args: {\"duration\": 14.767112493515015, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647169826-5jygtzkz",
        "ts": {
          "$date": "2026-01-17T10:52:49.826Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647170574-xtt0efy7",
        "ts": {
          "$date": "2026-01-17T10:52:50.574Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 18 verarbeitet - Args: {\"duration\": 13.750513792037964, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647171477-fiowvj26",
        "ts": {
          "$date": "2026-01-17T10:52:51.477Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647176081-z6n7ui1v",
        "ts": {
          "$date": "2026-01-17T10:52:56.081Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 19",
          "workerId": null
        }
      },
      {
        "eventId": "1768647176842-h40bj7ih",
        "ts": {
          "$date": "2026-01-17T10:52:56.842Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647177509-j0y3d8vs",
        "ts": {
          "$date": "2026-01-17T10:52:57.509Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 19",
          "workerId": null
        }
      },
      {
        "eventId": "1768647178343-jbnn4418",
        "ts": {
          "$date": "2026-01-17T10:52:58.343Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647182885-fyeojz99",
        "ts": {
          "$date": "2026-01-17T10:53:02.885Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 19",
          "workerId": null
        }
      },
      {
        "eventId": "1768647183643-snetogrp",
        "ts": {
          "$date": "2026-01-17T10:53:03.643Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647184467-q19qvrth",
        "ts": {
          "$date": "2026-01-17T10:53:04.467Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 19",
          "workerId": null
        }
      },
      {
        "eventId": "1768647185334-n35bueuz",
        "ts": {
          "$date": "2026-01-17T10:53:05.334Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647189794-n9l01fzt",
        "ts": {
          "$date": "2026-01-17T10:53:09.794Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 19 verarbeitet - Args: {\"duration\": 13.799058437347412, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647190799-w1621mdh",
        "ts": {
          "$date": "2026-01-17T10:53:10.799Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647191438-r6rj6948",
        "ts": {
          "$date": "2026-01-17T10:53:11.438Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 19 verarbeitet - Args: {\"duration\": 14.022207498550415, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647192422-3yh3v5za",
        "ts": {
          "$date": "2026-01-17T10:53:12.422Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647196815-13ldixy3",
        "ts": {
          "$date": "2026-01-17T10:53:16.815Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 19 verarbeitet - Args: {\"duration\": 13.799058437347412, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647197599-h7goloe8",
        "ts": {
          "$date": "2026-01-17T10:53:17.599Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647198058-6cwczpgz",
        "ts": {
          "$date": "2026-01-17T10:53:18.058Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 19 verarbeitet - Args: {\"duration\": 14.022207498550415, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647198977-8ovcqed6",
        "ts": {
          "$date": "2026-01-17T10:53:18.977Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647204267-34o1ir0j",
        "ts": {
          "$date": "2026-01-17T10:53:24.267Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 20",
          "workerId": null
        }
      },
      {
        "eventId": "1768647205156-cfbdkntw",
        "ts": {
          "$date": "2026-01-17T10:53:25.156Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647205838-wnk9bn2b",
        "ts": {
          "$date": "2026-01-17T10:53:25.838Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 20",
          "workerId": null
        }
      },
      {
        "eventId": "1768647206676-804bp3ux",
        "ts": {
          "$date": "2026-01-17T10:53:26.676Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647211095-63e2vvuq",
        "ts": {
          "$date": "2026-01-17T10:53:31.095Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 20",
          "workerId": null
        }
      },
      {
        "eventId": "1768647211973-35r4ymzs",
        "ts": {
          "$date": "2026-01-17T10:53:31.973Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647212298-r72s958a",
        "ts": {
          "$date": "2026-01-17T10:53:32.298Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 20",
          "workerId": null
        }
      },
      {
        "eventId": "1768647213218-4nte4kf4",
        "ts": {
          "$date": "2026-01-17T10:53:33.218Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647218287-wqbvk65y",
        "ts": {
          "$date": "2026-01-17T10:53:38.287Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 20 verarbeitet - Args: {\"duration\": 14.451772928237915, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647219150-2qyt47sv",
        "ts": {
          "$date": "2026-01-17T10:53:39.150Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647219337-sbrv90lg",
        "ts": {
          "$date": "2026-01-17T10:53:39.337Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 20 verarbeitet - Args: {\"duration\": 13.797349214553833, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647220177-uumeqpf8",
        "ts": {
          "$date": "2026-01-17T10:53:40.177Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647225674-kwkfc4fu",
        "ts": {
          "$date": "2026-01-17T10:53:45.674Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 20 verarbeitet - Args: {\"duration\": 14.451772928237915, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647226191-j43n54un",
        "ts": {
          "$date": "2026-01-17T10:53:46.191Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 20 verarbeitet - Args: {\"duration\": 13.797349214553833, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647226477-oozoy79w",
        "ts": {
          "$date": "2026-01-17T10:53:46.477Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647227127-af52o4uj",
        "ts": {
          "$date": "2026-01-17T10:53:47.127Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647232348-w141j1vm",
        "ts": {
          "$date": "2026-01-17T10:53:52.348Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 21",
          "workerId": null
        }
      },
      {
        "eventId": "1768647232907-r4rqfp2a",
        "ts": {
          "$date": "2026-01-17T10:53:52.907Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 21",
          "workerId": null
        }
      },
      {
        "eventId": "1768647233110-qkikfnik",
        "ts": {
          "$date": "2026-01-17T10:53:53.110Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647233555-6qnnzfvo",
        "ts": {
          "$date": "2026-01-17T10:53:53.555Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647238704-mxxd6br9",
        "ts": {
          "$date": "2026-01-17T10:53:58.704Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 21",
          "workerId": null
        }
      },
      {
        "eventId": "1768647239461-42up9k3r",
        "ts": {
          "$date": "2026-01-17T10:53:59.461Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647239573-m52kdxwe",
        "ts": {
          "$date": "2026-01-17T10:53:59.573Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 21",
          "workerId": null
        }
      },
      {
        "eventId": "1768647240503-bjgn77ns",
        "ts": {
          "$date": "2026-01-17T10:54:00.503Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647245664-xtblyz23",
        "ts": {
          "$date": "2026-01-17T10:54:05.664Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 21 verarbeitet - Args: {\"duration\": 13.019497871398926, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647246701-ml3vvamk",
        "ts": {
          "$date": "2026-01-17T10:54:06.701Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647246921-fbq9qgjr",
        "ts": {
          "$date": "2026-01-17T10:54:06.921Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 21 verarbeitet - Args: {\"duration\": 13.534343242645264, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647247894-uy5913bb",
        "ts": {
          "$date": "2026-01-17T10:54:07.894Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647253038-fr9l41ne",
        "ts": {
          "$date": "2026-01-17T10:54:13.038Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 21 verarbeitet - Args: {\"duration\": 13.019497871398926, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647253750-pgqgygnu",
        "ts": {
          "$date": "2026-01-17T10:54:13.750Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647254424-na4m9wh7",
        "ts": {
          "$date": "2026-01-17T10:54:14.424Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 21 verarbeitet - Args: {\"duration\": 13.534343242645264, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647255350-27d05n3f",
        "ts": {
          "$date": "2026-01-17T10:54:15.350Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647259508-2irorf58",
        "ts": {
          "$date": "2026-01-17T10:54:19.508Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 22",
          "workerId": null
        }
      },
      {
        "eventId": "1768647260397-tm4n9jja",
        "ts": {
          "$date": "2026-01-17T10:54:20.397Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647261472-4e77her6",
        "ts": {
          "$date": "2026-01-17T10:54:21.472Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 22",
          "workerId": null
        }
      },
      {
        "eventId": "1768647262488-8da9t8r9",
        "ts": {
          "$date": "2026-01-17T10:54:22.488Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647266465-6ll6ytam",
        "ts": {
          "$date": "2026-01-17T10:54:26.465Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 22",
          "workerId": null
        }
      },
      {
        "eventId": "1768647267218-u688ck2t",
        "ts": {
          "$date": "2026-01-17T10:54:27.218Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647268059-1c4asamc",
        "ts": {
          "$date": "2026-01-17T10:54:28.059Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 22",
          "workerId": null
        }
      },
      {
        "eventId": "1768647268710-wjdoilj6",
        "ts": {
          "$date": "2026-01-17T10:54:28.710Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647271992-sveoblj1",
        "ts": {
          "$date": "2026-01-17T10:54:31.992Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 22 verarbeitet - Args: {\"duration\": 13.479390144348145, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647272733-pkehstxy",
        "ts": {
          "$date": "2026-01-17T10:54:32.733Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647274548-o27e0lq8",
        "ts": {
          "$date": "2026-01-17T10:54:34.548Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 22 verarbeitet - Args: {\"duration\": 13.328033447265625, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647275340-8r2xri9g",
        "ts": {
          "$date": "2026-01-17T10:54:35.340Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647277746-xkcprf7t",
        "ts": {
          "$date": "2026-01-17T10:54:37.746Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 22 verarbeitet - Args: {\"duration\": 13.479390144348145, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647278347-l7ne9tjv",
        "ts": {
          "$date": "2026-01-17T10:54:38.347Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647280659-xfafcyrt",
        "ts": {
          "$date": "2026-01-17T10:54:40.659Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 22 verarbeitet - Args: {\"duration\": 13.328033447265625, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647281568-tnueywes",
        "ts": {
          "$date": "2026-01-17T10:54:41.568Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647284330-917qbt9p",
        "ts": {
          "$date": "2026-01-17T10:54:44.330Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 23",
          "workerId": null
        }
      },
      {
        "eventId": "1768647284860-k0vm1e9b",
        "ts": {
          "$date": "2026-01-17T10:54:44.860Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647286418-4znx46c8",
        "ts": {
          "$date": "2026-01-17T10:54:46.418Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 23",
          "workerId": null
        }
      },
      {
        "eventId": "1768647287257-oqmhakl2",
        "ts": {
          "$date": "2026-01-17T10:54:47.257Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647290627-mqmwf673",
        "ts": {
          "$date": "2026-01-17T10:54:50.627Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 23",
          "workerId": null
        }
      },
      {
        "eventId": "1768647291305-kkbx3eke",
        "ts": {
          "$date": "2026-01-17T10:54:51.305Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647291562-zyygvi9n",
        "ts": {
          "$date": "2026-01-17T10:54:51.562Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 23",
          "workerId": null
        }
      },
      {
        "eventId": "1768647292074-iznvzs39",
        "ts": {
          "$date": "2026-01-17T10:54:52.074Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647297353-4r3s8fxd",
        "ts": {
          "$date": "2026-01-17T10:54:57.353Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 23 verarbeitet - Args: {\"duration\": 13.067193508148193, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647298273-ltybpr5s",
        "ts": {
          "$date": "2026-01-17T10:54:58.273Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647298742-2gdfdrar",
        "ts": {
          "$date": "2026-01-17T10:54:58.742Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 23 verarbeitet - Args: {\"duration\": 10.409128904342651, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647299491-ou6xnk8v",
        "ts": {
          "$date": "2026-01-17T10:54:59.491Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647304729-e2idayp0",
        "ts": {
          "$date": "2026-01-17T10:55:04.729Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 23 verarbeitet - Args: {\"duration\": 13.067193508148193, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647305667-awvh2duh",
        "ts": {
          "$date": "2026-01-17T10:55:05.667Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647305917-ui9m11k2",
        "ts": {
          "$date": "2026-01-17T10:55:05.917Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 23 verarbeitet - Args: {\"duration\": 10.409128904342651, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647306940-dqvfzgk5",
        "ts": {
          "$date": "2026-01-17T10:55:06.940Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647312143-0nd27zpy",
        "ts": {
          "$date": "2026-01-17T10:55:12.143Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 24",
          "workerId": null
        }
      },
      {
        "eventId": "1768647312815-2tf7nh3q",
        "ts": {
          "$date": "2026-01-17T10:55:12.815Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 24",
          "workerId": null
        }
      },
      {
        "eventId": "1768647313021-o8ae0bpu",
        "ts": {
          "$date": "2026-01-17T10:55:13.021Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647313656-h4q7qf4m",
        "ts": {
          "$date": "2026-01-17T10:55:13.656Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647319001-3yuv075d",
        "ts": {
          "$date": "2026-01-17T10:55:19.001Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 24",
          "workerId": null
        }
      },
      {
        "eventId": "1768647319629-6p9ymavd",
        "ts": {
          "$date": "2026-01-17T10:55:19.629Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 24",
          "workerId": null
        }
      },
      {
        "eventId": "1768647319772-zdfegmwm",
        "ts": {
          "$date": "2026-01-17T10:55:19.772Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647320340-pvla66p1",
        "ts": {
          "$date": "2026-01-17T10:55:20.340Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647325447-nxdc7bp8",
        "ts": {
          "$date": "2026-01-17T10:55:25.447Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 24 verarbeitet - Args: {\"duration\": 14.068197965621948, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647326221-0p1etedm",
        "ts": {
          "$date": "2026-01-17T10:55:26.221Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647326325-rzdmchn6",
        "ts": {
          "$date": "2026-01-17T10:55:26.325Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 24 verarbeitet - Args: {\"duration\": 13.516017198562622, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647327100-hqkmbzhn",
        "ts": {
          "$date": "2026-01-17T10:55:27.100Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647331288-3fvku1m6",
        "ts": {
          "$date": "2026-01-17T10:55:31.288Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 24 verarbeitet - Args: {\"duration\": 14.068197965621948, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647332010-r69qrn83",
        "ts": {
          "$date": "2026-01-17T10:55:32.010Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647332414-krmg2g42",
        "ts": {
          "$date": "2026-01-17T10:55:32.414Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 24 verarbeitet - Args: {\"duration\": 13.516017198562622, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647333490-c5dvk3o3",
        "ts": {
          "$date": "2026-01-17T10:55:33.490Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647338053-b7daiupb",
        "ts": {
          "$date": "2026-01-17T10:55:38.053Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 25",
          "workerId": null
        }
      },
      {
        "eventId": "1768647338955-jr2htbz2",
        "ts": {
          "$date": "2026-01-17T10:55:38.955Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647339469-gyxiko4c",
        "ts": {
          "$date": "2026-01-17T10:55:39.469Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 25",
          "workerId": null
        }
      },
      {
        "eventId": "1768647340197-66tx5ues",
        "ts": {
          "$date": "2026-01-17T10:55:40.197Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647346374-vavh3amq",
        "ts": {
          "$date": "2026-01-17T10:55:46.374Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 25",
          "workerId": null
        }
      },
      {
        "eventId": "1768647347160-kjv43s0v",
        "ts": {
          "$date": "2026-01-17T10:55:47.160Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 25",
          "workerId": null
        }
      },
      {
        "eventId": "1768647347226-0anwr03v",
        "ts": {
          "$date": "2026-01-17T10:55:47.226Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647348032-rabl2rcf",
        "ts": {
          "$date": "2026-01-17T10:55:48.032Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647355366-xrwyl0zu",
        "ts": {
          "$date": "2026-01-17T10:55:55.366Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 25 verarbeitet - Args: {\"duration\": 15.260030031204224, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647355955-7ujgrjjx",
        "ts": {
          "$date": "2026-01-17T10:55:55.955Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 25 verarbeitet - Args: {\"duration\": 14.62232780456543, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647356629-t8yookcx",
        "ts": {
          "$date": "2026-01-17T10:55:56.629Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647357135-5hmgzc3h",
        "ts": {
          "$date": "2026-01-17T10:55:57.135Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647363690-3zx4m07z",
        "ts": {
          "$date": "2026-01-17T10:56:03.690Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 25 verarbeitet - Args: {\"duration\": 15.260030031204224, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647364615-buz3nwsh",
        "ts": {
          "$date": "2026-01-17T10:56:04.615Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 25 verarbeitet - Args: {\"duration\": 14.62232780456543, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647364734-1hyyunlr",
        "ts": {
          "$date": "2026-01-17T10:56:04.734Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647365776-m3tmt31c",
        "ts": {
          "$date": "2026-01-17T10:56:05.776Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647373654-06nfxxjl",
        "ts": {
          "$date": "2026-01-17T10:56:13.654Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 26",
          "workerId": null
        }
      },
      {
        "eventId": "1768647374509-p7dbjpmg",
        "ts": {
          "$date": "2026-01-17T10:56:14.509Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 26",
          "workerId": null
        }
      },
      {
        "eventId": "1768647374593-roh1nf5o",
        "ts": {
          "$date": "2026-01-17T10:56:14.593Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647375430-asxmwoy6",
        "ts": {
          "$date": "2026-01-17T10:56:15.430Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647383696-5hsurjpq",
        "ts": {
          "$date": "2026-01-17T10:56:23.696Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 26",
          "workerId": null
        }
      },
      {
        "eventId": "1768647384272-z634i0t4",
        "ts": {
          "$date": "2026-01-17T10:56:24.272Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 26",
          "workerId": null
        }
      },
      {
        "eventId": "1768647384570-vaowjtzl",
        "ts": {
          "$date": "2026-01-17T10:56:24.570Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647385245-4zxyy3t0",
        "ts": {
          "$date": "2026-01-17T10:56:25.245Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647392783-gnbdz7p8",
        "ts": {
          "$date": "2026-01-17T10:56:32.783Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 26 verarbeitet - Args: {\"duration\": 19.74547052383423, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647394095-3gpu7h9d",
        "ts": {
          "$date": "2026-01-17T10:56:34.095Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647394458-b5di7di9",
        "ts": {
          "$date": "2026-01-17T10:56:34.458Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 26 verarbeitet - Args: {\"duration\": 19.592345714569092, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647395437-ro427ecs",
        "ts": {
          "$date": "2026-01-17T10:56:35.437Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647402301-litmmhgv",
        "ts": {
          "$date": "2026-01-17T10:56:42.301Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 26 verarbeitet - Args: {\"duration\": 19.74547052383423, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647403410-8kwg98oc",
        "ts": {
          "$date": "2026-01-17T10:56:43.410Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647403803-ayhaxdi5",
        "ts": {
          "$date": "2026-01-17T10:56:43.803Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 26 verarbeitet - Args: {\"duration\": 19.592345714569092, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768647405059-77y9x39v",
        "ts": {
          "$date": "2026-01-17T10:56:45.059Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647413454-3sa4obdr",
        "ts": {
          "$date": "2026-01-17T10:56:53.454Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 27",
          "workerId": null
        }
      },
      {
        "eventId": "1768647414669-7geljq8e",
        "ts": {
          "$date": "2026-01-17T10:56:54.669Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647414826-f53plgoh",
        "ts": {
          "$date": "2026-01-17T10:56:54.826Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 27",
          "workerId": null
        }
      },
      {
        "eventId": "1768647416393-3x0p6kr2",
        "ts": {
          "$date": "2026-01-17T10:56:56.393Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647425121-i6mr6oou",
        "ts": {
          "$date": "2026-01-17T10:57:05.121Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 27",
          "workerId": null
        }
      },
      {
        "eventId": "1768647427060-v1x774al",
        "ts": {
          "$date": "2026-01-17T10:57:07.060Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 27",
          "workerId": null
        }
      },
      {
        "eventId": "1768647427259-qmd8gj7w",
        "ts": {
          "$date": "2026-01-17T10:57:07.259Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768647428957-o45o5yol",
        "ts": {
          "$date": "2026-01-17T10:57:08.957Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      }
    ],
    "spans": [
      {
        "spanId": "job",
        "name": "job",
        "status": "running",
        "startedAt": {
          "$date": "2026-01-17T10:43:53.666Z"
        }
      },
      {
        "spanId": "preprocess",
        "parentSpanId": "job",
        "name": "preprocess",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T10:43:58.160Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T10:43:58.907Z"
        }
      },
      {
        "spanId": "extract",
        "parentSpanId": "job",
        "name": "extract_pdf",
        "phase": null,
        "status": "running",
        "startedAt": {
          "$date": "2026-01-17T10:44:01.035Z"
        },
        "attributes": {}
      }
    ],
    "currentSpanId": "extract"
  },
  "shadowTwinState": {
    "baseItem": {
      "id": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvU3Rha2Vob2xkZXIvVm9yc2NobGFlZ2VfU0hGX0JFUkVJVFNfSU5fVU1TRVRaVU5HLnBkZg==",
      "metadata": {
        "name": "Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf"
      }
    },
    "transformed": null,
    "transcriptFiles": null,
    "shadowTwinFolderId": null,
    "mediaFiles": null,
    "analysisTimestamp": 1768646633829,
    "analysisError": null,
    "processingStatus": "processing"
  },
  "processId": "job-8c16ea99-0beb-46c8-b9e2-c0ec1155b403"
}

mistral_ocr  ist eine konfigurations sache - habe das umgestellt. bleibt sonst noch was übrig?

---

**Cursor**

Ich habe deine Änderung so verstanden: Du hast die Library-Defaults für den Batch-Flow auf `mistral_ocr` gestellt. Dann ist der wahrscheinlichste Unterschied zum Story-Creator beseitigt. Im Log sieht man, dass der Batch-Job im Extract-Callback nur Progress-Events bekommt und nie ein Final-Payload. Das passt zu einem fehlerhaften „native“-Pfad im Secretary-Service. Wenn der Batch jetzt über `mistral_ocr` läuft, sollte der Callback ein finales Payload mit `mistral_ocr_raw_url` und `pages_archive_url` liefern und die Pipeline weiterlaufen.

Was sonst noch „übrig“ sein könnte, ist v. a. Beobachtung und Verifikation: Der Callback-Handler erkennt Final-Payload auch bei `mistral_ocr`. Wenn der Secretary-Service jetzt weiterhin nur Progress sendet (oder das finale Payload anders strukturiert ist), bleibt der Job im Extract hängen. Dann wäre der nächste Schritt ein Fix im Secretary-Service oder ein Fallback, der das Ergebnis nachlädt. Solange wir das nicht getestet haben, kann ich nichts als „gelöst“ deklarieren.

## Verifikations-Checkliste (ohne Codeänderung)
- **Batch neu starten** mit `mistral_ocr` aktiv und einem kleinen Verzeichnis (2–3 PDFs).
- **Job-Log prüfen**: Es sollte nach `progress`-Events ein Callback mit `phase: completed` oder `data.mistral_ocr_raw_url`/`data.pages_archive_url` erscheinen.
- **UI-Status**: `extract_pdf` muss auf `completed` springen, danach `transform_template` und `ingest_rag`.
- **Ende-Resultat**: Shadow‑Twin-Artefakte (`.pdfanalyse.de.md` bzw. `{base}.{template}.{lang}.md`) und RAG-Ingestion sind vorhanden.
- **Timeouts**: Wenn ein Job >10–15 min ohne Final-Payload bleibt, ist das weiterhin ein Fehler (Service/Callback).

Wenn du willst, kann ich danach gezielt die Logs/Events aus dem nächsten Batch anschauen und sagen, ob noch etwas im Code ergänzt werden muss.

---

**User**

Ich sehe gerade, dass ich bei bestehenden Transformation eigentlich bei jedem PDF alle artefakte vermisse, weil es wird ja nur das Transkriptions-Markdown generiert und dieses Analyse-Dokument, aber ich vermisse die einzelnen Seiten, die ja durch den Secretary Service ja auch geliefert werden, die Bilder. Wo sind die geblieben? 

2(weis nicht, was steht in den logs?) - sollen wir es nochmal nachstellen?

---

**Cursor**

Ja, lass uns es nachstellen. Bitte reagiere so:

1) **Repro**: Einzelnes PDF im Story Creator starten (mistral_ocr).  
2) **Log-Ausschnitt** posten: Bitte die Callback-/Job-Logs mit den Feldern:
- `data.pages_archive_url` / `data.pages_archive_data`
- `data.images_archive_url` (falls vorhanden)
- `data.mistral_ocr_raw_url`
- `options.includePageImages` und `options.includeOcrImages`

Warum das wichtig ist:  
Die Seitenbilder werden **nicht** als normale Dateien neben dem Markdown gespeichert, sondern typischerweise im **Shadow‑Twin**-Ordner gespeichert, **wenn** `includePageImages=true` ist und der Callback ein `pages_archive_url` liefert. Fehlt das, werden keine Bilder extrahiert/gespeichert. Sobald ich den Log sehe, kann ich genau sagen, ob es ein Konfigurationsproblem (Flags) oder ein Service-Callback-Thema ist.

---

**User**

{
  "_id": {
    "$oid": "696b702fe0a765b740fe87be"
  },
  "jobId": "bd65f017-ed19-4c28-93fe-55beb21a8dea",
  "jobSecretHash": "bea3e59a4cc75dd1970b5e112eed51a928e5217ddea39e5d9a5fe8c114838cc3",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "completed",
  "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "bd65f017-ed19-4c28-93fe-55beb21a8dea",
    "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf",
      "itemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRm",
      "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdA=="
    },
    "options": {
      "targetLanguage": "en",
      "extractionMethod": "native",
      "includeOcrImages": null,
      "includePageImages": null,
      "includeImages": false,
      "useCache": true
    },
    "batchId": "271cb421-3c24-443a-a977-4c2559823b43",
    "batchName": "Stakeholder Intern"
  },
  "createdAt": {
    "$date": "2026-01-17T11:19:11.960Z"
  },
  "updatedAt": {
    "$date": "2026-01-17T11:37:19.093Z"
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "startedAt": {
        "$date": "2026-01-17T11:34:38.246Z"
      },
      "endedAt": {
        "$date": "2026-01-17T11:36:16.665Z"
      }
    },
    {
      "name": "transform_template",
      "status": "completed",
      "startedAt": {
        "$date": "2026-01-17T11:36:30.496Z"
      },
      "details": {
        "source": "primary"
      },
      "endedAt": {
        "$date": "2026-01-17T11:37:16.702Z"
      }
    },
    {
      "name": "ingest_rag",
      "status": "completed",
      "startedAt": {
        "$date": "2026-01-17T11:36:46.082Z"
      },
      "endedAt": {
        "$date": "2026-01-17T11:37:15.923Z"
      }
    }
  ],
  "parameters": {
    "targetLanguage": "en",
    "extractionMethod": "native",
    "includeOcrImages": null,
    "includePageImages": null,
    "includeImages": false,
    "useCache": true,
    "template": null,
    "phases": {
      "extract": true,
      "template": true,
      "ingest": true
    },
    "policies": {
      "extract": "do",
      "metadata": "do",
      "ingest": "do"
    },
    "batchId": "271cb421-3c24-443a-a977-4c2559823b43",
    "batchName": "Stakeholder Intern"
  },
  "trace": {
    "events": [
      {
        "eventId": "1768649676685-oori3eai",
        "ts": {
          "$date": "2026-01-17T11:34:36.685Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_found_markdown",
        "level": "info",
        "message": null,
        "attributes": {
          "expectedFileName": null,
          "existingFileId": null
        }
      },
      {
        "eventId": "1768649676819-wy83ohud",
        "ts": {
          "$date": "2026-01-17T11:34:36.819Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_frontmatter_valid",
        "level": "info",
        "message": null,
        "attributes": {
          "hasFrontmatter": false,
          "valid": false,
          "expectedFileName": null,
          "existingFileId": null,
          "hasMarkdown": false,
          "metaKeys": [],
          "reasons": [
            "no_markdown_found"
          ]
        }
      },
      {
        "eventId": "1768649676940-ghgprqyv",
        "ts": {
          "$date": "2026-01-17T11:34:36.940Z"
        },
        "spanId": "preprocess",
        "name": "preprocess_summary",
        "level": "info",
        "message": null,
        "attributes": {
          "hasMarkdown": false,
          "hasFrontmatter": false,
          "frontmatterValid": false
        }
      },
      {
        "eventId": "1768649677425-v34i8e2r",
        "ts": {
          "$date": "2026-01-17T11:34:37.425Z"
        },
        "spanId": "preprocess",
        "name": "process_pdf_submit",
        "level": "info",
        "message": null,
        "attributes": {
          "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
          "fileName": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf",
          "extractionMethod": "native",
          "targetLanguage": "en",
          "includeOcrImages": null,
          "includePageImages": null,
          "includeImages": false,
          "useCache": true,
          "template": null,
          "phases": {
            "extract": true,
            "template": true,
            "ingest": true
          },
          "startRequestId": "b189fa99-0c42-4a6f-b908-e91ef6bdaa87",
          "workerId": "ee2bd7c4-1558-4da7-b6e7-a5d03ff9c23d",
          "workerTickId": "3ac8c128-2e2b-43cc-8398-3503655aeba4",
          "pid": 41832
        }
      },
      {
        "eventId": "1768649678187-jn8awytt",
        "ts": {
          "$date": "2026-01-17T11:34:38.187Z"
        },
        "spanId": "preprocess",
        "name": "request_ack",
        "level": "info",
        "message": null,
        "attributes": {
          "status": 202,
          "statusText": "ACCEPTED",
          "url": "http://127.0.0.1:5001/api/pdf/process",
          "extractionMethod": "native",
          "startRequestId": "b189fa99-0c42-4a6f-b908-e91ef6bdaa87",
          "workerId": "ee2bd7c4-1558-4da7-b6e7-a5d03ff9c23d",
          "workerTickId": "3ac8c128-2e2b-43cc-8398-3503655aeba4",
          "pid": 41832
        }
      },
      {
        "eventId": "1768649678569-9zjia90v",
        "ts": {
          "$date": "2026-01-17T11:34:38.569Z"
        },
        "spanId": "extract",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "extract_pdf"
        }
      },
      {
        "eventId": "1768649735350-5vddg761",
        "ts": {
          "$date": "2026-01-17T11:35:35.350Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "initializing",
          "progress": 5,
          "message": "Job initialisiert",
          "workerId": null
        }
      },
      {
        "eventId": "1768649735491-g2ib8liu",
        "ts": {
          "$date": "2026-01-17T11:35:35.491Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "initializing",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "progress",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649737189-hrcd4347",
        "ts": {
          "$date": "2026-01-17T11:35:37.189Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Verarbeite Datei: upload_077c88f2-7a47-46c8-8c54-3248d80c523e.pdf - Args: {\"file_size\": 147989, \"working_dir\": \"cache\\\\pdf\\\\temp\\\\pdf\\\\bb5ed29645ae3b1e\", \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649737343-wh04zy9g",
        "ts": {
          "$date": "2026-01-17T11:35:37.343Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649739985-mqtyewyq",
        "ts": {
          "$date": "2026-01-17T11:35:39.985Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Starte Extraktion (Methoden: ['native'])",
          "workerId": null
        }
      },
      {
        "eventId": "1768649740184-hpw4xt21",
        "ts": {
          "$date": "2026-01-17T11:35:40.184Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649741827-qa6bhhm3",
        "ts": {
          "$date": "2026-01-17T11:35:41.827Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 1",
          "workerId": null
        }
      },
      {
        "eventId": "1768649742014-m8ze5417",
        "ts": {
          "$date": "2026-01-17T11:35:42.014Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649743959-byhor986",
        "ts": {
          "$date": "2026-01-17T11:35:43.959Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 1 verarbeitet - Args: {\"duration\": 1.858414888381958, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649744115-vu9r1kio",
        "ts": {
          "$date": "2026-01-17T11:35:44.115Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649746347-1envg60w",
        "ts": {
          "$date": "2026-01-17T11:35:46.347Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 2",
          "workerId": null
        }
      },
      {
        "eventId": "1768649746505-f4vcsgcq",
        "ts": {
          "$date": "2026-01-17T11:35:46.505Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649748460-o3yt710s",
        "ts": {
          "$date": "2026-01-17T11:35:48.460Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 2 verarbeitet - Args: {\"duration\": 2.4491076469421387, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649748611-gytic3t7",
        "ts": {
          "$date": "2026-01-17T11:35:48.611Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649750990-uqmafgtb",
        "ts": {
          "$date": "2026-01-17T11:35:50.990Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 3",
          "workerId": null
        }
      },
      {
        "eventId": "1768649751116-lml6gcm6",
        "ts": {
          "$date": "2026-01-17T11:35:51.116Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649752818-dtach21i",
        "ts": {
          "$date": "2026-01-17T11:35:52.818Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 3 verarbeitet - Args: {\"duration\": 2.5700788497924805, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649752979-wrgy7z7y",
        "ts": {
          "$date": "2026-01-17T11:35:52.979Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649754968-hl22fqiz",
        "ts": {
          "$date": "2026-01-17T11:35:54.968Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 4",
          "workerId": null
        }
      },
      {
        "eventId": "1768649755092-c0vbkxqd",
        "ts": {
          "$date": "2026-01-17T11:35:55.092Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649756741-qtb0se0j",
        "ts": {
          "$date": "2026-01-17T11:35:56.741Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 4 verarbeitet - Args: {\"duration\": 2.173557758331299, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649756847-cr9mcbnf",
        "ts": {
          "$date": "2026-01-17T11:35:56.847Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649758455-633uy7c0",
        "ts": {
          "$date": "2026-01-17T11:35:58.455Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 5",
          "workerId": null
        }
      },
      {
        "eventId": "1768649758618-dvjwtwgr",
        "ts": {
          "$date": "2026-01-17T11:35:58.618Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649760556-u8xxzlb2",
        "ts": {
          "$date": "2026-01-17T11:36:00.556Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 5 verarbeitet - Args: {\"duration\": 1.9171664714813232, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649760645-96cgn9sb",
        "ts": {
          "$date": "2026-01-17T11:36:00.645Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649762471-rhdiis4d",
        "ts": {
          "$date": "2026-01-17T11:36:02.471Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 6",
          "workerId": null
        }
      },
      {
        "eventId": "1768649762612-qdw3olb7",
        "ts": {
          "$date": "2026-01-17T11:36:02.612Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649765279-rq9pnqki",
        "ts": {
          "$date": "2026-01-17T11:36:05.279Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 6 verarbeitet - Args: {\"duration\": 2.025188684463501, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649765463-hx18s42s",
        "ts": {
          "$date": "2026-01-17T11:36:05.463Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649767346-dyb7iqfm",
        "ts": {
          "$date": "2026-01-17T11:36:07.346Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 7",
          "workerId": null
        }
      },
      {
        "eventId": "1768649767525-b13p2str",
        "ts": {
          "$date": "2026-01-17T11:36:07.525Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649770252-t65cajm7",
        "ts": {
          "$date": "2026-01-17T11:36:10.252Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 7 verarbeitet - Args: {\"duration\": 2.1291215419769287, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649770383-5w673w40",
        "ts": {
          "$date": "2026-01-17T11:36:10.383Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649771492-726asicm",
        "ts": {
          "$date": "2026-01-17T11:36:11.492Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "verarbeite Seite 8",
          "workerId": null
        }
      },
      {
        "eventId": "1768649771689-b7yw1e4n",
        "ts": {
          "$date": "2026-01-17T11:36:11.689Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649773171-pijktr82",
        "ts": {
          "$date": "2026-01-17T11:36:13.171Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "running",
          "progress": null,
          "message": "Seite 8 verarbeitet - Args: {\"duration\": 1.4164597988128662, \"extraction_methods\": [\"native\"]}",
          "workerId": null
        }
      },
      {
        "eventId": "1768649773352-0e0dzj5s",
        "ts": {
          "$date": "2026-01-17T11:36:13.352Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "running",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649774874-8j24t6yk",
        "ts": {
          "$date": "2026-01-17T11:36:14.874Z"
        },
        "spanId": "extract",
        "name": "progress",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "postprocessing",
          "progress": 95,
          "message": "Ergebnisse werden gespeichert",
          "workerId": null
        }
      },
      {
        "eventId": "1768649774982-tt2kro4q",
        "ts": {
          "$date": "2026-01-17T11:36:14.982Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "postprocessing",
            "hasFinalPayload": false,
            "keys": [
              "phase",
              "progress",
              "message",
              "process"
            ],
            "dataKeys": [],
            "dataSample": {}
          }
        }
      },
      {
        "eventId": "1768649776204-rijf79po",
        "ts": {
          "$date": "2026-01-17T11:36:16.204Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": false,
            "hasToken": true,
            "phaseInBody": "completed",
            "hasFinalPayload": true,
            "keys": [
              "phase",
              "message",
              "data"
            ],
            "dataKeys": [
              "extracted_text",
              "metadata"
            ],
            "dataSample": {
              "hasExtractedText": true,
              "hasMistralOcrRaw": false,
              "hasMistralOcrRawUrl": false,
              "hasMistralOcrRawMetadata": false,
              "hasPagesArchiveUrl": false,
              "hasPagesArchiveData": false,
              "hasImagesArchiveUrl": false,
              "hasImagesArchiveData": false
            }
          }
        }
      },
      {
        "eventId": "1768649776428-ifhseupg",
        "ts": {
          "$date": "2026-01-17T11:36:16.428Z"
        },
        "spanId": "template",
        "name": "callback_before_library",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768649776987-fyotcowr",
        "ts": {
          "$date": "2026-01-17T11:36:16.987Z"
        },
        "spanId": "extract",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "extract_pdf"
        }
      },
      {
        "eventId": "1768649782497-1j0gmtyi",
        "ts": {
          "$date": "2026-01-17T11:36:22.497Z"
        },
        "spanId": "extract",
        "name": "extract_transcript_saved",
        "level": "info",
        "message": null,
        "attributes": {
          "artifactKind": "transcript",
          "targetLanguage": "en",
          "templateName": null,
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "location": "dotFolder",
          "wasUpdated": false,
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZi9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIuZW4ubWQ=",
          "fileName": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md",
          "contentLength": 8179,
          "path": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/Bürgerrat/.Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf/Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md"
        }
      },
      {
        "eventId": "1768649785848-mnhvab11",
        "ts": {
          "$date": "2026-01-17T11:36:25.848Z"
        },
        "spanId": "image_extraction",
        "name": "image_extraction_start",
        "level": "info",
        "message": null,
        "attributes": {
          "hasPagesArchiveData": false,
          "hasPagesArchiveUrl": false,
          "hasImagesArchiveData": false,
          "hasImagesArchiveUrl": false,
          "hasMistralOcrImages": false,
          "hasMistralOcrImagesUrl": false,
          "mistralOcrRawType": "undefined"
        }
      },
      {
        "eventId": "1768649788776-5p379bjy",
        "ts": {
          "$date": "2026-01-17T11:36:28.776Z"
        },
        "spanId": "template",
        "name": "template_check_chapters_before",
        "level": "info",
        "message": null,
        "attributes": {
          "targetParentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "uniqueName": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md",
          "existingChaptersCheck": false,
          "hasChaptersInBody": false,
          "hasChaptersBeforeDecision": false,
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZi9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIuZW4ubWQ="
        }
      },
      {
        "eventId": "1768649790208-4n50ms15",
        "ts": {
          "$date": "2026-01-17T11:36:30.208Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": "run",
        "attributes": {
          "phase": "template_decision",
          "message": "run",
          "details": {
            "policy": "do",
            "bodyPhase": "completed",
            "isFrontmatterCompleteFromBody": false,
            "gateExists": false,
            "gateReason": null,
            "needsRepair": false,
            "reason": "policy_default"
          }
        }
      },
      {
        "eventId": "1768649790297-9nkzl4wq",
        "ts": {
          "$date": "2026-01-17T11:36:30.297Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": null,
        "attributes": {
          "decision": "run",
          "policy": "do",
          "gate": false,
          "gateReason": null,
          "bodyPhase": "completed",
          "fmComplete": false,
          "needsRepair": false,
          "reason": "policy_default"
        }
      },
      {
        "eventId": "1768649790460-2ohuqojl",
        "ts": {
          "$date": "2026-01-17T11:36:30.460Z"
        },
        "spanId": "template",
        "name": "template_step_start",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768649790726-1y20bii0",
        "ts": {
          "$date": "2026-01-17T11:36:30.726Z"
        },
        "spanId": "template",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      },
      {
        "eventId": "1768649790939-tmasyy26",
        "ts": {
          "$date": "2026-01-17T11:36:30.939Z"
        },
        "spanId": "template",
        "name": "template_selected",
        "level": "info",
        "message": null,
        "attributes": {
          "preferred": "pdfanalyse",
          "picked": true,
          "templateName": "pdfanalyse",
          "isPreferred": true
        }
      },
      {
        "eventId": "1768649791281-juau6fec",
        "ts": {
          "$date": "2026-01-17T11:36:31.281Z"
        },
        "spanId": "template",
        "name": "template_request_start",
        "level": "info",
        "message": null,
        "attributes": {
          "url": "http://127.0.0.1:5001/api/transformer/template",
          "method": "POST",
          "targetLanguage": "en",
          "templateContentLen": 9403,
          "extractedTextLen": 8179,
          "estimatedContentLength": 19641
        }
      },
      {
        "eventId": "1768649802454-ant2hi6d",
        "ts": {
          "$date": "2026-01-17T11:36:42.454Z"
        },
        "spanId": "template",
        "name": "template_step_after_transform",
        "level": "info",
        "message": null,
        "attributes": {
          "hasMeta": true
        }
      },
      {
        "eventId": "1768649803336-ais6oinv",
        "ts": {
          "$date": "2026-01-17T11:36:43.336Z"
        },
        "spanId": "template",
        "name": "chapters_analyze_skipped",
        "level": "info",
        "message": null,
        "attributes": {
          "reason": "chapters_already_exist",
          "existingChaptersCount": 5,
          "source": "metadataFromTemplate"
        }
      },
      {
        "eventId": "1768649804732-ozxjtv8z",
        "ts": {
          "$date": "2026-01-17T11:36:44.732Z"
        },
        "spanId": "postprocessing",
        "name": "postprocessing_save",
        "level": "info",
        "message": null,
        "attributes": {
          "name": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "shadowTwinFolderId": null,
          "artifactKind": "transformation",
          "targetLanguage": "en",
          "templateName": "pdfanalyse"
        }
      },
      {
        "eventId": "1768649804816-tfbuc1a9",
        "ts": {
          "$date": "2026-01-17T11:36:44.816Z"
        },
        "spanId": "postprocessing",
        "name": "stored_local",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZi9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRmYW5hbHlzZS5lbi5tZA==",
          "name": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "shadowTwinFolderId": null
        }
      },
      {
        "eventId": "1768649805292-fixrcl4n",
        "ts": {
          "$date": "2026-01-17T11:36:45.292Z"
        },
        "spanId": "postprocessing",
        "name": "stored_path",
        "level": "info",
        "message": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/Bürgerrat/.Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf/Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md",
        "attributes": {
          "path": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/Bürgerrat/.Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf/Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "shadowTwinFolderId": null
        }
      },
      {
        "eventId": "1768649805450-aofj2s58",
        "ts": {
          "$date": "2026-01-17T11:36:45.450Z"
        },
        "spanId": "template",
        "name": "postprocessing_saved",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZi9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRmYW5hbHlzZS5lbi5tZA==",
          "fileName": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md",
          "targetParentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZg==",
          "markdownLength": 6210,
          "hasFrontmatter": true
        }
      },
      {
        "eventId": "1768649805888-5hs599el",
        "ts": {
          "$date": "2026-01-17T11:36:45.888Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template",
          "source": "primary"
        }
      },
      {
        "eventId": "1768649806050-mmwqxp28",
        "ts": {
          "$date": "2026-01-17T11:36:46.050Z"
        },
        "spanId": "template",
        "name": "template_step_completed",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768649806291-rzpz96rv",
        "ts": {
          "$date": "2026-01-17T11:36:46.291Z"
        },
        "spanId": "ingest",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "ingest_rag"
        }
      },
      {
        "eventId": "1768649806369-t52x2i73",
        "ts": {
          "$date": "2026-01-17T11:36:46.369Z"
        },
        "spanId": "ingest",
        "name": "ingest_start",
        "level": "info",
        "message": null,
        "attributes": {
          "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a"
        }
      },
      {
        "eventId": "1768649806582-m1kuwwge",
        "ts": {
          "$date": "2026-01-17T11:36:46.582Z"
        },
        "spanId": "ingest",
        "name": "ingest_decision",
        "level": "info",
        "message": null,
        "attributes": {
          "useIngestion": true,
          "policiesIngest": "do",
          "ingestGateExists": false
        }
      },
      {
        "eventId": "1768649835324-9my7zggc",
        "ts": {
          "$date": "2026-01-17T11:37:15.324Z"
        },
        "spanId": "ingest",
        "name": "meta_doc_upsert_done",
        "level": "info",
        "message": null,
        "attributes": {
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRm",
          "chunks": 15,
          "chapters": 5,
          "hasEmbedding": true
        }
      },
      {
        "eventId": "1768649835811-cyykowmn",
        "ts": {
          "$date": "2026-01-17T11:37:15.811Z"
        },
        "spanId": "ingest",
        "name": "ingest_mongodb_upserted",
        "level": "info",
        "message": null,
        "attributes": {
          "chunks": 15,
          "doc": true,
          "total": 16,
          "vectorFileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRm"
        }
      },
      {
        "eventId": "1768649835891-lfi1fbpi",
        "ts": {
          "$date": "2026-01-17T11:37:15.891Z"
        },
        "spanId": "ingest",
        "name": "ingest_doc_id",
        "level": "info",
        "message": null,
        "attributes": {
          "vectorFileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRm",
          "fileName": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md"
        }
      },
      {
        "eventId": "1768649836458-mp2cr7nz",
        "ts": {
          "$date": "2026-01-17T11:37:16.458Z"
        },
        "spanId": "ingest",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "ingest_rag"
        }
      },
      {
        "eventId": "1768649837818-1j4jku3k",
        "ts": {
          "$date": "2026-01-17T11:37:17.818Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      }
    ],
    "spans": [
      {
        "spanId": "job",
        "name": "job",
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:34:30.851Z"
        },
        "endedAt": {
          "$date": "2026-01-17T11:37:18.931Z"
        }
      },
      {
        "spanId": "preprocess",
        "parentSpanId": "job",
        "name": "preprocess",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:34:36.575Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T11:34:37.054Z"
        }
      },
      {
        "spanId": "extract",
        "parentSpanId": "job",
        "name": "extract_pdf",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:34:38.430Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T11:36:16.871Z"
        }
      },
      {
        "spanId": "image_extraction",
        "parentSpanId": "job",
        "name": "image_extraction",
        "phase": null,
        "status": "skipped",
        "startedAt": {
          "$date": "2026-01-17T11:36:25.731Z"
        },
        "attributes": {
          "totalImages": 0
        },
        "endedAt": {
          "$date": "2026-01-17T11:36:25.978Z"
        }
      },
      {
        "spanId": "template",
        "parentSpanId": "job",
        "name": "transform_template",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:36:30.630Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T11:36:45.806Z"
        }
      },
      {
        "spanId": "postprocessing",
        "parentSpanId": "job",
        "name": "postprocessing",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:36:43.843Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T11:36:45.373Z"
        }
      },
      {
        "spanId": "ingest",
        "parentSpanId": "job",
        "name": "ingest_rag",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-17T11:36:46.210Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-17T11:37:16.051Z"
        }
      }
    ],
    "currentSpanId": "template"
  },
  "shadowTwinState": {
    "baseItem": {
      "id": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRm",
      "metadata": {
        "name": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf"
      }
    },
    "transformed": null,
    "transcriptFiles": null,
    "shadowTwinFolderId": null,
    "mediaFiles": null,
    "analysisTimestamp": 1768649670902,
    "analysisError": null,
    "processingStatus": "ready"
  },
  "processId": "job-e7fd4e82-1938-4564-866b-3afc302959e0",
  "metaHistory": [
    {
      "at": {
        "$date": "2026-01-17T11:36:31.076Z"
      },
      "meta": {
        "template_used": "pdfanalyse"
      },
      "source": "template_pick"
    },
    {
      "at": {
        "$date": "2026-01-17T11:36:45.531Z"
      },
      "meta": {
        "title": "Vorschläge des Klimabürgerrats mit der Bewertung: Proposte del Consiglio dei cittadini per il Clima con la valutazione",
        "shortTitle": "Vorschläge des Klimabürgerrats",
        "slug": "vorschlaege-des-klimabuergerrats-mit-der-bewertung",
        "summary": "Dieses Dokument enthält eine tabellarische Auflistung von Maßnahmenvorschlägen des Klimabürgerrats (KBR) für Südtirol, die von der Landesverwaltung als „Vorschlag/Zuordnung unklar“ bewertet wurden. Die Vorschläge umfassen verschiedene Handlungsfelder wie Personenverkehr, Heizen, Landwirtschaft und Forstwirtschaft, Biomasse sowie unterstützende Leistungen. Zu jedem Vorschlag werden die zuständigen Ressorts der Landesverwaltung, die spezifische Maßnahme der jeweiligen Arbeitsgruppe (z. B. Mobilität, Energie, Ernährung & Landnutzung) und die entsprechende Rückmeldung der Verwaltung aufgeführt. Zentrale Themen sind die Begrenzung des Straßenbaus, die energetische Sanierung von Kondominien, die Regulierung von Gülleimporten, die Nutzung von Agrarflächen für Biogas sowie der Ausbau neutraler Bürgerberatung für Energieeinsparungen.",
        "teaser": "Eine Zusammenstellung von Klimaschutz-Maßnahmen des Bürgerrats mit den entsprechenden Bewertungen der Südtiroler Landesverwaltung. Der Fokus liegt auf Vorschlägen mit unklarer Zuordnung in den Bereichen Mobilität, Energie und Landwirtschaft.",
        "authors": [
          "Klimabürgerrat"
        ],
        "tags": [
          "personenverkehr",
          "heizen",
          "landwirtschaft",
          "forstwirtschaft",
          "biomasse",
          "zertifizierungssysteme",
          "strassenbau",
          "guelle",
          "biogas",
          "buergerberatung"
        ],
        "topics": [
          "klima",
          "gesellschaft",
          "energie",
          "landwirtschaft",
          "forstwirtschaft"
        ],
        "docType": "report",
        "year": 2025,
        "region": "Südtirol",
        "language": "de/it",
        "pages": 8,
        "source": "Landesverwaltung Südtirol",
        "seriesOrJournal": "",
        "issue": "Stand 14.08.2025",
        "protection": "public",
        "project": "Klimabürgerrat",
        "filename": "",
        "path": "",
        "pathHints": [],
        "isScan": false,
        "acronyms_resolved": [
          "KBR: Klimabürgerrat",
          "AG: Arbeitsgruppe",
          "GL: Gruppo di lavoro"
        ],
        "chapters": [
          {
            "title": "Personenverkehr (Nr. 130)",
            "level": 1,
            "order": 1,
            "startPage": 2,
            "endPage": 2,
            "pageCount": 1,
            "startEvidence": "Nr. 130 Handlungsfeld Personenverkehr. Vorschlag Maßnahme AG Mobilität KBR: Es soll keine Erhöhung der Verkehrskapazität geben",
            "summary": "Vorschlag zur Zurückhaltung beim Straßenbau, um die Verkehrskapazität nicht zu erhöhen. Die Landesverwaltung entgegnet, dass Straßenbau primär dem Bestandserhalt, der Entlastung von Orten und der Sicherheit dient.",
            "keywords": [
              "personenverkehr",
              "verkehrskapazität",
              "straßenbau",
              "verkehrssicherheit",
              "mobilität"
            ]
          },
          {
            "title": "Heizen (Nr. 191)",
            "level": 1,
            "order": 2,
            "startPage": 3,
            "endPage": 3,
            "pageCount": 1,
            "startEvidence": "Nr. 191 Handlungsfeld Heizen. Vorschlag Maßnahme AG Energie KBR: Es soll auf Maßnahmen mit dem größten Hebel gesetzt werden z. B. alte Kondominien sanieren.",
            "summary": "Fokus auf Sanierung alter Gebäude als Hebelwirkung. Die Verwaltung sieht darin eher eine Feststellung als einen konkreten Vorschlag und hat keine Zuweisung vorgenommen.",
            "keywords": [
              "heizen",
              "sanierung",
              "kondominien",
              "energie",
              "hebelwirkung"
            ]
          },
          {
            "title": "Landwirtschaft und Forstwirtschaft (Nr. 206 & 228)",
            "level": 1,
            "order": 3,
            "startPage": 4,
            "endPage": 5,
            "pageCount": 2,
            "startEvidence": "Nr. 206 Handlungsfeld Landwirtschaft und Forstwirtschaft. Vorschlag Maßnahme AG Ernährung & Landnutzung KBR: Es soll lokale Gülle verwendet werden",
            "summary": "Behandelt den Stopp von Gülleimporten und den Verzicht auf Biogas-Pflanzenanbau sowie die Forderung nach vollständigen Informationen über Klimaauswirkungen. Die Verwaltung weist die Darstellungen teils als unzutreffend oder zu wenig spezifisch zurück.",
            "keywords": [
              "gülle",
              "biogas",
              "landwirtschaft",
              "fehlinformation",
              "ernährung"
            ]
          },
          {
            "title": "Biomasse und Beratung (Nr. 282 & 288)",
            "level": 1,
            "order": 4,
            "startPage": 6,
            "endPage": 7,
            "pageCount": 2,
            "startEvidence": "Nr. 282 Handlungsfeld Biomasse. Vorschlag Maßnahme AG Energie KBR: Um Einsparungen zu verstärken, sollen Bürgerberatung für eigenes Verbrauchs- und Einsparungsmonitoring",
            "summary": "Vorschläge zur Schaffung neutraler, professioneller und nicht gewinnorientierter Bürgerberatung für das Monitoring von Energieverbrauch und Einsparungen.",
            "keywords": [
              "biomasse",
              "bürgerberatung",
              "monitoring",
              "energieeinsparung",
              "verbrauch"
            ]
          },
          {
            "title": "Unterstützende Leistungen und Zertifizierung (Nr. 333)",
            "level": 1,
            "order": 5,
            "startPage": 8,
            "endPage": 8,
            "pageCount": 1,
            "startEvidence": "Nr. 333 Handlungsfeld Unterstützende Leistungen, Planung und Zertifizierun. Vorschlag Maßnahme AG Konsum & Produktion KBR: Die Zertifizierungssysteme müssen angepasst werden",
            "summary": "Forderung nach Anpassung von Zertifizierungssystemen an Betriebsgrößen (Unterscheidung Bauernhof vs. Luxushotel). Die Verwaltung bewertet den Vorschlag als unklar.",
            "keywords": [
              "zertifizierung",
              "betriebsgröße",
              "bauernhöfe",
              "tourismus",
              "konsum"
            ]
          }
        ],
        "provenance": {
          "title": "doc.heading",
          "authors": "doc.meta",
          "year": "doc.meta",
          "topics": "doc.meta",
          "source": "doc.meta",
          "pages": "doc.meta"
        },
        "confidence": {
          "title": 0.95,
          "authors": 0.95,
          "year": 0.95,
          "topics": 0.95,
          "source": 0.85,
          "pages": 0.95
        },
        "job_id": "bd65f017-ed19-4c28-93fe-55beb21a8dea",
        "source_file": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf",
        "extract_status": "completed",
        "template_status": "completed",
        "template": "pdfanalyse",
        "summary_language": "en"
      },
      "source": "template_transform"
    }
  ],
  "cumulativeMeta": {
    "template_used": "pdfanalyse",
    "title": "Vorschläge des Klimabürgerrats mit der Bewertung: Proposte del Consiglio dei cittadini per il Clima con la valutazione",
    "shortTitle": "Vorschläge des Klimabürgerrats",
    "slug": "vorschlaege-des-klimabuergerrats-mit-der-bewertung",
    "summary": "Dieses Dokument enthält eine tabellarische Auflistung von Maßnahmenvorschlägen des Klimabürgerrats (KBR) für Südtirol, die von der Landesverwaltung als „Vorschlag/Zuordnung unklar“ bewertet wurden. Die Vorschläge umfassen verschiedene Handlungsfelder wie Personenverkehr, Heizen, Landwirtschaft und Forstwirtschaft, Biomasse sowie unterstützende Leistungen. Zu jedem Vorschlag werden die zuständigen Ressorts der Landesverwaltung, die spezifische Maßnahme der jeweiligen Arbeitsgruppe (z. B. Mobilität, Energie, Ernährung & Landnutzung) und die entsprechende Rückmeldung der Verwaltung aufgeführt. Zentrale Themen sind die Begrenzung des Straßenbaus, die energetische Sanierung von Kondominien, die Regulierung von Gülleimporten, die Nutzung von Agrarflächen für Biogas sowie der Ausbau neutraler Bürgerberatung für Energieeinsparungen.",
    "teaser": "Eine Zusammenstellung von Klimaschutz-Maßnahmen des Bürgerrats mit den entsprechenden Bewertungen der Südtiroler Landesverwaltung. Der Fokus liegt auf Vorschlägen mit unklarer Zuordnung in den Bereichen Mobilität, Energie und Landwirtschaft.",
    "authors": [
      "Klimabürgerrat"
    ],
    "tags": [
      "personenverkehr",
      "heizen",
      "landwirtschaft",
      "forstwirtschaft",
      "biomasse",
      "zertifizierungssysteme",
      "strassenbau",
      "guelle",
      "biogas",
      "buergerberatung"
    ],
    "topics": [
      "klima",
      "gesellschaft",
      "energie",
      "landwirtschaft",
      "forstwirtschaft"
    ],
    "docType": "report",
    "year": 2025,
    "region": "Südtirol",
    "language": "de/it",
    "pages": 8,
    "source": "Landesverwaltung Südtirol",
    "seriesOrJournal": "",
    "issue": "Stand 14.08.2025",
    "protection": "public",
    "project": "Klimabürgerrat",
    "filename": "",
    "path": "",
    "pathHints": [],
    "isScan": false,
    "acronyms_resolved": [
      "KBR: Klimabürgerrat",
      "AG: Arbeitsgruppe",
      "GL: Gruppo di lavoro"
    ],
    "chapters": [
      {
        "title": "Personenverkehr (Nr. 130)",
        "level": 1,
        "order": 1,
        "startPage": 2,
        "endPage": 2,
        "pageCount": 1,
        "startEvidence": "Nr. 130 Handlungsfeld Personenverkehr. Vorschlag Maßnahme AG Mobilität KBR: Es soll keine Erhöhung der Verkehrskapazität geben",
        "summary": "Vorschlag zur Zurückhaltung beim Straßenbau, um die Verkehrskapazität nicht zu erhöhen. Die Landesverwaltung entgegnet, dass Straßenbau primär dem Bestandserhalt, der Entlastung von Orten und der Sicherheit dient.",
        "keywords": [
          "personenverkehr",
          "verkehrskapazität",
          "straßenbau",
          "verkehrssicherheit",
          "mobilität"
        ]
      },
      {
        "title": "Heizen (Nr. 191)",
        "level": 1,
        "order": 2,
        "startPage": 3,
        "endPage": 3,
        "pageCount": 1,
        "startEvidence": "Nr. 191 Handlungsfeld Heizen. Vorschlag Maßnahme AG Energie KBR: Es soll auf Maßnahmen mit dem größten Hebel gesetzt werden z. B. alte Kondominien sanieren.",
        "summary": "Fokus auf Sanierung alter Gebäude als Hebelwirkung. Die Verwaltung sieht darin eher eine Feststellung als einen konkreten Vorschlag und hat keine Zuweisung vorgenommen.",
        "keywords": [
          "heizen",
          "sanierung",
          "kondominien",
          "energie",
          "hebelwirkung"
        ]
      },
      {
        "title": "Landwirtschaft und Forstwirtschaft (Nr. 206 & 228)",
        "level": 1,
        "order": 3,
        "startPage": 4,
        "endPage": 5,
        "pageCount": 2,
        "startEvidence": "Nr. 206 Handlungsfeld Landwirtschaft und Forstwirtschaft. Vorschlag Maßnahme AG Ernährung & Landnutzung KBR: Es soll lokale Gülle verwendet werden",
        "summary": "Behandelt den Stopp von Gülleimporten und den Verzicht auf Biogas-Pflanzenanbau sowie die Forderung nach vollständigen Informationen über Klimaauswirkungen. Die Verwaltung weist die Darstellungen teils als unzutreffend oder zu wenig spezifisch zurück.",
        "keywords": [
          "gülle",
          "biogas",
          "landwirtschaft",
          "fehlinformation",
          "ernährung"
        ]
      },
      {
        "title": "Biomasse und Beratung (Nr. 282 & 288)",
        "level": 1,
        "order": 4,
        "startPage": 6,
        "endPage": 7,
        "pageCount": 2,
        "startEvidence": "Nr. 282 Handlungsfeld Biomasse. Vorschlag Maßnahme AG Energie KBR: Um Einsparungen zu verstärken, sollen Bürgerberatung für eigenes Verbrauchs- und Einsparungsmonitoring",
        "summary": "Vorschläge zur Schaffung neutraler, professioneller und nicht gewinnorientierter Bürgerberatung für das Monitoring von Energieverbrauch und Einsparungen.",
        "keywords": [
          "biomasse",
          "bürgerberatung",
          "monitoring",
          "energieeinsparung",
          "verbrauch"
        ]
      },
      {
        "title": "Unterstützende Leistungen und Zertifizierung (Nr. 333)",
        "level": 1,
        "order": 5,
        "startPage": 8,
        "endPage": 8,
        "pageCount": 1,
        "startEvidence": "Nr. 333 Handlungsfeld Unterstützende Leistungen, Planung und Zertifizierun. Vorschlag Maßnahme AG Konsum & Produktion KBR: Die Zertifizierungssysteme müssen angepasst werden",
        "summary": "Forderung nach Anpassung von Zertifizierungssystemen an Betriebsgrößen (Unterscheidung Bauernhof vs. Luxushotel). Die Verwaltung bewertet den Vorschlag als unklar.",
        "keywords": [
          "zertifizierung",
          "betriebsgröße",
          "bauernhöfe",
          "tourismus",
          "konsum"
        ]
      }
    ],
    "provenance": {
      "title": "doc.heading",
      "authors": "doc.meta",
      "year": "doc.meta",
      "topics": "doc.meta",
      "source": "doc.meta",
      "pages": "doc.meta"
    },
    "confidence": {
      "title": 0.95,
      "authors": 0.95,
      "year": 0.95,
      "topics": 0.95,
      "source": 0.85,
      "pages": 0.95
    },
    "job_id": "bd65f017-ed19-4c28-93fe-55beb21a8dea",
    "source_file": "Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf",
    "extract_status": "completed",
    "template_status": "completed",
    "template": "pdfanalyse",
    "summary_language": "en"
  },
  "ingestion": {
    "upsertAt": {
      "$date": "2026-01-17T11:37:15.358Z"
    },
    "vectorsUpserted": 16,
    "index": "doc_meta__ff73d3a2-fe01-4674-bce1-feb708235a5a"
  },
  "payload": {},
  "result": {
    "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvQsO8cmdlcnJhdC8uVm9yc2NobGFlZ2VfS0JSX1ZPUlNDSExBRy1aVU9SRE5VTkctVU5LTEFSLnBkZi9Wb3JzY2hsYWVnZV9LQlJfVk9SU0NITEFHLVpVT1JETlVORy1VTktMQVIucGRmYW5hbHlzZS5lbi5tZA=="
  }
}

Man kann im Code in normalen MistralOCR konfigurieren, aber nicht includePageImages. Das muss defaultmässig immer gesetzt sein.

den Modus Mistrial OCR als Default setzen eine Library. Also wenn nichts ausgewählt ist, dann muss immer das als ausgeführt werden auf dem PDF.

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Prüfe die relevanten Dateien, um die aktuelle Default-Logik zu verstehen.


Erweitere `getEffectivePdfDefaults`, um den globalen Default `mistral_ocr` zu setzen, und aktualisiere alle Stellen, die aktuell `'native'` als Fallback verwenden.


Erweitere `getEffectivePdfDefaults` um den globalen Default `mistral_ocr` und aktualisiere alle Stellen, die `'native'` als Fallback verwenden.


```typescript
import { atom } from 'jotai'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

/**
 * Runtime-Overrides für PDF-Standardwerte pro Library (nicht persistent).
 * Lebensdauer: bis zum Reload. Vorrang vor DB-Defaults in der UI.
 */
export type PdfRuntimeOverrides = Partial<PdfTransformOptions>;

// Map: libraryId -> Overrides
export const pdfOverridesAtom = atom<Record<string, PdfRuntimeOverrides>>({})

/**
 * Globaler Default für extractionMethod: mistral_ocr (wenn nichts gesetzt ist).
 * WICHTIG: Dieser Default gilt für alle PDF-Flows, wenn keine explizite Auswahl getroffen wurde.
 */
const GLOBAL_DEFAULT_EXTRACTION_METHOD: PdfTransformOptions['extractionMethod'] = 'mistral_ocr'

/**
 * Erzwingt Mistral-spezifische Defaults für Bild-Extraktion.
 * Wenn extractionMethod === 'mistral_ocr', dann sind includePageImages und includeOcrImages standardmäßig true.
 */
function applyMistralDefaults(options: Partial<PdfTransformOptions>): Partial<PdfTransformOptions> {
  const extractionMethod = options.extractionMethod || GLOBAL_DEFAULT_EXTRACTION_METHOD
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  return {
    ...options,
    extractionMethod,
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    includePageImages: isMistralOcr 
      ? (options.includePageImages !== undefined ? options.includePageImages : true)
      : options.includePageImages,
    // Bei Mistral OCR: includeOcrImages standardmäßig true (kann überschrieben werden)
    includeOcrImages: isMistralOcr
      ? (options.includeOcrImages !== undefined ? options.includeOcrImages : true)
      : options.includeOcrImages,
  }
}

export function getEffectivePdfDefaults(
  libraryId: string | undefined,
  dbDefaults: Partial<PdfTransformOptions> | undefined,
  overridesMap: Record<string, PdfRuntimeOverrides>
): Partial<PdfTransformOptions> {
  if (!libraryId) {
    const merged = { ...(dbDefaults || {}) }
    return applyMistralDefaults(merged)
  }
  const ov = overridesMap[libraryId] || {}
  const merged = { ...(dbDefaults || {}), ...ov }
  return applyMistralDefaults(merged)
}



```

Aktualisiere alle Stellen, die `'native'` als Fallback verwenden:


```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Aktualisiere `flow-actions.tsx`, um die Defaults zu verwenden:


Aktualisiere die API-Routes zuerst, da sie die Defaults zentral anwenden können:


```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { legacyToPolicies } from '@/lib/processing/phase-policy';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeOcrImages?: boolean; // Mistral OCR Bilder als Base64
    includePageImages?: boolean; // Seiten-Bilder als ZIP
    includeImages?: boolean; // Rückwärtskompatibilität
    useCache?: boolean;
    template?: string;
    policies?: import('@/lib/processing/phase-policy').PhasePolicies;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = options?.extractionMethod || 'mistral_ocr';
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = options?.includePageImages !== undefined
      ? options.includePageImages
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeOcrImages = options?.includeOcrImages !== undefined
      ? options.includeOcrImages
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    
    // Diagnose: Eingehende Policies loggen (einmal pro Batch)
    FileLogger.info('process-pdf-batch', 'Incoming batch options', { 
      libraryId, 
      batchName, 
      policiesIn: options?.policies,
      extractionMethod,
      includeOcrImages,
      includePageImages,
      isMistralOcr
    });
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Eindeutige Batch-ID generieren
    const batchId = crypto.randomUUID();

    // Phase 1: Alle Jobs minimal in DB anlegen (ohne PDFs zu laden)
    const repo = new ExternalJobsRepository();
    const createdJobIds: string[] = [];
    for (const it of items) {
      try {
        const jobId = crypto.randomUUID();
        const jobSecret = crypto.randomBytes(24).toString('base64url');
        const jobSecretHash = repo.hashSecret(jobSecret);
        const policiesEffective = options?.policies || legacyToPolicies({ doExtractPDF: true });
        // Leite phases aus policies ab (wie in process-pdf/route.ts Zeile 129)
        // WICHTIG: Dies stellt sicher, dass beide Workflows (manuell vs. Batch) konsistent sind
        const phases = { 
          extract: policiesEffective.extract !== 'ignore', 
          template: policiesEffective.metadata !== 'ignore', 
          ingest: policiesEffective.ingest !== 'ignore' 
        };
        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'pdf',
          operation: 'extract',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'pdf', mimeType: it.mimeType || 'application/pdf', name: it.name || 'document.pdf', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options?.targetLanguage || 'de',
              extractionMethod: extractionMethod,
              includeOcrImages: includeOcrImages,
              includePageImages: includePageImages,
              includeImages: options?.includeImages ?? false, // Rückwärtskompatibilität
              useCache: options?.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            targetLanguage: options?.targetLanguage || 'de',
            extractionMethod: extractionMethod,
            includeOcrImages: includeOcrImages,
            includePageImages: includePageImages,
            includeImages: options?.includeImages ?? false, // Rückwärtskompatibilität
            useCache: options?.useCache ?? true,
            template: options?.template,
            // Leite phases aus policies ab (konsistent mit process-pdf/route.ts)
            phases,
            // Nur neue Policies
            policies: policiesEffective,
            batchId,
            batchName,
          }
        } as unknown as Parameters<ExternalJobsRepository['create']>[0]);
        // Diagnose: Übernommene Policies protokollieren
        await repo.appendLog(jobId, { phase: 'batch_job_created', details: { policies: policiesEffective } } as unknown as Record<string, unknown>);
        createdJobIds.push(jobId);
      } catch (e) {
        FileLogger.error('process-pdf-batch', 'Job-Anlage fehlgeschlagen', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Phase 2 entfällt: Der zentrale Worker claimt und startet die Jobs.
    FileLogger.info('process-pdf-batch', 'Jobs enqueued; Worker übernimmt Start', { count: createdJobIds.length, batchId, batchName });

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
/**
 * @fileoverview Secretary PDF Processing API Route - PDF Transformation Endpoint
 * 
 * @description
 * API endpoint for processing PDF files via Secretary Service. Creates external jobs
 * for PDF extraction, handles authentication, job creation, and triggers Secretary
 * Service processing. Supports batch processing, policy configuration, and callback
 * URL setup.
 * 
 * @module secretary
 * 
 * @exports
 * - POST: Creates PDF processing job and triggers Secretary Service
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/secretary/process-pdf
 * - src/components/library: Library components call this endpoint
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository for job creation
 * - @/lib/secretary/client: Secretary Service client
 * - @/lib/processing/phase-policy: Policy configuration
 * - @/lib/events/job-event-bus: Event bus for status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import type { ExternalJob } from '@/types/external-job';
import { legacyToPolicies, type PhasePolicies } from '@/lib/processing/phase-policy';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const formData = await request.formData();

    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = (formData.get('extractionMethod') as string) || 'mistral_ocr';
    
    // Neue Parameter-Namen für Mistral OCR:
    // - includeOcrImages: Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
    // - includePageImages: Seiten-Bilder als ZIP (parallel extrahiert)
    // Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeOcrImagesRaw = formData.get('includeOcrImages') as string | null;
    const includePageImagesRaw = formData.get('includePageImages') as string | null;
    const includeImagesRaw = formData.get('includeImages') as string | null; // Rückwärtskompatibilität
    
    // Für Mistral OCR: Beide Parameter standardmäßig true, wenn nicht explizit gesetzt
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImages = includeOcrImagesRaw !== null 
      ? includeOcrImagesRaw === 'true'
      : (isMistralOcr ? true : (includeImagesRaw === 'true')); // Standard: true für Mistral OCR, sonst aus includeImages
    const includePageImages = includePageImagesRaw !== null
      ? includePageImagesRaw === 'true'
      : (isMistralOcr ? true : false); // Standard: true für Mistral OCR
    
    // Für Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeImages = includeImagesRaw !== null ? includeImagesRaw === 'true' : false;
    
    const useCache = (formData.get('useCache') as string) ?? 'true';

    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? (JSON.parse(raw) as PhasePolicies) : undefined;
      } catch {
        return undefined;
      }
    })();
    const policies = policiesFromClient || legacyToPolicies({ doExtractPDF: true });

    const repo = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repo.hashSecret(jobSecret);

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';

    const file = formData.get('file') as File | null;
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    // Upload-free Job Creation (Wizard/Storage-first):
    // Wenn kein `file` im Request enthalten ist, akzeptieren wir Name/MimeType separat,
    // damit das Job-UI & Tracing sinnvolle Werte hat. Die Binärdaten werden dann vom Worker
    // über `originalItemId` aus dem Storage geladen.
    const fileNameFromForm = (formData.get('fileName') as string) || undefined;
    const mimeTypeFromForm = (formData.get('mimeType') as string) || undefined;

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || mimeTypeFromForm || 'application/pdf',
        name: file?.name || fileNameFromForm,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeOcrImages, // Mistral OCR Bilder als Base64
        includePageImages, // Seiten-Bilder als ZIP
        includeImages: includeImages, // Rückwärtskompatibilität für Standard-Endpoint
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    };

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.create(job);

    const phases = { extract: policies.extract !== 'ignore', template: policies.metadata !== 'ignore', ingest: policies.ingest !== 'ignore' };
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeOcrImages,
      includePageImages,
      includeImages, // Rückwärtskompatibilität
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      policies,
    });

    // Trace initialisieren und Eingangsparameter protokollieren
    try {
      await repo.initializeTrace(jobId);
      await repo.traceAddEvent(jobId, {
        name: 'process_pdf_submit',
        attributes: {
          libraryId,
          fileName: correlation.source?.name,
          extractionMethod,
          targetLanguage,
          includeOcrImages,
          includePageImages,
          includeImages, // Rückwärtskompatibilität
          useCache: useCache === 'true',
          template: (formData.get('template') as string) || undefined,
          phases,
        }
      });
    } catch {}

    FileLogger.info('process-pdf', 'Job angelegt (queued, worker übernimmt)', { jobId, libraryId, userEmail });

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}

    await repo.appendLog(jobId, { phase: 'enqueued', message: 'Job enqueued; worker will start it' } as unknown as Record<string, unknown>);
    return NextResponse.json({ status: 'accepted', job: { id: jobId } });
            } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
} 
```

```typescript
/**
 * @fileoverview Secretary PDF Processing API Route - PDF Transformation Endpoint
 * 
 * @description
 * API endpoint for processing PDF files via Secretary Service. Creates external jobs
 * for PDF extraction, handles authentication, job creation, and triggers Secretary
 * Service processing. Supports batch processing, policy configuration, and callback
 * URL setup.
 * 
 * @module secretary
 * 
 * @exports
 * - POST: Creates PDF processing job and triggers Secretary Service
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/secretary/process-pdf
 * - src/components/library: Library components call this endpoint
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository for job creation
 * - @/lib/secretary/client: Secretary Service client
 * - @/lib/processing/phase-policy: Policy configuration
 * - @/lib/events/job-event-bus: Event bus for status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import type { ExternalJob } from '@/types/external-job';
import { legacyToPolicies, type PhasePolicies } from '@/lib/processing/phase-policy';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const formData = await request.formData();

    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = (formData.get('extractionMethod') as string) || 'mistral_ocr';
    
    // Neue Parameter-Namen für Mistral OCR:
    // - includeOcrImages: Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
    // - includePageImages: Seiten-Bilder als ZIP (parallel extrahiert)
    // Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeOcrImagesRaw = formData.get('includeOcrImages') as string | null;
    const includePageImagesRaw = formData.get('includePageImages') as string | null;
    const includeImagesRaw = formData.get('includeImages') as string | null; // Rückwärtskompatibilität
    
    // Für Mistral OCR: Beide Parameter standardmäßig true, wenn nicht explizit gesetzt
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImages = includeOcrImagesRaw !== null 
      ? includeOcrImagesRaw === 'true'
      : (isMistralOcr ? true : (includeImagesRaw === 'true')); // Standard: true für Mistral OCR, sonst aus includeImages
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = includePageImagesRaw !== null
      ? includePageImagesRaw === 'true'
      : (isMistralOcr ? true : false); // Standard: true für Mistral OCR
    
    // Für Rückwärtskompatibilität: includeImages bleibt für Standard-Endpoint
    const includeImages = includeImagesRaw !== null ? includeImagesRaw === 'true' : false;
    
    const useCache = (formData.get('useCache') as string) ?? 'true';

    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? (JSON.parse(raw) as PhasePolicies) : undefined;
      } catch {
        return undefined;
      }
    })();
    const policies = policiesFromClient || legacyToPolicies({ doExtractPDF: true });

    const repo = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repo.hashSecret(jobSecret);

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';

    const file = formData.get('file') as File | null;
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    // Upload-free Job Creation (Wizard/Storage-first):
    // Wenn kein `file` im Request enthalten ist, akzeptieren wir Name/MimeType separat,
    // damit das Job-UI & Tracing sinnvolle Werte hat. Die Binärdaten werden dann vom Worker
    // über `originalItemId` aus dem Storage geladen.
    const fileNameFromForm = (formData.get('fileName') as string) || undefined;
    const mimeTypeFromForm = (formData.get('mimeType') as string) || undefined;

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || mimeTypeFromForm || 'application/pdf',
        name: file?.name || fileNameFromForm,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeOcrImages, // Mistral OCR Bilder als Base64
        includePageImages, // Seiten-Bilder als ZIP
        includeImages: includeImages, // Rückwärtskompatibilität für Standard-Endpoint
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    };

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.create(job);

    const phases = { extract: policies.extract !== 'ignore', template: policies.metadata !== 'ignore', ingest: policies.ingest !== 'ignore' };
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeOcrImages,
      includePageImages,
      includeImages, // Rückwärtskompatibilität
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      policies,
    });

    // Trace initialisieren und Eingangsparameter protokollieren
    try {
      await repo.initializeTrace(jobId);
      await repo.traceAddEvent(jobId, {
        name: 'process_pdf_submit',
        attributes: {
          libraryId,
          fileName: correlation.source?.name,
          extractionMethod,
          targetLanguage,
          includeOcrImages,
          includePageImages,
          includeImages, // Rückwärtskompatibilität
          useCache: useCache === 'true',
          template: (formData.get('template') as string) || undefined,
          phases,
        }
      });
    } catch {}

    FileLogger.info('process-pdf', 'Job angelegt (queued, worker übernimmt)', { jobId, libraryId, userEmail });

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}

    await repo.appendLog(jobId, { phase: 'enqueued', message: 'Job enqueued; worker will start it' } as unknown as Record<string, unknown>);
    return NextResponse.json({ status: 'accepted', job: { id: jobId } });
            } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
} 
```

```typescript
/**
 * @fileoverview Secretary-Service-Request-Vorbereitung
 *
 * @description
 * Bereitet FormData und URL für Requests an den Secretary Service vor.
 * Unterstützt sowohl Mistral OCR als auch Standard PDF Process Endpoints.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { getSecretaryConfig } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'

export interface SecretaryRequestConfig {
  url: string
  formData: FormData
  headers: Record<string, string>
}

/**
 * Bereitet einen Request an den Secretary Service vor.
 *
 * @param job Job-Dokument
 * @param file PDF-Datei
 * @param callbackUrl Callback-URL für den Secretary Service
 * @param secret Callback-Token (wird in FormData eingefügt)
 * @returns Konfiguration für den Request
 */
export function prepareSecretaryRequest(
  job: ExternalJob,
  file: File,
  callbackUrl: string,
  secret: string
): SecretaryRequestConfig {
  const opts = (job.correlation?.options || {}) as Record<string, unknown>
  const { baseUrl, apiKey } = getSecretaryConfig()

  if (!apiKey) {
    throw new Error('SECRETARY_SERVICE_API_KEY fehlt')
  }

  const headers: Record<string, string> = {
    'x-worker': 'true',
    'Authorization': `Bearer ${apiKey}`,
    'X-Secretary-Api-Key': apiKey,
  }

  let url: string
  let formData: FormData

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  // --- Audio / Video (Secretary-only) ---
  if (job.job_type === 'audio') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/audio/process' : '/api/audio/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    // WICHTIG:
    // Wenn unsere Pipeline eine Template-Phase ausführt, darf Extract für Audio/Video nur das ROHE Transkript liefern.
    // Sonst liefert der Secretary schon template-transformierten Text zurück, und wir speichern diesen fälschlich als Transcript (*.de.md).
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Audio FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  if (job.job_type === 'video') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/video/process' : '/api/video/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Video FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  // --- PDF (existing) ---
  // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
  const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'

  if (extractionMethod === 'mistral_ocr') {
    // Mistral OCR Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api')
      ? '/pdf/process-mistral-ocr'
      : '/api/pdf/process-mistral-ocr'
    url = `${normalizedBaseUrl}${endpoint}`

    // Mistral OCR spezifische Parameter
    const includeOcrImages = typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true
    const includePageImages = typeof opts['includePageImages'] === 'boolean' ? opts['includePageImages'] : true
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true

    formData = new FormData()
    formData.append('file', file)
    formData.append('includeImages', String(includeOcrImages)) // Mistral OCR Bilder als Base64
    formData.append('includePageImages', String(includePageImages)) // Seiten-Bilder als ZIP
    formData.append('useCache', String(useCache))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    // Optional: page_start und page_end
    if (typeof opts['page_start'] === 'number') {
      formData.append('page_start', String(opts['page_start']))
    }
    if (typeof opts['page_end'] === 'number') {
      formData.append('page_end', String(opts['page_end']))
    }

    FileLogger.info('secretary-request', 'Mistral OCR FormData erstellt', {
      jobId: job.jobId,
      url,
      hasFile: !!file,
      fileName: file.name,
      fileSize: file.size,
      includeOcrImages: String(includeOcrImages),
      includePageImages: String(includePageImages),
      useCache: String(useCache),
      callbackUrl,
    })
  } else {
    // Standard PDF Process Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/pdf/process' : '/api/pdf/process'
    url = `${normalizedBaseUrl}${endpoint}`

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de')
    formData.append('extraction_method', extractionMethod)
    formData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
    const standardIncludeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    formData.append('includeImages', String(standardIncludeImages))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Standard PDF Process FormData erstellt', {
      jobId: job.jobId,
      url,
      extractionMethod,
      callbackUrl,
    })
  }

  return { url, formData, headers }
}






```

```typescript
/**
 * @fileoverview Secretary-Service-Request-Vorbereitung
 *
 * @description
 * Bereitet FormData und URL für Requests an den Secretary Service vor.
 * Unterstützt sowohl Mistral OCR als auch Standard PDF Process Endpoints.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { getSecretaryConfig } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'

export interface SecretaryRequestConfig {
  url: string
  formData: FormData
  headers: Record<string, string>
}

/**
 * Bereitet einen Request an den Secretary Service vor.
 *
 * @param job Job-Dokument
 * @param file PDF-Datei
 * @param callbackUrl Callback-URL für den Secretary Service
 * @param secret Callback-Token (wird in FormData eingefügt)
 * @returns Konfiguration für den Request
 */
export function prepareSecretaryRequest(
  job: ExternalJob,
  file: File,
  callbackUrl: string,
  secret: string
): SecretaryRequestConfig {
  const opts = (job.correlation?.options || {}) as Record<string, unknown>
  const { baseUrl, apiKey } = getSecretaryConfig()

  if (!apiKey) {
    throw new Error('SECRETARY_SERVICE_API_KEY fehlt')
  }

  const headers: Record<string, string> = {
    'x-worker': 'true',
    'Authorization': `Bearer ${apiKey}`,
    'X-Secretary-Api-Key': apiKey,
  }

  let url: string
  let formData: FormData

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  // --- Audio / Video (Secretary-only) ---
  if (job.job_type === 'audio') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/audio/process' : '/api/audio/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    // WICHTIG:
    // Wenn unsere Pipeline eine Template-Phase ausführt, darf Extract für Audio/Video nur das ROHE Transkript liefern.
    // Sonst liefert der Secretary schon template-transformierten Text zurück, und wir speichern diesen fälschlich als Transcript (*.de.md).
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Audio FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  if (job.job_type === 'video') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/video/process' : '/api/video/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Video FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  // --- PDF (existing) ---
  // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
  const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'

  if (extractionMethod === 'mistral_ocr') {
    // Mistral OCR Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api')
      ? '/pdf/process-mistral-ocr'
      : '/api/pdf/process-mistral-ocr'
    url = `${normalizedBaseUrl}${endpoint}`

    // Mistral OCR spezifische Parameter
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' ? opts['includePageImages'] : true
    const includeOcrImages = typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true

    formData = new FormData()
    formData.append('file', file)
    formData.append('includeImages', String(includeOcrImages)) // Mistral OCR Bilder als Base64
    formData.append('includePageImages', String(includePageImages)) // Seiten-Bilder als ZIP
    formData.append('useCache', String(useCache))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    // Optional: page_start und page_end
    if (typeof opts['page_start'] === 'number') {
      formData.append('page_start', String(opts['page_start']))
    }
    if (typeof opts['page_end'] === 'number') {
      formData.append('page_end', String(opts['page_end']))
    }

    FileLogger.info('secretary-request', 'Mistral OCR FormData erstellt', {
      jobId: job.jobId,
      url,
      hasFile: !!file,
      fileName: file.name,
      fileSize: file.size,
      includeOcrImages: String(includeOcrImages),
      includePageImages: String(includePageImages),
      useCache: String(useCache),
      callbackUrl,
    })
  } else {
    // Standard PDF Process Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/pdf/process' : '/api/pdf/process'
    url = `${normalizedBaseUrl}${endpoint}`

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de')
    formData.append('extraction_method', extractionMethod)
    formData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
    const standardIncludeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    formData.append('includeImages', String(standardIncludeImages))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Standard PDF Process FormData erstellt', {
      jobId: job.jobId,
      url,
      extractionMethod,
      callbackUrl,
    })
  }

  return { url, formData, headers }
}






```

```typescript
/**
 * @fileoverview External Jobs Start API Route - Job Execution Trigger
 * 
 * @description
 * Endpoint for starting external job execution. Handles job preprocessing, Secretary Service
 * request initiation, watchdog setup, and initial job state management. Called by the worker
 * to trigger job processing. Supports both authenticated users and internal worker requests.
 * 
 * @module external-jobs
 * 
 * @exports
 * - POST: Starts job execution and triggers Secretary Service processing
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs/[jobId]/start
 * - src/lib/external-jobs-worker.ts: Worker calls this endpoint to start jobs
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs/preprocess: Job preprocessing
 * - @/lib/external-jobs/auth: Internal authorization check
 * - @/lib/external-jobs-watchdog: Watchdog for timeout monitoring
 * - @/lib/secretary/client: Secretary Service client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getPublicAppUrl } from '@/lib/env'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { startWatchdog, bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog'
import type { RequestContext } from '@/types/external-jobs'
import { preprocessorPdfExtract } from '@/lib/external-jobs/preprocessor-pdf-extract'
import { preprocessorTransformTemplate } from '@/lib/external-jobs/preprocessor-transform-template'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { isInternalAuthorized } from '@/lib/external-jobs/auth'
import { FileLogger } from '@/lib/debug/logger'
import { checkJobStartability } from '@/lib/external-jobs/job-status-check'
import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'
import { tracePreprocessEvents } from '@/lib/external-jobs/trace-helpers'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin'
import { toMongoShadowTwinState } from '@/lib/shadow-twin/shared'
import { gateExtractPdf } from '@/lib/processing/gates'
import { getPolicies, shouldRunExtract } from '@/lib/processing/phase-policy'
import type { Library, LibraryChatConfig } from '@/types/library'
import { LibraryService } from '@/lib/services/library-service'
import { loadShadowTwinMarkdown } from '@/lib/external-jobs/phase-shadow-twin-loader'
import { runIngestPhase } from '@/lib/external-jobs/phase-ingest'
import { runTemplatePhase } from '@/lib/external-jobs/phase-template'
import { readPhasesAndPolicies } from '@/lib/external-jobs/policies'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

/**
 * Ableitung des Extract-Gates aus einem bereits berechneten ShadowTwinState.
 *
 * Ziel: doppelte Storage-Scans (findShadowTwinFolder/listItemsById) vermeiden, wenn wir die
 * Information ohnehin schon aus `analyzeShadowTwin()` haben.
 *
 * WICHTIG: Diese Ableitung deckt den häufigsten Fall ab:
 * - wenn im Shadow-Twin-Verzeichnis bereits ein Transcript oder Transformiertes Markdown existiert,
 *   dann ist Extract redundant.
 * Falls ShadowTwinState nicht aussagekräftig ist, geben wir `undefined` zurück und fallen auf
 * `gateExtractPdf()` zurück.
 */
function deriveExtractGateFromShadowTwinState(
  shadowTwinState: unknown,
  targetLanguage: string | undefined
): { exists: boolean; reason?: 'shadow_twin_exists'; details?: Record<string, unknown> } | undefined {
  try {
    if (!shadowTwinState || typeof shadowTwinState !== 'object') return undefined
    const st = shadowTwinState as {
      shadowTwinFolderId?: unknown
      transformed?: unknown
      transcriptFiles?: unknown
    }
    const folderId = typeof st.shadowTwinFolderId === 'string' ? st.shadowTwinFolderId : undefined

    const transformed = (st.transformed && typeof st.transformed === 'object')
      ? (st.transformed as { id?: unknown; metadata?: { name?: unknown } })
      : undefined
    const transformedId = typeof transformed?.id === 'string' ? transformed.id : undefined
    const transformedName = typeof transformed?.metadata?.name === 'string' ? transformed.metadata.name : undefined

    const transcriptFiles = Array.isArray(st.transcriptFiles) ? st.transcriptFiles as Array<{ id?: unknown; metadata?: { name?: unknown } }> : []
    const transcript = transcriptFiles.find(f => typeof f?.id === 'string')
    const transcriptId = typeof transcript?.id === 'string' ? transcript.id : undefined
    const transcriptName = typeof transcript?.metadata?.name === 'string' ? transcript.metadata.name : undefined

    // Ohne irgendein Markdown ist die Aussage "shadow_twin_exists" nicht belastbar
    if (!transformedId && !transcriptId) return { exists: false }

    return {
      exists: true,
      reason: 'shadow_twin_exists',
      details: {
        source: 'shadowTwinState',
        folderId: folderId || null,
        language: (targetLanguage || 'de').toLowerCase(),
        transformed: transformedId ? { id: transformedId, name: transformedName || null } : null,
        transcript: transcriptId ? { id: transcriptId, name: transcriptName || null } : null,
      },
    }
  } catch {
    return undefined
  }
}

function getExtractStepName(jobType: string): 'extract_pdf' | 'extract_audio' | 'extract_video' {
  if (jobType === 'audio') return 'extract_audio'
  if (jobType === 'video') return 'extract_video'
  return 'extract_pdf'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const repo = new ExternalJobsRepository();
  try {
    // Interner Worker darf ohne Clerk durch, wenn Token korrekt
    const internal = isInternalAuthorized(request)
    let userEmail = ''
    if (!internal.isInternal) {
      const { userId } = getAuth(request)
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 })
    let job: Awaited<ReturnType<typeof repo.get>>
    try {
      job = await repo.get(jobId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Jobs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      return NextResponse.json({ error: 'Fehler beim Laden des Jobs' }, { status: 500 })
    }
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    if (!internal.isInternal) {
      if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // WICHTIG: Watchdog SOFORT starten, damit Job nicht hängen bleibt, wenn Start-Endpoint fehlschlägt
    // Timeout: 10 Minuten (600_000 ms) - sollte ausreichen für Datei-Laden, Preprocessing, Request, etc.
    // Der Watchdog wird später via bumpWatchdog aktualisiert, wenn Callbacks vom Secretary Service kommen
    try {
      startWatchdog({ 
        jobId, 
        userEmail: job.userEmail, 
        jobType: job.job_type, 
        fileName: job.correlation?.source?.name 
      }, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Starten des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    // Duplicate-Detection (nur Logging, kein Blockieren):
    // Wir wollen doppelte /start Requests erkennen und Ursachen finden, statt hart zu blockieren.
    const startability = checkJobStartability(job)
    const startRequestId = request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || null
    const workerIdFromHeader = request.headers.get('x-worker-id') || null
    if (!startability.canStart) {
      FileLogger.warn('start-route', 'Start-Request erneut erhalten (nicht blockiert)', {
        jobId,
        reason: startability.reason || 'already_started',
        jobStatus: job.status,
        workerId: workerIdFromHeader,
        startRequestId,
        pid: process.pid,
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'job',
          name: 'start_duplicate_request',
          level: 'warn',
          attributes: {
            reason: startability.reason || 'already_started',
            jobStatus: job.status,
            workerId: workerIdFromHeader,
            startRequestId,
            pid: process.pid,
          },
        })
      } catch {}
    }
    
    // Erlaube Neustart, wenn Job fehlgeschlagen ist
    const isFailed = job.status === 'failed'
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
    if (isFailed && job.processId) {
      try {
        const col = await (await import('@/lib/mongodb-service')).getCollection<import('@/types/external-job').ExternalJob>('external_jobs')
        await col.updateOne({ jobId }, { $unset: { processId: '' }, $set: { updatedAt: new Date() } })
        FileLogger.info('start-route', 'Fehlgeschlagener Job wird neu gestartet', {
          jobId,
          oldProcessId: job.processId
        })
      } catch {}
    }

    // Secretary-Aufruf vorbereiten (aus alter Retry-Startlogik entnommen, minimal)
    let provider: Awaited<ReturnType<typeof getServerProvider>>
    try {
      provider = await getServerProvider(job.userEmail, job.libraryId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Storage-Providers', {
        jobId,
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'provider_error', message: 'Fehler beim Laden des Storage-Providers' } })
      return NextResponse.json({ error: 'Fehler beim Laden des Storage-Providers' }, { status: 500 })
    }
    
    const src = job.correlation?.source
    if (!src?.itemId || !src?.parentId) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'source_incomplete', message: 'Quelle unvollständig' } })
      return NextResponse.json({ error: 'Quelle unvollständig' }, { status: 400 })
    }

    // Request-lokales Caching für Storage-Reads aktivieren (reduziert redundante list/get/path Calls)
    provider = withRequestStorageCache(provider)
    
    FileLogger.info('start-route', 'Lade Datei aus Storage', {
      jobId,
      itemId: src.itemId,
      parentId: src.parentId,
      fileName: src.name
    });
    
    let bin: Awaited<ReturnType<typeof provider.getBinary>>
    try {
      FileLogger.info('start-route', 'Starte getBinary-Aufruf', {
        jobId,
        itemId: src.itemId,
        fileName: src.name
      })
      bin = await provider.getBinary(src.itemId)
      FileLogger.info('start-route', 'getBinary erfolgreich abgeschlossen', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        blobSize: bin.blob.size,
        mimeType: bin.mimeType
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      
      // Versuche, HTTP-Response-Details aus dem Fehler zu extrahieren
      // StorageError kann httpStatus, httpStatusText und errorDetails enthalten
      const httpStatus = error && typeof error === 'object' && 'httpStatus' in error && typeof error.httpStatus === 'number'
        ? error.httpStatus
        : undefined
      const httpStatusText = error && typeof error === 'object' && 'httpStatusText' in error && typeof error.httpStatusText === 'string'
        ? error.httpStatusText
        : undefined
      const errorDetails = error && typeof error === 'object' && 'errorDetails' in error
        ? error.errorDetails
        : undefined
      
      // Versuche, errorCode aus dem Fehler zu extrahieren (StorageError hat code-Eigenschaft)
      const errorCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : (httpStatus === 500 ? 'file_load_error' : 'file_load_error')
      
      FileLogger.error('start-route', 'Fehler beim Laden der Datei aus Storage', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        error: errorMessage,
        errorName,
        errorCode,
        httpStatus,
        httpStatusText,
        errorDetails
      })
      
      // Speichere detaillierte Fehlerinformationen im Job
      await repo.setStatus(jobId, 'failed', { 
        error: { 
          code: errorCode,
          message: errorMessage,
          details: {
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails
          }
        } 
      })
      
      // Füge Fehler-Event zum Trace hinzu
      try {
        await repo.traceAddEvent(jobId, { 
          spanId: 'preprocess', 
          name: 'file_load_error', 
          level: 'error',
          message: errorMessage,
          attributes: {
            errorCode,
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails: errorDetails && typeof errorDetails === 'object' ? errorDetails : undefined
          }
        })
      } catch {}
      
      return NextResponse.json({ 
        error: errorMessage,
        errorCode,
        details: {
          fileName: src.name,
          itemId: src.itemId,
          httpStatus,
          httpStatusText
        }
      }, { status: 500 })
    }
    
    const filename = src.name || 'document.pdf'
    const file = new File([bin.blob], filename, { type: src.mimeType || bin.mimeType || 'application/pdf' })
    
    FileLogger.info('start-route', 'Datei geladen', {
      jobId,
      fileName: filename,
      fileSize: file.size,
      fileType: file.type,
      blobSize: bin.blob.size
    });

    // Initialisiere Trace früh, damit Preprocess-Span nicht überschrieben wird
    try { await repo.initializeTrace(jobId) } catch {}

    // Shadow-Twin-State beim Job-Start analysieren und im Job-Dokument speichern
    // WICHTIG: Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
    FileLogger.info('start-route', 'Starte Shadow-Twin-Analyse', {
      jobId,
      itemId: src.itemId,
      fileName: src.name
    })
    let shadowTwinState: Awaited<ReturnType<typeof analyzeShadowTwin>> | null = null
    try {
      shadowTwinState = await analyzeShadowTwin(src.itemId, provider);
      FileLogger.info('start-route', 'Shadow-Twin-Analyse abgeschlossen', {
        jobId,
        itemId: src.itemId,
        hasShadowTwinFolder: !!shadowTwinState?.shadowTwinFolderId,
        hasTransformed: !!shadowTwinState?.transformed
      })
      if (shadowTwinState) {
        // Setze processingStatus auf 'processing', da Job gerade gestartet wird
        const mongoState = toMongoShadowTwinState({ ...shadowTwinState, processingStatus: 'processing' });
        await repo.setShadowTwinState(jobId, mongoState);
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler bei Shadow-Twin-Analyse', {
        jobId,
        fileId: src.itemId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }

    // Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Prüfe Job-Parameter, ob Bilder verarbeitet werden sollen
    const opts = (job.correlation?.options || {}) as Record<string, unknown>
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'
    const includeOcrImages = extractionMethod === 'mistral_ocr'
      ? (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true)
      : (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : false)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' 
      ? opts['includePageImages'] 
      : (extractionMethod === 'mistral_ocr' ? true : false)
    const includeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    
    // Shadow-Twin-Verzeichnis wird benötigt, wenn Bilder verarbeitet werden sollen
    const needsShadowTwinFolder = includeOcrImages || includePageImages || includeImages
    
    // Wenn Verzeichnis benötigt wird, aber noch nicht existiert, erstelle es deterministisch
    if (needsShadowTwinFolder && !shadowTwinState?.shadowTwinFolderId) {
      try {
        const parentId = src.parentId || 'root'
        const originalName = src.name || 'output'
        const folderName = generateShadowTwinFolderName(originalName)

        // OPTIMIERUNG: Wir haben eben `analyzeShadowTwin()` gemacht und wissen, dass kein Folder existiert.
        // Daher erzeugen wir deterministisch direkt, ohne nochmal `findShadowTwinFolder()` aufzurufen.
        // Falls zwischenzeitlich ein Folder entstanden ist, fällt `createFolder` ggf. fehl → dann fallback.
        let folderId: string | undefined
        try {
          const created = await provider.createFolder(parentId, folderName)
          folderId = created.id
        } catch {
          // Fallback: existierendes Verzeichnis finden/holen (robust gegen Race Conditions)
          const { findOrCreateShadowTwinFolder } = await import('@/lib/external-jobs/shadow-twin-helpers')
          folderId = await findOrCreateShadowTwinFolder(provider, parentId, originalName, jobId)
        }
        
        if (folderId) {
          // Aktualisiere Shadow-Twin-State im Job-Dokument
          // Jeder Job hat seinen eigenen isolierten State - keine Beeinflussung anderer Jobs
          const updatedState = shadowTwinState 
            ? { ...shadowTwinState, shadowTwinFolderId: folderId }
            : {
                baseItem: { id: src.itemId, metadata: { name: originalName } },
                shadowTwinFolderId: folderId,
                analysisTimestamp: Date.now()
              }
          
          const mongoState = toMongoShadowTwinState(updatedState)
          await repo.setShadowTwinState(jobId, mongoState)

          // Auch lokal aktualisieren, damit spätere Checks (Gates/Decisions) den neuen Zustand sehen
          shadowTwinState = updatedState as typeof shadowTwinState
          
          FileLogger.info('start-route', 'Shadow-Twin-Verzeichnis deterministisch erstellt', {
            jobId,
            folderId,
            parentId,
            originalName,
            reason: 'Bilder werden verarbeitet'
          });
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Erstellen des Shadow-Twin-Verzeichnisses', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
      }
    }

    const extractStepName = getExtractStepName(job.job_type)

    // Phasen-spezifische Preprozessoren aufrufen (bauen auf derselben Storage/Library-Logik auf)
    // WICHTIG: Die Preprozessoren sind aktuell PDF-spezifisch (findPdfMarkdown).
    // Für Audio/Video laufen die Entscheidungen primär über Gate + ShadowTwinState.
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    let preExtractResult: Awaited<ReturnType<typeof preprocessorPdfExtract>> | null = null
    let preTemplateResult: Awaited<ReturnType<typeof preprocessorTransformTemplate>> | null = null
    if (job.job_type === 'pdf') {
    try {
      preExtractResult = await preprocessorPdfExtract(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorPdfExtract', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    try {
      preTemplateResult = await preprocessorTransformTemplate(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorTransformTemplate', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      }
    }

    // Trace-Events für Preprocess aus Template-Preprozessor ableiten (für Validatoren/Debugging)
    await tracePreprocessEvents(jobId, preExtractResult, preTemplateResult, repo)

    const appUrl = getPublicAppUrl()
    if (!appUrl) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'config_error', message: 'NEXT_PUBLIC_APP_URL fehlt' } })
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 })
    }
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
    try {
      await repo.initializeSteps(jobId, [
        { name: extractStepName, status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ], job.parameters)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Initialisieren der Steps', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'steps_init_error', message: 'Fehler beim Initialisieren der Steps' } })
      return NextResponse.json({ error: 'Fehler beim Initialisieren der Steps' }, { status: 500 })
    }
    // Status wird erst nach erfolgreichem Request gesetzt (siehe Zeile 477)
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: job.job_type === 'pdf' ? 'process_pdf_submit' : 'process_submit', attributes: {
      libraryId: job.libraryId,
      fileName: filename,
      extractionMethod: opts['extractionMethod'] ?? job.correlation?.options?.extractionMethod ?? undefined,
      targetLanguage: opts['targetLanguage'] ?? job.correlation?.options?.targetLanguage ?? undefined,
      includeOcrImages: opts['includeOcrImages'] ?? job.correlation?.options?.includeOcrImages ?? undefined,
      includePageImages: opts['includePageImages'] ?? job.correlation?.options?.includePageImages ?? undefined,
      includeImages: opts['includeImages'] ?? job.correlation?.options?.includeImages ?? undefined, // Rückwärtskompatibilität
      useCache: opts['useCache'] ?? job.correlation?.options?.useCache ?? undefined,
      template: (job.parameters as Record<string, unknown> | undefined)?.['template'] ?? undefined,
      phases: (job.parameters as Record<string, unknown> | undefined)?.['phases'] ?? undefined,
      // Duplicate-Diagnose:
      startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
      workerId: request.headers.get('x-worker-id') || undefined,
      workerTickId: request.headers.get('x-worker-tick-id') || undefined,
      pid: process.pid,
    } })

    // Entscheidungslogik: Gate-basierte Prüfung für Extract-Phase
    // 1. Policies extrahieren
    const policies = getPolicies({ parameters: job.parameters })
    
    // 2. Gate für Extract-Phase prüfen (Shadow-Twin existiert?)
    let extractGateExists = false
    let extractGateReason: string | undefined
    let library: Library | undefined
    try {
      // Library-Informationen für Gate benötigt
      const libraryService = LibraryService.getInstance()
      const libraries = await libraryService.getUserLibraries(job.userEmail)
      library = libraries.find(l => l.id === job.libraryId) as Library | undefined
      
      if (!library) {
        FileLogger.warn('start-route', 'Library nicht gefunden für Gate-Prüfung', {
          jobId,
          libraryId: job.libraryId,
          userEmail: job.userEmail
        })
      } else {
        const derivedGate = deriveExtractGateFromShadowTwinState(
          shadowTwinState,
          (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage
        )
        const gateResult = derivedGate ?? await gateExtractPdf({
          repo,
          jobId,
          userEmail: job.userEmail,
          library,
          source: job.correlation?.source,
          options: job.correlation?.options as { targetLanguage?: string } | undefined,
          provider,
        })
        
        if (gateResult.exists) {
          extractGateExists = true
          extractGateReason = gateResult.reason || 'shadow_twin_exists'
        }
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Prüfen des Extract-Gates', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // Bei Fehler: Gate-Prüfung überspringen, normale Logik verwenden
      // extractGateExists bleibt false, was bedeutet, dass Extract ausgeführt wird
    }
    
    // 3. Entscheidung: Soll Extract ausgeführt werden?
    // Kombiniere Gate-Prüfung mit Policy-Logik
    const phases = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { extract?: boolean; template?: boolean; ingest?: boolean } }).phases : undefined
    const extractEnabled = phases?.extract !== false
    const templateEnabled = phases?.template !== false
    const ingestEnabled = phases?.ingest !== false
    
    // Policy-Directive für Extract bestimmen
    // Mapping: 'force' → 'force', 'skip'/'auto' → 'do' (Gate respektieren), 'ignore' → 'ignore'
    const extractDirective: 'ignore' | 'do' | 'force' = 
      policies.extract === 'force' ? 'force' :
      policies.extract === 'ignore' ? 'ignore' :
      extractEnabled ? 'do' : 'ignore'
    
    // Gate-basierte Entscheidung: Soll Extract ausgeführt werden?
    // shouldRunExtract() kombiniert bereits Gate-Ergebnis mit Policy-Directive
    // - 'force' → immer true (Gate wird ignoriert)
    // - 'ignore' → immer false
    // - 'do' → !gateExists (Gate wird respektiert)
    const shouldRunExtractPhase = shouldRunExtract(extractGateExists, extractDirective)
    
    // Preprocess/Preprozessoren als Quelle für Entscheidungen verwenden
    const needTemplate = preTemplateResult ? preTemplateResult.needTemplate : true
    
    // Finale Entscheidung: Extract nur wenn Phase enabled UND Gate/Policy es erlaubt
    // WICHTIG: shouldRunExtractPhase ist bereits die finale Gate+Policy-Entscheidung
    const runExtract = extractEnabled && shouldRunExtractPhase
    const runTemplate = templateEnabled && needTemplate
    
    // Prüfe, ob Template übersprungen werden sollte (z.B. chapters_already_exist)
    // Dies kann passieren, wenn eine transformierte Datei bereits im Shadow-Twin existiert
    // oder wenn Template-Step bereits als skipped markiert wurde
    let templateWillBeSkipped = false
    if (templateEnabled && !runTemplate) {
      // Template wird nicht ausgeführt (needTemplate = false)
      templateWillBeSkipped = true
    } else if (templateEnabled && runTemplate) {
      // Prüfe, ob Template-Step bereits als skipped markiert wurde (z.B. durch Preprocessor)
      try {
        const currentStep = job.steps?.find(s => s?.name === 'transform_template')
        if (currentStep?.status === 'completed' && currentStep?.details && typeof currentStep.details === 'object' && 'skipped' in currentStep.details) {
          templateWillBeSkipped = true
        }
      } catch {}
      
      // Prüfe, ob bereits eine transformierte Datei im Shadow-Twin existiert
      // Dies bedeutet, dass Template übersprungen werden sollte (chapters_already_exist)
      if (!templateWillBeSkipped && shadowTwinState?.transformed) {
        templateWillBeSkipped = true
      }
    }
    
    // Ingestion-only: Wenn Extract übersprungen UND (Template übersprungen ODER Template wird übersprungen)
    // WICHTIG: Wenn eine transformierte Datei bereits existiert, bedeutet das, dass Template übersprungen wird
    const runIngestOnly = ingestEnabled && !runExtract && (!runTemplate || templateWillBeSkipped)
    
    // Wenn Template nicht ausgeführt werden soll, aber Phase enabled ist, Step als skipped markieren
    // Dies passiert, wenn der Template-Preprozessor needTemplate === false liefert (Frontmatter valide)
    let templateSkipReason: string | undefined = undefined
    if (templateEnabled && !runTemplate) {
      // v2-only: Keine Legacy-Adoption/Reparatur in Phase A.
      // Wenn v2-Artefakte fehlen, soll das bewusst sichtbar bleiben.
      templateSkipReason = 'preprocess_frontmatter_valid'
      
      try {
        await repo.updateStep(jobId, 'transform_template', {
          status: 'completed',
          endedAt: new Date(),
          details: { skipped: true, reason: templateSkipReason, needTemplate: false },
        })
      } catch {}
    }
    
    // Logging nur bei unerwarteten Situationen (z.B. Gate gefunden, aber trotzdem ausgeführt)
    
    // Wenn Gate gefunden wurde, aber trotzdem ausgeführt wird (z.B. force), logge Warnung
    if (extractGateExists && runExtract && extractDirective !== 'force') {
      FileLogger.warn('start-route', 'Extract wird ausgeführt trotz vorhandenem Shadow-Twin', {
        jobId,
        extractGateExists,
        extractDirective,
        shouldRunExtractPhase
      })
    }

    if (runIngestOnly) {
      try { await repo.updateStep(jobId, extractStepName, { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }

      // Shadow-Twin-Markdown-Datei laden (v2-only)
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'Shadow‑Twin nicht gefunden' } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'shadow_twin_missing', message: 'Shadow‑Twin nicht gefunden' } })
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }
      
      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)

      // Ingest-Phase ausführen
      const ctx2: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      const ingestResult = await runIngestPhase({
        ctx: ctx2,
        provider,
        repo,
        markdown: shadowTwinData.markdown,
        meta: shadowTwinData.meta,
        savedItemId: shadowTwinData.fileId,
        policies: { ingest: phasePolicies.ingest as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
      })

      if (ingestResult.error) {
        await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: ingestResult.error } })
        return NextResponse.json({ error: ingestResult.error }, { status: 500 })
      }

      if (ingestResult.completed) {
        // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
        // Ingest-Only: Nach erfolgreicher Ingestion ist der Shadow-Twin vollständig
        try {
          const updatedJob = await repo.get(jobId)
          if (updatedJob?.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...updatedJob.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
            FileLogger.info('start-route', 'Shadow-Twin-State nach Ingestion auf ready gesetzt', { jobId })
          }
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States nach Ingestion', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
          // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
        }
        
        const completed = await setJobCompleted({ ctx: ctx2, result: { savedItemId: shadowTwinData.fileId } })
        getJobEventBus().emitUpdate(job.userEmail, { 
          type: 'job_update', 
          jobId, 
          status: 'completed', 
          progress: 100, 
          updatedAt: new Date().toISOString(), 
          message: 'completed', 
          jobType: job.job_type, 
          fileName: job.correlation?.source?.name, 
          sourceItemId: job.correlation?.source?.itemId, 
          libraryId: job.libraryId,
          result: { savedItemId: shadowTwinData.fileId },
          shadowTwinFolderId: job.shadowTwinState?.shadowTwinFolderId || null,
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      }

      return NextResponse.json({ ok: true, jobId, kind: 'ingest_only', skipped: ingestResult.skipped })
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      // Markiere Extract-Step als skipped, wenn Extract übersprungen wurde (Gate oder Phase deaktiviert)
      // WICHTIG: Dies muss auch hier passieren, wenn Template ausgeführt wird
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // WICHTIG: Job-Objekt neu laden, damit shadowTwinState sicher vorhanden ist.
      // Ohne Reload sieht loadShadowTwinMarkdown u.U. kein shadowTwinState und sucht "blind" im Storage.
      const refreshedJob = await repo.get(jobId)

      // Shadow-Twin-Markdown-Datei laden (bevorzugt shadowTwinState.transformed.id)
      const ctxPre: RequestContext = { request, jobId, job: refreshedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        // Job als failed markieren, da Shadow-Twin nicht gefunden wurde
        try {
          await repo.updateStep(jobId, 'transform_template', {
            status: 'failed',
            endedAt: new Date(),
            error: { message: 'Shadow‑Twin nicht gefunden' }
          })
          await repo.setStatus(jobId, 'failed', {
            error: { code: 'shadow_twin_not_found', message: 'Shadow‑Twin nicht gefunden' }
          })
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Markieren des Jobs als failed', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }

      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)
      
      // Library-Config für Template-Auswahl laden
      let libraryConfig: LibraryChatConfig | undefined = undefined
      try {
        const libraryService = LibraryService.getInstance()
        const email = userEmail || job.userEmail
        const library = await libraryService.getLibrary(email, job.libraryId)
        libraryConfig = library?.config?.chat
      } catch (error) {
        FileLogger.warn('start-route', 'Fehler beim Laden der Library-Config', {
          jobId,
          libraryId: job.libraryId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Nicht kritisch - Template-Auswahl kann auch ohne Config funktionieren
      }

      // Target-Parent-ID bestimmen (Shadow-Twin-Folder oder Parent)
      // WICHTIG: Job-Objekt neu laden, um aktuelles Shadow-Twin-State zu erhalten
      // Das Shadow-Twin-State wurde beim Job-Start analysiert und gespeichert
      const updatedJob = await repo.get(jobId)
      const shadowTwinFolderId = updatedJob?.shadowTwinState?.shadowTwinFolderId || shadowTwinState?.shadowTwinFolderId
      const targetParentId = shadowTwinFolderId || job.correlation?.source?.parentId || 'root'

      // Template-Phase ausführen
      // WICHTIG: Aktualisiertes Job-Objekt verwenden, damit runTemplatePhase das aktuelle Shadow-Twin-State sieht
      const ctxPreUpdated: RequestContext = { request, jobId, job: updatedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const extractedText = stripAllFrontmatter(shadowTwinData.markdown)
      const templateResult = await runTemplatePhase({
        ctx: ctxPreUpdated,
        provider,
        repo,
        extractedText,
        bodyMetadata: shadowTwinData.meta,
        policies: { metadata: phasePolicies.metadata as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
        autoSkip: true,
        imagesPhaseEnabled: false, // Template-Only: keine Bilder verarbeiten
        targetParentId,
        libraryConfig,
      })

      if (templateResult.status === 'failed') {
        const errorMessage = templateResult.errorMessage || 'Template-Phase fehlgeschlagen'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
      }

      // v2-only: Keine Legacy-Cleanup/Reparatur in Phase A.

      // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
      // Template-Only: Nach erfolgreichem Template-Lauf ist der Shadow-Twin vollständig
      try {
        const updatedJob = await repo.get(jobId)
        if (updatedJob?.shadowTwinState) {
          const mongoState = toMongoShadowTwinState({
            ...updatedJob.shadowTwinState,
            processingStatus: 'ready' as const,
          })
          await repo.setShadowTwinState(jobId, mongoState)
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
      })
        // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
      }

      // Job als completed markieren (Template-Only: keine weiteren Phasen)
      const { setJobCompleted } = await import('@/lib/external-jobs/complete')
      await setJobCompleted({
        ctx: ctxPreUpdated,
        result: {},
      })

      return NextResponse.json({ ok: true, jobId, kind: 'template_only' })
    }

    // Secretary-Flow (Extract/Template)
    const secret = (await import('crypto')).randomBytes(24).toString('base64url')
    const secretHash = repo.hashSecret(secret)
    // WICHTIG:
    // Wir setzen Status+Hash idempotent, aber blockieren Start-Requests NICHT.
    // Duplicate-Handling erfolgt über Logging/Root-Cause-Fix (Worker/Client).
    try {
      await repo.setStatus(jobId, 'running', { jobSecretHash: secretHash })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Setzen des Status und Hash', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'status_update_error', message: 'Fehler beim Setzen des Status' } })
      return NextResponse.json({ error: 'Fehler beim Setzen des Status' }, { status: 500 })
    }

    // WICHTIG: Request nur senden, wenn Extract ausgeführt werden soll
    if (!runExtract) {
      FileLogger.info('start-route', 'Extract-Phase übersprungen - kein Request an Secretary Service', {
      jobId,
        extractGateExists,
        extractGateReason,
        extractDirective,
        shouldRunExtractPhase,
        runExtract
      })

      // Watchdog explizit stoppen, da kein externer Worker-Callback mehr erwartet wird.
      // Andernfalls würde der Watchdog den Job fälschlicherweise nach Timeout auf "failed" setzen.
      try {
        clearWatchdog(jobId)
      } catch {}
      
      // Markiere Extract-Step als skipped
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // Wenn auch Template und Ingest übersprungen werden, Job als completed markieren
      if (!runTemplate && !runIngestOnly) {
        // Extract-Only-Modus: Extract wurde übersprungen (Gate), Template/Ingest deaktiviert
        // Trace-Event für Validator hinzufügen
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'extract',
            name: 'extract_only_mode',
            attributes: {
              message: 'Extract-Only Modus aktiviert (Extract übersprungen via Gate)',
              skipped: true,
              reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            },
          })
        } catch {
          // Trace-Fehler nicht kritisch
        }

        // Template- und Ingest-Phase sind über Phasen-Konfiguration deaktiviert.
        // Für eine konsistente Statuskommunikation müssen die Steps explizit als
        // "skipped" markiert werden. WICHTIG: Wenn Template bereits einen Reason hat
        // (z.B. legacy_markdown_adopted), diesen nicht überschreiben.
        try {
          const currentStep = job.steps?.find(s => s?.name === 'transform_template')
          const currentReason = currentStep?.details && typeof currentStep.details === 'object' && 'reason' in currentStep.details
            ? String(currentStep.details.reason)
            : undefined
          
          // Nur überschreiben, wenn noch kein Reason gesetzt wurde
          if (!currentReason || currentReason === 'pending') {
            await repo.updateStep(jobId, 'transform_template', {
              status: 'completed',
              endedAt: new Date(),
              details: {
                skipped: true,
                reason: templateSkipReason || 'phase_disabled',
              },
            })
          }
        } catch {}
        try {
          await repo.updateStep(jobId, 'ingest_rag', {
            status: 'completed',
            endedAt: new Date(),
            details: {
              skipped: true,
              reason: 'phase_disabled',
            },
          })
        } catch {}

        // Shadow-Twin-State auf "ready" setzen, falls bereits vorhanden.
        // Auch wenn keine neuen Artefakte erzeugt wurden, signalisiert dies,
        // dass der Job abgeschlossen ist und ein existierender Shadow-Twin
        // für die Anzeige verwendet werden kann.
        // WICHTIG: Verwende toMongoShadowTwinState für korrekte Konvertierung
        try {
          if (job.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...job.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
        } else {
            // Falls kein Shadow-Twin-State existiert, aber ein Shadow-Twin-Verzeichnis vorhanden ist,
            // analysiere es und setze den Status auf "ready"
            if (job.correlation?.source?.itemId && library) {
              try {
                const { analyzeShadowTwin } = await import('@/lib/shadow-twin/analyze-shadow-twin')
                const shadowTwinState = await analyzeShadowTwin(job.correlation.source.itemId, provider)
                if (shadowTwinState) {
                  const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
                  const mongoState = toMongoShadowTwinState({
                    ...shadowTwinState,
                    processingStatus: 'ready' as const,
                  })
                  await repo.setShadowTwinState(jobId, mongoState)
                }
              } catch {
                // Fehler bei Shadow-Twin-Analyse nicht kritisch
              }
            }
          }
        } catch {
          // Fehler bei Status-Aktualisierung nicht kritisch
        }

        const completed = await setJobCompleted({ 
          ctx: { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }, 
          result: {} 
        })
        getJobEventBus().emitUpdate(job.userEmail, {
          type: 'job_update',
        jobId,
          status: 'completed',
          progress: 100,
          updatedAt: new Date().toISOString(),
          message: 'completed (all phases skipped)',
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
          libraryId: job.libraryId
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'all_phases_skipped' })
      }
      
      // Wenn nur Extract übersprungen wird, aber Template/Ingest laufen sollen, return
      // (Template-only Flow wird oben bereits behandelt)
      return NextResponse.json({ ok: true, jobId, kind: 'extract_skipped' })
    }

    // Bereite Secretary-Service-Request vor
    const requestConfig = prepareSecretaryRequest(job, file, callbackUrl, secret)
    const { url, formData: formForRequest, headers } = requestConfig
    
    FileLogger.info('start-route', 'Sende Request an Secretary Service', {
      jobId,
      url,
      method: 'POST',
      hasApiKey: !!requestConfig.headers['Authorization']
    });
    
    let resp: Response
    try {
      resp = await fetch(url, { method: 'POST', body: formForRequest, headers })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Senden des Requests an Secretary Service', {
        jobId,
        url,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'fetch_error', message: 'Fehler beim Senden des Requests' } })
      return NextResponse.json({ error: 'Fehler beim Senden des Requests' }, { status: 500 })
    }
    
    FileLogger.info('start-route', 'Secretary Service Antwort erhalten', {
      jobId,
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      headers: Object.fromEntries(resp.headers.entries())
    });
    
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'preprocess',
        name: 'request_ack',
        attributes: {
          status: resp.status,
          statusText: resp.statusText,
          url,
          extractionMethod,
          // Duplicate-Diagnose:
          startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
          workerId: request.headers.get('x-worker-id') || undefined,
          workerTickId: request.headers.get('x-worker-tick-id') || undefined,
          pid: process.pid,
        },
      })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Hinzufügen des Trace-Events', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Trace-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }

    // UX: Step sofort auf "running" setzen, sobald der Request zum Worker ack'ed wurde.
    // Ohne dieses Update bleibt der Step in der UI lange auf "pending", obwohl der Job bereits läuft
    // und nur auf den Callback wartet.
    try {
      await repo.updateStep(jobId, extractStepName, { status: 'running', startedAt: new Date() })
    } catch {}
    // Status wurde bereits VOR dem Request gesetzt (siehe Zeile 360)
    // Hash wurde bereits gespeichert, damit Callbacks korrekt validiert werden können
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Keine Fehlermeldung');
      FileLogger.error('start-route', 'Secretary Service Fehler', {
        jobId,
        status: resp.status,
        statusText: resp.statusText,
        errorText,
        url
      });
      await repo.setStatus(jobId, 'failed', { error: { code: 'secretary_error', message: errorText, details: { status: resp.status, statusText: resp.statusText } } })
      return NextResponse.json({ error: 'Secretary Fehler', status: resp.status, details: errorText }, { status: 502 })
    }
    const data = await resp.json().catch((err) => {
      FileLogger.error('start-route', 'Fehler beim Parsen der Response', {
        jobId,
        error: err instanceof Error ? err.message : String(err)
      });
      return {};
    })
    
    FileLogger.info('start-route', 'Secretary Service Response erfolgreich', {
      jobId,
      hasData: !!data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      status: (data as { status?: string })?.status
    });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'enqueued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, libraryId: job.libraryId })
    // Watchdog wurde bereits beim Start gestartet - nur aktualisieren (bump)
    // Dies stellt sicher, dass der Timer zurückgesetzt wird, wenn der Request erfolgreich war
    try {
      bumpWatchdog(jobId, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Aktualisieren des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    return NextResponse.json({ ok: true, jobId, data })
  } catch (err) {
    // WICHTIG: Bei Fehlern Status auf 'failed' setzen, damit Job nicht hängen bleibt
    const errorMessage = err instanceof Error ? err.message : 'Unerwarteter Fehler'
    try {
      // Versuche Job zu laden für Kontext
      const jobForError = await repo.get(jobId).catch(() => null)
      if (jobForError) {
        await handleJobError(err, {
        jobId,
          userEmail: jobForError.userEmail,
          jobType: jobForError.job_type,
          fileName: jobForError.correlation?.source?.name,
          sourceItemId: jobForError.correlation?.source?.itemId,
        }, repo, 'start_error')
      } else {
        // Fallback: Nur Status setzen ohne vollständigen Kontext
        await repo.setStatus(jobId, 'failed', { error: { code: 'start_error', message: errorMessage } })
      }
    } catch {
      // Fehler beim Error-Handling nicht weiter propagieren
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



```

```typescript
/**
 * @fileoverview External Jobs Start API Route - Job Execution Trigger
 * 
 * @description
 * Endpoint for starting external job execution. Handles job preprocessing, Secretary Service
 * request initiation, watchdog setup, and initial job state management. Called by the worker
 * to trigger job processing. Supports both authenticated users and internal worker requests.
 * 
 * @module external-jobs
 * 
 * @exports
 * - POST: Starts job execution and triggers Secretary Service processing
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs/[jobId]/start
 * - src/lib/external-jobs-worker.ts: Worker calls this endpoint to start jobs
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs/preprocess: Job preprocessing
 * - @/lib/external-jobs/auth: Internal authorization check
 * - @/lib/external-jobs-watchdog: Watchdog for timeout monitoring
 * - @/lib/secretary/client: Secretary Service client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getPublicAppUrl } from '@/lib/env'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { startWatchdog, bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog'
import type { RequestContext } from '@/types/external-jobs'
import { preprocessorPdfExtract } from '@/lib/external-jobs/preprocessor-pdf-extract'
import { preprocessorTransformTemplate } from '@/lib/external-jobs/preprocessor-transform-template'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { isInternalAuthorized } from '@/lib/external-jobs/auth'
import { FileLogger } from '@/lib/debug/logger'
import { checkJobStartability } from '@/lib/external-jobs/job-status-check'
import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'
import { tracePreprocessEvents } from '@/lib/external-jobs/trace-helpers'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin'
import { toMongoShadowTwinState } from '@/lib/shadow-twin/shared'
import { gateExtractPdf } from '@/lib/processing/gates'
import { getPolicies, shouldRunExtract } from '@/lib/processing/phase-policy'
import type { Library, LibraryChatConfig } from '@/types/library'
import { LibraryService } from '@/lib/services/library-service'
import { loadShadowTwinMarkdown } from '@/lib/external-jobs/phase-shadow-twin-loader'
import { runIngestPhase } from '@/lib/external-jobs/phase-ingest'
import { runTemplatePhase } from '@/lib/external-jobs/phase-template'
import { readPhasesAndPolicies } from '@/lib/external-jobs/policies'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

/**
 * Ableitung des Extract-Gates aus einem bereits berechneten ShadowTwinState.
 *
 * Ziel: doppelte Storage-Scans (findShadowTwinFolder/listItemsById) vermeiden, wenn wir die
 * Information ohnehin schon aus `analyzeShadowTwin()` haben.
 *
 * WICHTIG: Diese Ableitung deckt den häufigsten Fall ab:
 * - wenn im Shadow-Twin-Verzeichnis bereits ein Transcript oder Transformiertes Markdown existiert,
 *   dann ist Extract redundant.
 * Falls ShadowTwinState nicht aussagekräftig ist, geben wir `undefined` zurück und fallen auf
 * `gateExtractPdf()` zurück.
 */
function deriveExtractGateFromShadowTwinState(
  shadowTwinState: unknown,
  targetLanguage: string | undefined
): { exists: boolean; reason?: 'shadow_twin_exists'; details?: Record<string, unknown> } | undefined {
  try {
    if (!shadowTwinState || typeof shadowTwinState !== 'object') return undefined
    const st = shadowTwinState as {
      shadowTwinFolderId?: unknown
      transformed?: unknown
      transcriptFiles?: unknown
    }
    const folderId = typeof st.shadowTwinFolderId === 'string' ? st.shadowTwinFolderId : undefined

    const transformed = (st.transformed && typeof st.transformed === 'object')
      ? (st.transformed as { id?: unknown; metadata?: { name?: unknown } })
      : undefined
    const transformedId = typeof transformed?.id === 'string' ? transformed.id : undefined
    const transformedName = typeof transformed?.metadata?.name === 'string' ? transformed.metadata.name : undefined

    const transcriptFiles = Array.isArray(st.transcriptFiles) ? st.transcriptFiles as Array<{ id?: unknown; metadata?: { name?: unknown } }> : []
    const transcript = transcriptFiles.find(f => typeof f?.id === 'string')
    const transcriptId = typeof transcript?.id === 'string' ? transcript.id : undefined
    const transcriptName = typeof transcript?.metadata?.name === 'string' ? transcript.metadata.name : undefined

    // Ohne irgendein Markdown ist die Aussage "shadow_twin_exists" nicht belastbar
    if (!transformedId && !transcriptId) return { exists: false }

    return {
      exists: true,
      reason: 'shadow_twin_exists',
      details: {
        source: 'shadowTwinState',
        folderId: folderId || null,
        language: (targetLanguage || 'de').toLowerCase(),
        transformed: transformedId ? { id: transformedId, name: transformedName || null } : null,
        transcript: transcriptId ? { id: transcriptId, name: transcriptName || null } : null,
      },
    }
  } catch {
    return undefined
  }
}

function getExtractStepName(jobType: string): 'extract_pdf' | 'extract_audio' | 'extract_video' {
  if (jobType === 'audio') return 'extract_audio'
  if (jobType === 'video') return 'extract_video'
  return 'extract_pdf'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const repo = new ExternalJobsRepository();
  try {
    // Interner Worker darf ohne Clerk durch, wenn Token korrekt
    const internal = isInternalAuthorized(request)
    let userEmail = ''
    if (!internal.isInternal) {
      const { userId } = getAuth(request)
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 })
    let job: Awaited<ReturnType<typeof repo.get>>
    try {
      job = await repo.get(jobId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Jobs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      return NextResponse.json({ error: 'Fehler beim Laden des Jobs' }, { status: 500 })
    }
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    if (!internal.isInternal) {
      if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // WICHTIG: Watchdog SOFORT starten, damit Job nicht hängen bleibt, wenn Start-Endpoint fehlschlägt
    // Timeout: 10 Minuten (600_000 ms) - sollte ausreichen für Datei-Laden, Preprocessing, Request, etc.
    // Der Watchdog wird später via bumpWatchdog aktualisiert, wenn Callbacks vom Secretary Service kommen
    try {
      startWatchdog({ 
        jobId, 
        userEmail: job.userEmail, 
        jobType: job.job_type, 
        fileName: job.correlation?.source?.name 
      }, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Starten des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    // Duplicate-Detection (nur Logging, kein Blockieren):
    // Wir wollen doppelte /start Requests erkennen und Ursachen finden, statt hart zu blockieren.
    const startability = checkJobStartability(job)
    const startRequestId = request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || null
    const workerIdFromHeader = request.headers.get('x-worker-id') || null
    if (!startability.canStart) {
      FileLogger.warn('start-route', 'Start-Request erneut erhalten (nicht blockiert)', {
        jobId,
        reason: startability.reason || 'already_started',
        jobStatus: job.status,
        workerId: workerIdFromHeader,
        startRequestId,
        pid: process.pid,
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'job',
          name: 'start_duplicate_request',
          level: 'warn',
          attributes: {
            reason: startability.reason || 'already_started',
            jobStatus: job.status,
            workerId: workerIdFromHeader,
            startRequestId,
            pid: process.pid,
          },
        })
      } catch {}
    }
    
    // Erlaube Neustart, wenn Job fehlgeschlagen ist
    const isFailed = job.status === 'failed'
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
    if (isFailed && job.processId) {
      try {
        const col = await (await import('@/lib/mongodb-service')).getCollection<import('@/types/external-job').ExternalJob>('external_jobs')
        await col.updateOne({ jobId }, { $unset: { processId: '' }, $set: { updatedAt: new Date() } })
        FileLogger.info('start-route', 'Fehlgeschlagener Job wird neu gestartet', {
          jobId,
          oldProcessId: job.processId
        })
      } catch {}
    }

    // Secretary-Aufruf vorbereiten (aus alter Retry-Startlogik entnommen, minimal)
    let provider: Awaited<ReturnType<typeof getServerProvider>>
    try {
      provider = await getServerProvider(job.userEmail, job.libraryId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Storage-Providers', {
        jobId,
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'provider_error', message: 'Fehler beim Laden des Storage-Providers' } })
      return NextResponse.json({ error: 'Fehler beim Laden des Storage-Providers' }, { status: 500 })
    }
    
    const src = job.correlation?.source
    if (!src?.itemId || !src?.parentId) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'source_incomplete', message: 'Quelle unvollständig' } })
      return NextResponse.json({ error: 'Quelle unvollständig' }, { status: 400 })
    }

    // Request-lokales Caching für Storage-Reads aktivieren (reduziert redundante list/get/path Calls)
    provider = withRequestStorageCache(provider)
    
    FileLogger.info('start-route', 'Lade Datei aus Storage', {
      jobId,
      itemId: src.itemId,
      parentId: src.parentId,
      fileName: src.name
    });
    
    let bin: Awaited<ReturnType<typeof provider.getBinary>>
    try {
      FileLogger.info('start-route', 'Starte getBinary-Aufruf', {
        jobId,
        itemId: src.itemId,
        fileName: src.name
      })
      bin = await provider.getBinary(src.itemId)
      FileLogger.info('start-route', 'getBinary erfolgreich abgeschlossen', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        blobSize: bin.blob.size,
        mimeType: bin.mimeType
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      
      // Versuche, HTTP-Response-Details aus dem Fehler zu extrahieren
      // StorageError kann httpStatus, httpStatusText und errorDetails enthalten
      const httpStatus = error && typeof error === 'object' && 'httpStatus' in error && typeof error.httpStatus === 'number'
        ? error.httpStatus
        : undefined
      const httpStatusText = error && typeof error === 'object' && 'httpStatusText' in error && typeof error.httpStatusText === 'string'
        ? error.httpStatusText
        : undefined
      const errorDetails = error && typeof error === 'object' && 'errorDetails' in error
        ? error.errorDetails
        : undefined
      
      // Versuche, errorCode aus dem Fehler zu extrahieren (StorageError hat code-Eigenschaft)
      const errorCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : (httpStatus === 500 ? 'file_load_error' : 'file_load_error')
      
      FileLogger.error('start-route', 'Fehler beim Laden der Datei aus Storage', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        error: errorMessage,
        errorName,
        errorCode,
        httpStatus,
        httpStatusText,
        errorDetails
      })
      
      // Speichere detaillierte Fehlerinformationen im Job
      await repo.setStatus(jobId, 'failed', { 
        error: { 
          code: errorCode,
          message: errorMessage,
          details: {
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails
          }
        } 
      })
      
      // Füge Fehler-Event zum Trace hinzu
      try {
        await repo.traceAddEvent(jobId, { 
          spanId: 'preprocess', 
          name: 'file_load_error', 
          level: 'error',
          message: errorMessage,
          attributes: {
            errorCode,
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails: errorDetails && typeof errorDetails === 'object' ? errorDetails : undefined
          }
        })
      } catch {}
      
      return NextResponse.json({ 
        error: errorMessage,
        errorCode,
        details: {
          fileName: src.name,
          itemId: src.itemId,
          httpStatus,
          httpStatusText
        }
      }, { status: 500 })
    }
    
    const filename = src.name || 'document.pdf'
    const file = new File([bin.blob], filename, { type: src.mimeType || bin.mimeType || 'application/pdf' })
    
    FileLogger.info('start-route', 'Datei geladen', {
      jobId,
      fileName: filename,
      fileSize: file.size,
      fileType: file.type,
      blobSize: bin.blob.size
    });

    // Initialisiere Trace früh, damit Preprocess-Span nicht überschrieben wird
    try { await repo.initializeTrace(jobId) } catch {}

    // Shadow-Twin-State beim Job-Start analysieren und im Job-Dokument speichern
    // WICHTIG: Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
    FileLogger.info('start-route', 'Starte Shadow-Twin-Analyse', {
      jobId,
      itemId: src.itemId,
      fileName: src.name
    })
    let shadowTwinState: Awaited<ReturnType<typeof analyzeShadowTwin>> | null = null
    try {
      shadowTwinState = await analyzeShadowTwin(src.itemId, provider);
      FileLogger.info('start-route', 'Shadow-Twin-Analyse abgeschlossen', {
        jobId,
        itemId: src.itemId,
        hasShadowTwinFolder: !!shadowTwinState?.shadowTwinFolderId,
        hasTransformed: !!shadowTwinState?.transformed
      })
      if (shadowTwinState) {
        // Setze processingStatus auf 'processing', da Job gerade gestartet wird
        const mongoState = toMongoShadowTwinState({ ...shadowTwinState, processingStatus: 'processing' });
        await repo.setShadowTwinState(jobId, mongoState);
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler bei Shadow-Twin-Analyse', {
        jobId,
        fileId: src.itemId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }

    // Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Prüfe Job-Parameter, ob Bilder verarbeitet werden sollen
    const opts = (job.correlation?.options || {}) as Record<string, unknown>
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'
    const includeOcrImages = extractionMethod === 'mistral_ocr'
      ? (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true)
      : (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : false)
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' 
      ? opts['includePageImages'] 
      : (extractionMethod === 'mistral_ocr' ? true : false)
    const includeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    
    // Shadow-Twin-Verzeichnis wird benötigt, wenn Bilder verarbeitet werden sollen
    const needsShadowTwinFolder = includeOcrImages || includePageImages || includeImages
    
    // Wenn Verzeichnis benötigt wird, aber noch nicht existiert, erstelle es deterministisch
    if (needsShadowTwinFolder && !shadowTwinState?.shadowTwinFolderId) {
      try {
        const parentId = src.parentId || 'root'
        const originalName = src.name || 'output'
        const folderName = generateShadowTwinFolderName(originalName)

        // OPTIMIERUNG: Wir haben eben `analyzeShadowTwin()` gemacht und wissen, dass kein Folder existiert.
        // Daher erzeugen wir deterministisch direkt, ohne nochmal `findShadowTwinFolder()` aufzurufen.
        // Falls zwischenzeitlich ein Folder entstanden ist, fällt `createFolder` ggf. fehl → dann fallback.
        let folderId: string | undefined
        try {
          const created = await provider.createFolder(parentId, folderName)
          folderId = created.id
        } catch {
          // Fallback: existierendes Verzeichnis finden/holen (robust gegen Race Conditions)
          const { findOrCreateShadowTwinFolder } = await import('@/lib/external-jobs/shadow-twin-helpers')
          folderId = await findOrCreateShadowTwinFolder(provider, parentId, originalName, jobId)
        }
        
        if (folderId) {
          // Aktualisiere Shadow-Twin-State im Job-Dokument
          // Jeder Job hat seinen eigenen isolierten State - keine Beeinflussung anderer Jobs
          const updatedState = shadowTwinState 
            ? { ...shadowTwinState, shadowTwinFolderId: folderId }
            : {
                baseItem: { id: src.itemId, metadata: { name: originalName } },
                shadowTwinFolderId: folderId,
                analysisTimestamp: Date.now()
              }
          
          const mongoState = toMongoShadowTwinState(updatedState)
          await repo.setShadowTwinState(jobId, mongoState)

          // Auch lokal aktualisieren, damit spätere Checks (Gates/Decisions) den neuen Zustand sehen
          shadowTwinState = updatedState as typeof shadowTwinState
          
          FileLogger.info('start-route', 'Shadow-Twin-Verzeichnis deterministisch erstellt', {
            jobId,
            folderId,
            parentId,
            originalName,
            reason: 'Bilder werden verarbeitet'
          });
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Erstellen des Shadow-Twin-Verzeichnisses', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
      }
    }

    const extractStepName = getExtractStepName(job.job_type)

    // Phasen-spezifische Preprozessoren aufrufen (bauen auf derselben Storage/Library-Logik auf)
    // WICHTIG: Die Preprozessoren sind aktuell PDF-spezifisch (findPdfMarkdown).
    // Für Audio/Video laufen die Entscheidungen primär über Gate + ShadowTwinState.
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    let preExtractResult: Awaited<ReturnType<typeof preprocessorPdfExtract>> | null = null
    let preTemplateResult: Awaited<ReturnType<typeof preprocessorTransformTemplate>> | null = null
    if (job.job_type === 'pdf') {
    try {
      preExtractResult = await preprocessorPdfExtract(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorPdfExtract', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    try {
      preTemplateResult = await preprocessorTransformTemplate(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorTransformTemplate', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      }
    }

    // Trace-Events für Preprocess aus Template-Preprozessor ableiten (für Validatoren/Debugging)
    await tracePreprocessEvents(jobId, preExtractResult, preTemplateResult, repo)

    const appUrl = getPublicAppUrl()
    if (!appUrl) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'config_error', message: 'NEXT_PUBLIC_APP_URL fehlt' } })
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 })
    }
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
    try {
      await repo.initializeSteps(jobId, [
        { name: extractStepName, status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ], job.parameters)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Initialisieren der Steps', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'steps_init_error', message: 'Fehler beim Initialisieren der Steps' } })
      return NextResponse.json({ error: 'Fehler beim Initialisieren der Steps' }, { status: 500 })
    }
    // Status wird erst nach erfolgreichem Request gesetzt (siehe Zeile 477)
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: job.job_type === 'pdf' ? 'process_pdf_submit' : 'process_submit', attributes: {
      libraryId: job.libraryId,
      fileName: filename,
      extractionMethod: opts['extractionMethod'] ?? job.correlation?.options?.extractionMethod ?? undefined,
      targetLanguage: opts['targetLanguage'] ?? job.correlation?.options?.targetLanguage ?? undefined,
      includeOcrImages: opts['includeOcrImages'] ?? job.correlation?.options?.includeOcrImages ?? undefined,
      includePageImages: opts['includePageImages'] ?? job.correlation?.options?.includePageImages ?? undefined,
      includeImages: opts['includeImages'] ?? job.correlation?.options?.includeImages ?? undefined, // Rückwärtskompatibilität
      useCache: opts['useCache'] ?? job.correlation?.options?.useCache ?? undefined,
      template: (job.parameters as Record<string, unknown> | undefined)?.['template'] ?? undefined,
      phases: (job.parameters as Record<string, unknown> | undefined)?.['phases'] ?? undefined,
      // Duplicate-Diagnose:
      startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
      workerId: request.headers.get('x-worker-id') || undefined,
      workerTickId: request.headers.get('x-worker-tick-id') || undefined,
      pid: process.pid,
    } })

    // Entscheidungslogik: Gate-basierte Prüfung für Extract-Phase
    // 1. Policies extrahieren
    const policies = getPolicies({ parameters: job.parameters })
    
    // 2. Gate für Extract-Phase prüfen (Shadow-Twin existiert?)
    let extractGateExists = false
    let extractGateReason: string | undefined
    let library: Library | undefined
    try {
      // Library-Informationen für Gate benötigt
      const libraryService = LibraryService.getInstance()
      const libraries = await libraryService.getUserLibraries(job.userEmail)
      library = libraries.find(l => l.id === job.libraryId) as Library | undefined
      
      if (!library) {
        FileLogger.warn('start-route', 'Library nicht gefunden für Gate-Prüfung', {
          jobId,
          libraryId: job.libraryId,
          userEmail: job.userEmail
        })
      } else {
        const derivedGate = deriveExtractGateFromShadowTwinState(
          shadowTwinState,
          (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage
        )
        const gateResult = derivedGate ?? await gateExtractPdf({
          repo,
          jobId,
          userEmail: job.userEmail,
          library,
          source: job.correlation?.source,
          options: job.correlation?.options as { targetLanguage?: string } | undefined,
          provider,
        })
        
        if (gateResult.exists) {
          extractGateExists = true
          extractGateReason = gateResult.reason || 'shadow_twin_exists'
        }
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Prüfen des Extract-Gates', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // Bei Fehler: Gate-Prüfung überspringen, normale Logik verwenden
      // extractGateExists bleibt false, was bedeutet, dass Extract ausgeführt wird
    }
    
    // 3. Entscheidung: Soll Extract ausgeführt werden?
    // Kombiniere Gate-Prüfung mit Policy-Logik
    const phases = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { extract?: boolean; template?: boolean; ingest?: boolean } }).phases : undefined
    const extractEnabled = phases?.extract !== false
    const templateEnabled = phases?.template !== false
    const ingestEnabled = phases?.ingest !== false
    
    // Policy-Directive für Extract bestimmen
    // Mapping: 'force' → 'force', 'skip'/'auto' → 'do' (Gate respektieren), 'ignore' → 'ignore'
    const extractDirective: 'ignore' | 'do' | 'force' = 
      policies.extract === 'force' ? 'force' :
      policies.extract === 'ignore' ? 'ignore' :
      extractEnabled ? 'do' : 'ignore'
    
    // Gate-basierte Entscheidung: Soll Extract ausgeführt werden?
    // shouldRunExtract() kombiniert bereits Gate-Ergebnis mit Policy-Directive
    // - 'force' → immer true (Gate wird ignoriert)
    // - 'ignore' → immer false
    // - 'do' → !gateExists (Gate wird respektiert)
    const shouldRunExtractPhase = shouldRunExtract(extractGateExists, extractDirective)
    
    // Preprocess/Preprozessoren als Quelle für Entscheidungen verwenden
    const needTemplate = preTemplateResult ? preTemplateResult.needTemplate : true
    
    // Finale Entscheidung: Extract nur wenn Phase enabled UND Gate/Policy es erlaubt
    // WICHTIG: shouldRunExtractPhase ist bereits die finale Gate+Policy-Entscheidung
    const runExtract = extractEnabled && shouldRunExtractPhase
    const runTemplate = templateEnabled && needTemplate
    
    // Prüfe, ob Template übersprungen werden sollte (z.B. chapters_already_exist)
    // Dies kann passieren, wenn eine transformierte Datei bereits im Shadow-Twin existiert
    // oder wenn Template-Step bereits als skipped markiert wurde
    let templateWillBeSkipped = false
    if (templateEnabled && !runTemplate) {
      // Template wird nicht ausgeführt (needTemplate = false)
      templateWillBeSkipped = true
    } else if (templateEnabled && runTemplate) {
      // Prüfe, ob Template-Step bereits als skipped markiert wurde (z.B. durch Preprocessor)
      try {
        const currentStep = job.steps?.find(s => s?.name === 'transform_template')
        if (currentStep?.status === 'completed' && currentStep?.details && typeof currentStep.details === 'object' && 'skipped' in currentStep.details) {
          templateWillBeSkipped = true
        }
      } catch {}
      
      // Prüfe, ob bereits eine transformierte Datei im Shadow-Twin existiert
      // Dies bedeutet, dass Template übersprungen werden sollte (chapters_already_exist)
      if (!templateWillBeSkipped && shadowTwinState?.transformed) {
        templateWillBeSkipped = true
      }
    }
    
    // Ingestion-only: Wenn Extract übersprungen UND (Template übersprungen ODER Template wird übersprungen)
    // WICHTIG: Wenn eine transformierte Datei bereits existiert, bedeutet das, dass Template übersprungen wird
    const runIngestOnly = ingestEnabled && !runExtract && (!runTemplate || templateWillBeSkipped)
    
    // Wenn Template nicht ausgeführt werden soll, aber Phase enabled ist, Step als skipped markieren
    // Dies passiert, wenn der Template-Preprozessor needTemplate === false liefert (Frontmatter valide)
    let templateSkipReason: string | undefined = undefined
    if (templateEnabled && !runTemplate) {
      // v2-only: Keine Legacy-Adoption/Reparatur in Phase A.
      // Wenn v2-Artefakte fehlen, soll das bewusst sichtbar bleiben.
      templateSkipReason = 'preprocess_frontmatter_valid'
      
      try {
        await repo.updateStep(jobId, 'transform_template', {
          status: 'completed',
          endedAt: new Date(),
          details: { skipped: true, reason: templateSkipReason, needTemplate: false },
        })
      } catch {}
    }
    
    // Logging nur bei unerwarteten Situationen (z.B. Gate gefunden, aber trotzdem ausgeführt)
    
    // Wenn Gate gefunden wurde, aber trotzdem ausgeführt wird (z.B. force), logge Warnung
    if (extractGateExists && runExtract && extractDirective !== 'force') {
      FileLogger.warn('start-route', 'Extract wird ausgeführt trotz vorhandenem Shadow-Twin', {
        jobId,
        extractGateExists,
        extractDirective,
        shouldRunExtractPhase
      })
    }

    if (runIngestOnly) {
      try { await repo.updateStep(jobId, extractStepName, { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }

      // Shadow-Twin-Markdown-Datei laden (v2-only)
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'Shadow‑Twin nicht gefunden' } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'shadow_twin_missing', message: 'Shadow‑Twin nicht gefunden' } })
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }
      
      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)

      // Ingest-Phase ausführen
      const ctx2: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      const ingestResult = await runIngestPhase({
        ctx: ctx2,
        provider,
        repo,
        markdown: shadowTwinData.markdown,
        meta: shadowTwinData.meta,
        savedItemId: shadowTwinData.fileId,
        policies: { ingest: phasePolicies.ingest as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
      })

      if (ingestResult.error) {
        await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: ingestResult.error } })
        return NextResponse.json({ error: ingestResult.error }, { status: 500 })
      }

      if (ingestResult.completed) {
        // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
        // Ingest-Only: Nach erfolgreicher Ingestion ist der Shadow-Twin vollständig
        try {
          const updatedJob = await repo.get(jobId)
          if (updatedJob?.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...updatedJob.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
            FileLogger.info('start-route', 'Shadow-Twin-State nach Ingestion auf ready gesetzt', { jobId })
          }
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States nach Ingestion', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
          // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
        }
        
        const completed = await setJobCompleted({ ctx: ctx2, result: { savedItemId: shadowTwinData.fileId } })
        getJobEventBus().emitUpdate(job.userEmail, { 
          type: 'job_update', 
          jobId, 
          status: 'completed', 
          progress: 100, 
          updatedAt: new Date().toISOString(), 
          message: 'completed', 
          jobType: job.job_type, 
          fileName: job.correlation?.source?.name, 
          sourceItemId: job.correlation?.source?.itemId, 
          libraryId: job.libraryId,
          result: { savedItemId: shadowTwinData.fileId },
          shadowTwinFolderId: job.shadowTwinState?.shadowTwinFolderId || null,
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      }

      return NextResponse.json({ ok: true, jobId, kind: 'ingest_only', skipped: ingestResult.skipped })
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      // Markiere Extract-Step als skipped, wenn Extract übersprungen wurde (Gate oder Phase deaktiviert)
      // WICHTIG: Dies muss auch hier passieren, wenn Template ausgeführt wird
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // WICHTIG: Job-Objekt neu laden, damit shadowTwinState sicher vorhanden ist.
      // Ohne Reload sieht loadShadowTwinMarkdown u.U. kein shadowTwinState und sucht "blind" im Storage.
      const refreshedJob = await repo.get(jobId)

      // Shadow-Twin-Markdown-Datei laden (bevorzugt shadowTwinState.transformed.id)
      const ctxPre: RequestContext = { request, jobId, job: refreshedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        // Job als failed markieren, da Shadow-Twin nicht gefunden wurde
        try {
          await repo.updateStep(jobId, 'transform_template', {
            status: 'failed',
            endedAt: new Date(),
            error: { message: 'Shadow‑Twin nicht gefunden' }
          })
          await repo.setStatus(jobId, 'failed', {
            error: { code: 'shadow_twin_not_found', message: 'Shadow‑Twin nicht gefunden' }
          })
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Markieren des Jobs als failed', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }

      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)
      
      // Library-Config für Template-Auswahl laden
      let libraryConfig: LibraryChatConfig | undefined = undefined
      try {
        const libraryService = LibraryService.getInstance()
        const email = userEmail || job.userEmail
        const library = await libraryService.getLibrary(email, job.libraryId)
        libraryConfig = library?.config?.chat
      } catch (error) {
        FileLogger.warn('start-route', 'Fehler beim Laden der Library-Config', {
          jobId,
          libraryId: job.libraryId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Nicht kritisch - Template-Auswahl kann auch ohne Config funktionieren
      }

      // Target-Parent-ID bestimmen (Shadow-Twin-Folder oder Parent)
      // WICHTIG: Job-Objekt neu laden, um aktuelles Shadow-Twin-State zu erhalten
      // Das Shadow-Twin-State wurde beim Job-Start analysiert und gespeichert
      const updatedJob = await repo.get(jobId)
      const shadowTwinFolderId = updatedJob?.shadowTwinState?.shadowTwinFolderId || shadowTwinState?.shadowTwinFolderId
      const targetParentId = shadowTwinFolderId || job.correlation?.source?.parentId || 'root'

      // Template-Phase ausführen
      // WICHTIG: Aktualisiertes Job-Objekt verwenden, damit runTemplatePhase das aktuelle Shadow-Twin-State sieht
      const ctxPreUpdated: RequestContext = { request, jobId, job: updatedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const extractedText = stripAllFrontmatter(shadowTwinData.markdown)
      const templateResult = await runTemplatePhase({
        ctx: ctxPreUpdated,
        provider,
        repo,
        extractedText,
        bodyMetadata: shadowTwinData.meta,
        policies: { metadata: phasePolicies.metadata as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
        autoSkip: true,
        imagesPhaseEnabled: false, // Template-Only: keine Bilder verarbeiten
        targetParentId,
        libraryConfig,
      })

      if (templateResult.status === 'failed') {
        const errorMessage = templateResult.errorMessage || 'Template-Phase fehlgeschlagen'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
      }

      // v2-only: Keine Legacy-Cleanup/Reparatur in Phase A.

      // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
      // Template-Only: Nach erfolgreichem Template-Lauf ist der Shadow-Twin vollständig
      try {
        const updatedJob = await repo.get(jobId)
        if (updatedJob?.shadowTwinState) {
          const mongoState = toMongoShadowTwinState({
            ...updatedJob.shadowTwinState,
            processingStatus: 'ready' as const,
          })
          await repo.setShadowTwinState(jobId, mongoState)
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
      })
        // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
      }

      // Job als completed markieren (Template-Only: keine weiteren Phasen)
      const { setJobCompleted } = await import('@/lib/external-jobs/complete')
      await setJobCompleted({
        ctx: ctxPreUpdated,
        result: {},
      })

      return NextResponse.json({ ok: true, jobId, kind: 'template_only' })
    }

    // Secretary-Flow (Extract/Template)
    const secret = (await import('crypto')).randomBytes(24).toString('base64url')
    const secretHash = repo.hashSecret(secret)
    // WICHTIG:
    // Wir setzen Status+Hash idempotent, aber blockieren Start-Requests NICHT.
    // Duplicate-Handling erfolgt über Logging/Root-Cause-Fix (Worker/Client).
    try {
      await repo.setStatus(jobId, 'running', { jobSecretHash: secretHash })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Setzen des Status und Hash', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'status_update_error', message: 'Fehler beim Setzen des Status' } })
      return NextResponse.json({ error: 'Fehler beim Setzen des Status' }, { status: 500 })
    }

    // WICHTIG: Request nur senden, wenn Extract ausgeführt werden soll
    if (!runExtract) {
      FileLogger.info('start-route', 'Extract-Phase übersprungen - kein Request an Secretary Service', {
      jobId,
        extractGateExists,
        extractGateReason,
        extractDirective,
        shouldRunExtractPhase,
        runExtract
      })

      // Watchdog explizit stoppen, da kein externer Worker-Callback mehr erwartet wird.
      // Andernfalls würde der Watchdog den Job fälschlicherweise nach Timeout auf "failed" setzen.
      try {
        clearWatchdog(jobId)
      } catch {}
      
      // Markiere Extract-Step als skipped
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // Wenn auch Template und Ingest übersprungen werden, Job als completed markieren
      if (!runTemplate && !runIngestOnly) {
        // Extract-Only-Modus: Extract wurde übersprungen (Gate), Template/Ingest deaktiviert
        // Trace-Event für Validator hinzufügen
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'extract',
            name: 'extract_only_mode',
            attributes: {
              message: 'Extract-Only Modus aktiviert (Extract übersprungen via Gate)',
              skipped: true,
              reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            },
          })
        } catch {
          // Trace-Fehler nicht kritisch
        }

        // Template- und Ingest-Phase sind über Phasen-Konfiguration deaktiviert.
        // Für eine konsistente Statuskommunikation müssen die Steps explizit als
        // "skipped" markiert werden. WICHTIG: Wenn Template bereits einen Reason hat
        // (z.B. legacy_markdown_adopted), diesen nicht überschreiben.
        try {
          const currentStep = job.steps?.find(s => s?.name === 'transform_template')
          const currentReason = currentStep?.details && typeof currentStep.details === 'object' && 'reason' in currentStep.details
            ? String(currentStep.details.reason)
            : undefined
          
          // Nur überschreiben, wenn noch kein Reason gesetzt wurde
          if (!currentReason || currentReason === 'pending') {
            await repo.updateStep(jobId, 'transform_template', {
              status: 'completed',
              endedAt: new Date(),
              details: {
                skipped: true,
                reason: templateSkipReason || 'phase_disabled',
              },
            })
          }
        } catch {}
        try {
          await repo.updateStep(jobId, 'ingest_rag', {
            status: 'completed',
            endedAt: new Date(),
            details: {
              skipped: true,
              reason: 'phase_disabled',
            },
          })
        } catch {}

        // Shadow-Twin-State auf "ready" setzen, falls bereits vorhanden.
        // Auch wenn keine neuen Artefakte erzeugt wurden, signalisiert dies,
        // dass der Job abgeschlossen ist und ein existierender Shadow-Twin
        // für die Anzeige verwendet werden kann.
        // WICHTIG: Verwende toMongoShadowTwinState für korrekte Konvertierung
        try {
          if (job.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...job.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
        } else {
            // Falls kein Shadow-Twin-State existiert, aber ein Shadow-Twin-Verzeichnis vorhanden ist,
            // analysiere es und setze den Status auf "ready"
            if (job.correlation?.source?.itemId && library) {
              try {
                const { analyzeShadowTwin } = await import('@/lib/shadow-twin/analyze-shadow-twin')
                const shadowTwinState = await analyzeShadowTwin(job.correlation.source.itemId, provider)
                if (shadowTwinState) {
                  const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
                  const mongoState = toMongoShadowTwinState({
                    ...shadowTwinState,
                    processingStatus: 'ready' as const,
                  })
                  await repo.setShadowTwinState(jobId, mongoState)
                }
              } catch {
                // Fehler bei Shadow-Twin-Analyse nicht kritisch
              }
            }
          }
        } catch {
          // Fehler bei Status-Aktualisierung nicht kritisch
        }

        const completed = await setJobCompleted({ 
          ctx: { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }, 
          result: {} 
        })
        getJobEventBus().emitUpdate(job.userEmail, {
          type: 'job_update',
        jobId,
          status: 'completed',
          progress: 100,
          updatedAt: new Date().toISOString(),
          message: 'completed (all phases skipped)',
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
          libraryId: job.libraryId
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'all_phases_skipped' })
      }
      
      // Wenn nur Extract übersprungen wird, aber Template/Ingest laufen sollen, return
      // (Template-only Flow wird oben bereits behandelt)
      return NextResponse.json({ ok: true, jobId, kind: 'extract_skipped' })
    }

    // Bereite Secretary-Service-Request vor
    const requestConfig = prepareSecretaryRequest(job, file, callbackUrl, secret)
    const { url, formData: formForRequest, headers } = requestConfig
    
    FileLogger.info('start-route', 'Sende Request an Secretary Service', {
      jobId,
      url,
      method: 'POST',
      hasApiKey: !!requestConfig.headers['Authorization']
    });
    
    let resp: Response
    try {
      resp = await fetch(url, { method: 'POST', body: formForRequest, headers })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Senden des Requests an Secretary Service', {
        jobId,
        url,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'fetch_error', message: 'Fehler beim Senden des Requests' } })
      return NextResponse.json({ error: 'Fehler beim Senden des Requests' }, { status: 500 })
    }
    
    FileLogger.info('start-route', 'Secretary Service Antwort erhalten', {
      jobId,
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      headers: Object.fromEntries(resp.headers.entries())
    });
    
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'preprocess',
        name: 'request_ack',
        attributes: {
          status: resp.status,
          statusText: resp.statusText,
          url,
          extractionMethod,
          // Duplicate-Diagnose:
          startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
          workerId: request.headers.get('x-worker-id') || undefined,
          workerTickId: request.headers.get('x-worker-tick-id') || undefined,
          pid: process.pid,
        },
      })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Hinzufügen des Trace-Events', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Trace-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }

    // UX: Step sofort auf "running" setzen, sobald der Request zum Worker ack'ed wurde.
    // Ohne dieses Update bleibt der Step in der UI lange auf "pending", obwohl der Job bereits läuft
    // und nur auf den Callback wartet.
    try {
      await repo.updateStep(jobId, extractStepName, { status: 'running', startedAt: new Date() })
    } catch {}
    // Status wurde bereits VOR dem Request gesetzt (siehe Zeile 360)
    // Hash wurde bereits gespeichert, damit Callbacks korrekt validiert werden können
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Keine Fehlermeldung');
      FileLogger.error('start-route', 'Secretary Service Fehler', {
        jobId,
        status: resp.status,
        statusText: resp.statusText,
        errorText,
        url
      });
      await repo.setStatus(jobId, 'failed', { error: { code: 'secretary_error', message: errorText, details: { status: resp.status, statusText: resp.statusText } } })
      return NextResponse.json({ error: 'Secretary Fehler', status: resp.status, details: errorText }, { status: 502 })
    }
    const data = await resp.json().catch((err) => {
      FileLogger.error('start-route', 'Fehler beim Parsen der Response', {
        jobId,
        error: err instanceof Error ? err.message : String(err)
      });
      return {};
    })
    
    FileLogger.info('start-route', 'Secretary Service Response erfolgreich', {
      jobId,
      hasData: !!data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      status: (data as { status?: string })?.status
    });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'enqueued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, libraryId: job.libraryId })
    // Watchdog wurde bereits beim Start gestartet - nur aktualisieren (bump)
    // Dies stellt sicher, dass der Timer zurückgesetzt wird, wenn der Request erfolgreich war
    try {
      bumpWatchdog(jobId, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Aktualisieren des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    return NextResponse.json({ ok: true, jobId, data })
  } catch (err) {
    // WICHTIG: Bei Fehlern Status auf 'failed' setzen, damit Job nicht hängen bleibt
    const errorMessage = err instanceof Error ? err.message : 'Unerwarteter Fehler'
    try {
      // Versuche Job zu laden für Kontext
      const jobForError = await repo.get(jobId).catch(() => null)
      if (jobForError) {
        await handleJobError(err, {
        jobId,
          userEmail: jobForError.userEmail,
          jobType: jobForError.job_type,
          fileName: jobForError.correlation?.source?.name,
          sourceItemId: jobForError.correlation?.source?.itemId,
        }, repo, 'start_error')
      } else {
        // Fallback: Nur Status setzen ohne vollständigen Kontext
        await repo.setStatus(jobId, 'failed', { error: { code: 'start_error', message: errorMessage } })
      }
    } catch {
      // Fehler beim Error-Handling nicht weiter propagieren
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



```

Aktualisiere die Client-Komponenten:


```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", "native")
  fd.append("useCache", "true")
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault("de"))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(args.libraryId, loadPdfDefaults(args.libraryId), {})
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault("de"))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
    const targetLanguage = typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT;
    
    // Nutze zentrale buildArtifactName() Logik für Dateinamen-Generierung
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage,
    };
    const fileName = buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
    
    const base: PdfTransformOptions = {
      targetLanguage,
      fileName,
      createShadowTwin: true,
      fileExtension: 'md',
      // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
      useCache: defaults.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
      includeOcrImages: defaults.includeOcrImages,
      includePageImages: defaults.includePageImages,
      includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    const policies = {
      extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
      metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
      ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
    } as import('@/lib/processing/phase-policy').PhasePolicies;
    return {
      ...base,
      policies,
    } as PdfTransformOptions;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean) {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

```typescriptreact
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TransformService, TransformResult, PdfTransformOptions } from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { FileLogger } from "@/lib/debug/logger"
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PdfTransformProps {
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function PdfTransform({ onTransformComplete, onRefreshFolder }: PdfTransformProps) {
  const item = useAtomValue(selectedFileAtom);
  const [isLoading, setIsLoading] = useState(false);
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  const [templateOptions, setTemplateOptions] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  
  // Generiere Shadow-Twin Dateinamen nach Konvention
  // Nutze zentrale buildArtifactName() Logik (wird in TransformService verwendet)
  
  const defaultLanguage = "de";
  
  // Generiere Dateinamen mit zentraler Logik
  const getInitialFileName = (): string => {
    if (!item) return '';
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage: defaultLanguage,
    };
    return buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
  };
  
  const [saveOptions, setSaveOptions] = useState<PdfTransformOptions>({
    targetLanguage: defaultLanguage,
    fileName: getInitialFileName(),
    createShadowTwin: true,
    fileExtension: "md",
    extractionMethod: "mistral_ocr", // Globaler Default: mistral_ocr
    useCache: true, // Standardwert: Cache verwenden
    includeOcrImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includePageImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includeImages: false, // Rückwärtskompatibilität
    useIngestionPipeline: false,
    template: undefined
  });

  // Lade Templates aus MongoDB und setze Default (pdfanalyse > erstes Template)
  const loadTemplates = useCallback(async () => {
    if (!activeLibrary?.id) return;
    try {
      setIsLoadingTemplates(true);
      // Verwende zentrale Client-Library für MongoDB-Templates
      const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
      const templateNames = await listAvailableTemplates(activeLibrary.id)
      setTemplateOptions(templateNames);

      // Default bestimmen: pdfanalyse > erstes Template
      const preferred = templateNames.find((n: string) => n.toLowerCase() === 'pdfanalyse');
      const chosen = preferred || templateNames[0] || undefined;
      setSaveOptions(prev => ({ ...prev, template: chosen }));
    } catch (e) {
      FileLogger.warn('PdfTransform', 'Templates konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) });
      setTemplateOptions([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [activeLibrary?.id]);

  // Templates laden bei Library-Wechsel
  useEffect(() => {
    void loadTemplates();
  }, [activeLibrary?.id, loadTemplates]);
  
  // Prüfe ob item vorhanden ist
  if (!item) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center text-muted-foreground">
        Keine PDF-Datei ausgewählt
      </div>
    );
  }
  
  const handleTransform = async () => {
    FileLogger.info('PdfTransform', 'handleTransform aufgerufen mit saveOptions', saveOptions as unknown as Record<string, unknown>);
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }

    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Aktive Bibliothek nicht gefunden",
        duration: 7000
      });
      return;
    }
    setIsLoading(true);

    try {
      // Datei vom Server laden
      const { blob } = await provider.getBinary(item.id);
      if (!blob) {
        throw new Error("Datei konnte nicht geladen werden");
      }

      // Konvertiere Blob zu File für die Verarbeitung
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Transformiere die PDF-Datei mit dem TransformService
      const result = await TransformService.transformPdf(
        file,
        item,
        saveOptions,
        provider,
        refreshItems,
        activeLibrary.id
      );

      FileLogger.info('PdfTransform', 'PDF Transformation abgeschlossen', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length
      });

      // Asynchroner Fall: Side-Panel sofort via lokalem Event informieren (Fallback, falls SSE spät verbindet)
      if (!result.text && !result.savedItem && result.jobId) {
        try {
          window.dispatchEvent(new CustomEvent('job_update_local', {
            detail: {
              jobId: result.jobId,
              status: 'queued',
              message: 'queued',
              progress: 0,
              jobType: 'pdf',
              fileName: item.metadata.name,
              updatedAt: new Date().toISOString()
            }
          }));
        } catch {}
        return;
      }

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && item.parentId && result.updatedItems.length > 0) {
        FileLogger.info('PdfTransform', 'Informiere Library über aktualisierte Dateiliste', {
          folderId: item.parentId,
          itemsCount: result.updatedItems.length,
          savedItemId: result.savedItem?.id
        });
        onRefreshFolder(item.parentId, result.updatedItems, result.savedItem || undefined);
      } else {
        // Wenn kein onRefreshFolder-Handler da ist, rufen wir selbst den handleTransformResult auf
        transformResultHandlerRef.current(result);
      }
      
      // Falls onTransformComplete-Callback existiert, auch für Abwärtskompatibilität aufrufen
      if (onTransformComplete) {
        onTransformComplete(result.text, result.savedItem || undefined, result.updatedItems);
      }
    } catch (error) {
      FileLogger.error('PdfTransform', 'Fehler bei der PDF-Transformation', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler bei der PDF-Verarbeitung'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    FileLogger.debug('PdfTransform', 'handleSaveOptionsChange aufgerufen mit', options as unknown as Record<string, unknown>);
    // Konvertiere zu PdfTransformOptions mit sicherer extractionMethod und useCache
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = options.extractionMethod === 'mistral_ocr';
    const pdfOptions: PdfTransformOptions = {
      ...options,
      extractionMethod: options.extractionMethod || "native",
      useCache: options.useCache ?? true, // Standardwert: Cache verwenden
      includeOcrImages: options.includeOcrImages !== undefined 
        ? options.includeOcrImages 
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includePageImages: options.includePageImages !== undefined
        ? options.includePageImages
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includeImages: options.includeImages ?? false // Rückwärtskompatibilität
    };
    FileLogger.debug('PdfTransform', 'useCache Wert:', { useCache: pdfOptions.useCache });
    setSaveOptions(pdfOptions);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('PdfTransform', 'PDF-Transformation vollständig abgeschlossen und Datei ausgewählt');
        }}
        childrenAction={(handleTransformResult: (result: TransformResult) => void, isProcessingResult: boolean) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          
          return (
            <>
              <SaveOptionsComponent 
                originalFileName={item.metadata.name}
                onOptionsChangeAction={handleSaveOptionsChange}
                className="mb-4"
                showExtractionMethod={true}
                defaultExtractionMethod="native"
                showUseCache={true}
                defaultUseCache={true}
                showIncludeOcrImages={true}
                showIncludePageImages={true}
                defaultIncludeOcrImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                defaultIncludePageImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                showIncludeImages={false} // Deprecated, verwende showIncludeOcrImages/showIncludePageImages
                defaultIncludeImages={false}
                showCreateShadowTwin={false}
              />

              <div className="flex items-center gap-2 mb-2">
                <input
                  id="useIngestionPipeline"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!saveOptions.useIngestionPipeline}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, useIngestionPipeline: e.target.checked }))}
                />
                <label htmlFor="useIngestionPipeline" className="text-sm text-muted-foreground">
                  Use Ingestion Pipeline (Template→MD→RAG automatisch)
                </label>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="templateName" className="text-sm text-muted-foreground w-40">Template (erforderlich)</label>
                <select
                  id="templateName"
                  className="flex-1 h-8 rounded border bg-background px-2 text-sm"
                  value={saveOptions.template || ''}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, template: e.target.value || undefined }))}
                  disabled={isLoadingTemplates}
                >
                  {templateOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird verarbeitet..." : "PDF verarbeiten"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 
```

```typescriptreact
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TransformService, TransformResult, PdfTransformOptions } from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { FileLogger } from "@/lib/debug/logger"
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PdfTransformProps {
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function PdfTransform({ onTransformComplete, onRefreshFolder }: PdfTransformProps) {
  const item = useAtomValue(selectedFileAtom);
  const [isLoading, setIsLoading] = useState(false);
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  const [templateOptions, setTemplateOptions] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  
  // Generiere Shadow-Twin Dateinamen nach Konvention
  // Nutze zentrale buildArtifactName() Logik (wird in TransformService verwendet)
  
  const defaultLanguage = "de";
  
  // Generiere Dateinamen mit zentraler Logik
  const getInitialFileName = (): string => {
    if (!item) return '';
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage: defaultLanguage,
    };
    return buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
  };
  
  const [saveOptions, setSaveOptions] = useState<PdfTransformOptions>({
    targetLanguage: defaultLanguage,
    fileName: getInitialFileName(),
    createShadowTwin: true,
    fileExtension: "md",
    extractionMethod: "mistral_ocr", // Globaler Default: mistral_ocr
    useCache: true, // Standardwert: Cache verwenden
    includeOcrImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includePageImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includeImages: false, // Rückwärtskompatibilität
    useIngestionPipeline: false,
    template: undefined
  });

  // Lade Templates aus MongoDB und setze Default (pdfanalyse > erstes Template)
  const loadTemplates = useCallback(async () => {
    if (!activeLibrary?.id) return;
    try {
      setIsLoadingTemplates(true);
      // Verwende zentrale Client-Library für MongoDB-Templates
      const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
      const templateNames = await listAvailableTemplates(activeLibrary.id)
      setTemplateOptions(templateNames);

      // Default bestimmen: pdfanalyse > erstes Template
      const preferred = templateNames.find((n: string) => n.toLowerCase() === 'pdfanalyse');
      const chosen = preferred || templateNames[0] || undefined;
      setSaveOptions(prev => ({ ...prev, template: chosen }));
    } catch (e) {
      FileLogger.warn('PdfTransform', 'Templates konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) });
      setTemplateOptions([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [activeLibrary?.id]);

  // Templates laden bei Library-Wechsel
  useEffect(() => {
    void loadTemplates();
  }, [activeLibrary?.id, loadTemplates]);
  
  // Prüfe ob item vorhanden ist
  if (!item) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center text-muted-foreground">
        Keine PDF-Datei ausgewählt
      </div>
    );
  }
  
  const handleTransform = async () => {
    FileLogger.info('PdfTransform', 'handleTransform aufgerufen mit saveOptions', saveOptions as unknown as Record<string, unknown>);
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }

    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Aktive Bibliothek nicht gefunden",
        duration: 7000
      });
      return;
    }
    setIsLoading(true);

    try {
      // Datei vom Server laden
      const { blob } = await provider.getBinary(item.id);
      if (!blob) {
        throw new Error("Datei konnte nicht geladen werden");
      }

      // Konvertiere Blob zu File für die Verarbeitung
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Transformiere die PDF-Datei mit dem TransformService
      const result = await TransformService.transformPdf(
        file,
        item,
        saveOptions,
        provider,
        refreshItems,
        activeLibrary.id
      );

      FileLogger.info('PdfTransform', 'PDF Transformation abgeschlossen', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length
      });

      // Asynchroner Fall: Side-Panel sofort via lokalem Event informieren (Fallback, falls SSE spät verbindet)
      if (!result.text && !result.savedItem && result.jobId) {
        try {
          window.dispatchEvent(new CustomEvent('job_update_local', {
            detail: {
              jobId: result.jobId,
              status: 'queued',
              message: 'queued',
              progress: 0,
              jobType: 'pdf',
              fileName: item.metadata.name,
              updatedAt: new Date().toISOString()
            }
          }));
        } catch {}
        return;
      }

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && item.parentId && result.updatedItems.length > 0) {
        FileLogger.info('PdfTransform', 'Informiere Library über aktualisierte Dateiliste', {
          folderId: item.parentId,
          itemsCount: result.updatedItems.length,
          savedItemId: result.savedItem?.id
        });
        onRefreshFolder(item.parentId, result.updatedItems, result.savedItem || undefined);
      } else {
        // Wenn kein onRefreshFolder-Handler da ist, rufen wir selbst den handleTransformResult auf
        transformResultHandlerRef.current(result);
      }
      
      // Falls onTransformComplete-Callback existiert, auch für Abwärtskompatibilität aufrufen
      if (onTransformComplete) {
        onTransformComplete(result.text, result.savedItem || undefined, result.updatedItems);
      }
    } catch (error) {
      FileLogger.error('PdfTransform', 'Fehler bei der PDF-Transformation', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler bei der PDF-Verarbeitung'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    FileLogger.debug('PdfTransform', 'handleSaveOptionsChange aufgerufen mit', options as unknown as Record<string, unknown>);
    // Konvertiere zu PdfTransformOptions mit sicherer extractionMethod und useCache
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = options.extractionMethod === 'mistral_ocr';
    const pdfOptions: PdfTransformOptions = {
      ...options,
      // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
      extractionMethod: options.extractionMethod || "mistral_ocr",
      useCache: options.useCache ?? true, // Standardwert: Cache verwenden
      // Bei Mistral OCR: includePageImages immer true (erzwungen)
      includePageImages: options.includePageImages !== undefined
        ? options.includePageImages
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includeOcrImages: options.includeOcrImages !== undefined 
        ? options.includeOcrImages 
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includeImages: options.includeImages ?? false // Rückwärtskompatibilität
    };
    FileLogger.debug('PdfTransform', 'useCache Wert:', { useCache: pdfOptions.useCache });
    setSaveOptions(pdfOptions);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('PdfTransform', 'PDF-Transformation vollständig abgeschlossen und Datei ausgewählt');
        }}
        childrenAction={(handleTransformResult: (result: TransformResult) => void, isProcessingResult: boolean) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          
          return (
            <>
              <SaveOptionsComponent 
                originalFileName={item.metadata.name}
                onOptionsChangeAction={handleSaveOptionsChange}
                className="mb-4"
                showExtractionMethod={true}
                defaultExtractionMethod="native"
                showUseCache={true}
                defaultUseCache={true}
                showIncludeOcrImages={true}
                showIncludePageImages={true}
                defaultIncludeOcrImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                defaultIncludePageImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                showIncludeImages={false} // Deprecated, verwende showIncludeOcrImages/showIncludePageImages
                defaultIncludeImages={false}
                showCreateShadowTwin={false}
              />

              <div className="flex items-center gap-2 mb-2">
                <input
                  id="useIngestionPipeline"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!saveOptions.useIngestionPipeline}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, useIngestionPipeline: e.target.checked }))}
                />
                <label htmlFor="useIngestionPipeline" className="text-sm text-muted-foreground">
                  Use Ingestion Pipeline (Template→MD→RAG automatisch)
                </label>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="templateName" className="text-sm text-muted-foreground w-40">Template (erforderlich)</label>
                <select
                  id="templateName"
                  className="flex-1 h-8 rounded border bg-background px-2 text-sm"
                  value={saveOptions.template || ''}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, template: e.target.value || undefined }))}
                  disabled={isLoadingTemplates}
                >
                  {templateOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird verarbeitet..." : "PDF verarbeiten"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import { hasInternalTokenBypass } from '@/lib/external-jobs/auth'

export async function POST(request: NextRequest) {
  try {
    if (!hasInternalTokenBypass(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : 'root'
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'test.pdf'
    const itemId = typeof body.itemId === 'string' ? body.itemId : undefined
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/pdf'
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail : 'test@example.com'
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof body.extractionMethod === 'string' ? body.extractionMethod : 'mistral_ocr'
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = body.includePageImages !== undefined
      ? Boolean(body.includePageImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeOcrImages = body.includeOcrImages !== undefined
      ? Boolean(body.includeOcrImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includePageImages = body.includePageImages !== undefined
      ? Boolean(body.includePageImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeImages = Boolean(body.includeImages) // Rückwärtskompatibilität

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const correlation = {
      jobId,
      libraryId,
      source: { mediaType: 'pdf', mimeType, name: fileName, parentId, itemId },
      options: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    } satisfies ExternalJob['correlation']

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { name: 'extract_pdf', status: 'completed', startedAt: new Date(), endedAt: new Date() },
        { name: 'transform_template', status: 'pending' },
        { name: 'store_shadow_twin', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      parameters: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    }
    await repo.create(job)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const callbackUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : `/api/external/jobs/${jobId}`

    return NextResponse.json({ jobId, callbackUrl, jobSecret }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}




```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import { hasInternalTokenBypass } from '@/lib/external-jobs/auth'

export async function POST(request: NextRequest) {
  try {
    if (!hasInternalTokenBypass(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : 'root'
    const fileName = typeof body.fileName === 'string' ? body.fileName : 'test.pdf'
    const itemId = typeof body.itemId === 'string' ? body.itemId : undefined
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'application/pdf'
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail : 'test@example.com'
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof body.extractionMethod === 'string' ? body.extractionMethod : 'mistral_ocr'
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = body.includePageImages !== undefined
      ? Boolean(body.includePageImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeOcrImages = body.includeOcrImages !== undefined
      ? Boolean(body.includeOcrImages)
      : (isMistralOcr ? true : undefined); // Standard: true für Mistral OCR
    const includeImages = Boolean(body.includeImages) // Rückwärtskompatibilität

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const correlation = {
      jobId,
      libraryId,
      source: { mediaType: 'pdf', mimeType, name: fileName, parentId, itemId },
      options: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    } satisfies ExternalJob['correlation']

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { name: 'extract_pdf', status: 'completed', startedAt: new Date(), endedAt: new Date() },
        { name: 'transform_template', status: 'pending' },
        { name: 'store_shadow_twin', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      parameters: { 
        targetLanguage, 
        extractionMethod, 
        includeOcrImages, 
        includePageImages, 
        includeImages // Rückwärtskompatibilität
      }
    }
    await repo.create(job)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const callbackUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : `/api/external/jobs/${jobId}`

    return NextResponse.json({ jobId, callbackUrl, jobSecret }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}




```

Prüfe die verbleibenden Stellen und aktualisiere sie:


```typescriptreact
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState, useEffect } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { mergeTemplateNames } from "@/lib/templates/template-options"

// Formular-Schema mit Validierung
const secretaryServiceFormSchema = z.object({
  // Optional: Wenn gesetzt, muss es eine gültige URL sein
  apiUrl: z.string().url({ message: "Bitte geben Sie eine gültige URL ein." }).optional(),
  // Optional: Leer lassen → ENV verwenden
  apiKey: z.string().optional(),
  pdfExtractionMethod: z.enum([
    'native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'
  ]).optional(),
  pdfTemplate: z.string().optional(),
})

type SecretaryServiceFormValues = z.infer<typeof secretaryServiceFormSchema>

export function SecretaryServiceForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [availableTemplateNames, setAvailableTemplateNames] = useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  
  // Aktuelle Bibliothek aus dem globalen Zustand
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  
  const form = useForm<SecretaryServiceFormValues>({
    resolver: zodResolver(secretaryServiceFormSchema),
    defaultValues: {
      apiUrl: undefined,
      apiKey: '',
      pdfExtractionMethod: 'native',
      pdfTemplate: '',
    },
  })

  // Form mit aktiver Bibliothek befüllen
  useEffect(() => {
    if (activeLibrary) {
      form.reset({
        apiUrl: activeLibrary.config?.secretaryService?.apiUrl || undefined,
        apiKey: activeLibrary.config?.secretaryService?.apiKey || '',
        pdfExtractionMethod: activeLibrary.config?.secretaryService?.pdfDefaults?.extractionMethod || 'mistral_ocr',
        pdfTemplate: activeLibrary.config?.secretaryService?.pdfDefaults?.template || '',
      })
    }
  }, [activeLibrary, form])

  const currentPdfTemplate = form.watch('pdfTemplate')
  const mergedTemplateNames = mergeTemplateNames({
    templateNames: availableTemplateNames,
    currentTemplateName: currentPdfTemplate,
  })

  const hasMongoTemplates = mergedTemplateNames.length > 0
  const isCurrentTemplateInMongo = !!(currentPdfTemplate || '').trim() && mergedTemplateNames.some(
    (n) => n.toLowerCase() === (currentPdfTemplate || '').trim().toLowerCase()
  )
  const [templateMode, setTemplateMode] = useState<'select' | 'custom'>('select')

  // Wenn die Config einen Wert hat, der (noch) nicht in MongoDB existiert, zeige Custom-Input an.
  useEffect(() => {
    const val = (currentPdfTemplate || '').trim()
    if (!val) {
      setTemplateMode('select')
      return
    }
    setTemplateMode(isCurrentTemplateInMongo ? 'select' : 'custom')
  }, [currentPdfTemplate, isCurrentTemplateInMongo])

  // Templates aus MongoDB laden (für Dropdown)
  useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return
        setIsLoadingTemplates(true)
        const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibraryId)}`)
        if (!response.ok) {
          // Fehler still behandeln: Dropdown bleibt leer, Custom-Input bleibt nutzbar
          if (!cancelled) setAvailableTemplateNames([])
          return
        }
        const data = await response.json()
        const templates = Array.isArray((data as { templates?: unknown }).templates)
          ? (data as { templates: Array<{ name?: unknown }> }).templates
          : []
        const names = templates
          .map((t) => (typeof t?.name === 'string' ? t.name : ''))
          .filter((n) => n.length > 0)
        if (!cancelled) setAvailableTemplateNames(names)
      } catch {
        if (!cancelled) setAvailableTemplateNames([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => { cancelled = true }
  }, [activeLibraryId])

  async function onSubmit(data: SecretaryServiceFormValues) {
    setIsLoading(true)
    
    try {
      if (!activeLibrary) {
        throw new Error("Keine Bibliothek ausgewählt")
      }
      
      // Bibliotheksobjekt aktualisieren
      const updatedLibrary = {
        ...activeLibrary,
        config: {
          ...activeLibrary.config,
          secretaryService: {
            ...(data.apiUrl ? { apiUrl: data.apiUrl } : {}),
            ...(data.apiKey ? { apiKey: data.apiKey } : {}),
            pdfDefaults: {
              extractionMethod: data.pdfExtractionMethod,
              template: data.pdfTemplate?.trim() || undefined,
            }
          }
        }
      }
      
      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedLibrary),
      })
      
      if (!response.ok) {
        throw new Error(`Fehler beim Speichern: ${response.statusText}`)
      }
      
      // Lokalen Zustand aktualisieren
      const updatedLibraries: typeof libraries = libraries.map(lib => {
        if (lib.id !== activeLibrary.id) return lib
        return {
          ...lib,
          config: {
            ...lib.config,
            secretaryService: {
              // Fülle optionale Felder defensiv mit leerem String, damit der Client-Typ stimmt
              apiUrl: data.apiUrl || lib.config?.secretaryService?.apiUrl || '',
              apiKey: data.apiKey || lib.config?.secretaryService?.apiKey || '',
              pdfDefaults: {
                extractionMethod: data.pdfExtractionMethod,
                template: data.pdfTemplate?.trim() || undefined,
              }
            }
          }
        }
      })
      
      setLibraries(updatedLibraries)
      
      toast({
        title: "Secretary Service Einstellungen aktualisiert",
        description: `Die Secretary Service Einstellungen für "${activeLibrary.label}" wurden erfolgreich aktualisiert.`,
      })
      
    } catch (error) {
      console.error('Fehler beim Speichern der Secretary Service Einstellungen:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" autoComplete="off">
        <FormField
          control={form.control}
          name="apiUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API-URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="http://127.0.0.1:5001/api (optional)"
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={e => field.onChange(e.target.value)}
                  autoComplete="off"
                  name="sec-api-url"
                  spellCheck={false}
                  autoCapitalize="none"
                  inputMode="url"
                />
              </FormControl>
              <FormDescription>
                Optional. Leer lassen, um die Umgebungsvariable zu verwenden.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API-Key</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="(optional) API-Key oder leer für ENV"
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={e => field.onChange(e.target.value)}
                  autoComplete="new-password"
                  name="sec-api-key"
                  spellCheck={false}
                  autoCapitalize="none"
                  inputMode="text"
                />
              </FormControl>
              <FormDescription>
                Optional. Leer lassen, um den API-Key aus der Umgebungsvariable zu verwenden.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="pdfExtractionMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PDF-Extraktionsmethode (Default)</FormLabel>
                <FormControl>
                  <select className="border rounded h-9 px-2 w-full" value={field.value || ''} onChange={e => field.onChange(e.target.value)}>
                    {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>
                  Standardwert für neue PDF-Verarbeitungsjobs, falls der Client nichts sendet.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pdfTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template (Default, ohne .md)</FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-2">
                    {templateMode === 'select' ? (
                      <select
                        className="border rounded h-9 px-2 w-full"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => {
                          const next = e.target.value
                          if (next === '__custom__') {
                            setTemplateMode('custom')
                            return
                          }
                          field.onChange(next)
                        }}
                        disabled={isLoadingTemplates && !hasMongoTemplates}
                      >
                        <option value="">{isLoadingTemplates ? 'Lade Templates…' : '(kein Default)'}</option>
                        {mergedTemplateNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="__custom__">Benutzerdefiniert…</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="z. B. pdfanalyse-commoning"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            // Zur Liste zurück: wenn der aktuelle Wert nicht in MongoDB ist, leere Auswahl setzen.
                            const val = (typeof field.value === 'string' ? field.value : '').trim()
                            if (val && !mergedTemplateNames.some((n) => n.toLowerCase() === val.toLowerCase())) {
                              field.onChange('')
                            }
                            setTemplateMode('select')
                          }}
                        >
                          Aus Liste
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Wird in Phase 2 verwendet, wenn kein Template angegeben ist. Die Liste kommt aus MongoDB (Template-Management).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isLoading || !form.formState.isDirty}
          >
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
} 
```

```typescriptreact
"use client";

import * as React from "react";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { loadPdfDefaults, savePdfDefaults } from "@/lib/pdf-defaults";
import { useStorage } from "@/contexts/storage-context";
import { useAtom } from "jotai";
import { pdfOverridesAtom } from "@/atoms/pdf-defaults";
import type { PdfTransformOptions } from "@/lib/transform/transform-service";
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_DEFAULT,
} from "@/lib/chat/constants";
import { useTranslation } from "@/lib/i18n/hooks";

interface PdfPhaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPhaseSettings({ open, onOpenChange }: PdfPhaseSettingsProps) {
  const { t } = useTranslation()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  // provider wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provider: _unused_provider } = useStorage();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [overrides, setOverrides] = useAtom(pdfOverridesAtom);
  const [values, setValues] = React.useState<Partial<PdfTransformOptions>>({});

  React.useEffect(() => {
    if (!activeLibraryId) return;
    const db = loadPdfDefaults(activeLibraryId);
    const ov = overrides[activeLibraryId] || {};
    setValues({ ...db, ...ov });
  }, [activeLibraryId, open, overrides]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return;
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templates = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setTemplates(templates);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [activeLibraryId, open]);

  function update(partial: Partial<PdfTransformOptions>) {
    setValues(prev => ({ ...prev, ...partial }));
  }

  function saveAndClose() {
    if (!activeLibraryId) return onOpenChange(false);
    const defaults: PdfTransformOptions = {
      targetLanguage: typeof values.targetLanguage === 'string' ? values.targetLanguage : TARGET_LANGUAGE_DEFAULT,
      fileName: '',
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof values.extractionMethod === 'string' ? values.extractionMethod : 'mistral_ocr',
      useCache: values.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true
      includeOcrImages: values.extractionMethod === 'mistral_ocr' ? (values.includeOcrImages ?? true) : undefined,
      includePageImages: values.extractionMethod === 'mistral_ocr' ? (values.includePageImages ?? true) : undefined,
      includeImages: values.includeImages ?? false, // Rückwärtskompatibilität
      useIngestionPipeline: values.useIngestionPipeline ?? false,
      template: typeof values.template === 'string' ? values.template : undefined,
    };
    // Speichere in localStorage (persistent)
    savePdfDefaults(activeLibraryId, defaults);
    // Setze auch Runtime-Overrides für diese Session (Vorrang vor DB-Defaults haben Vorrang)
    setOverrides(prev => ({ ...prev, [activeLibraryId]: { extractionMethod: defaults.extractionMethod, template: defaults.template } }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PDF Standardwerte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Zielsprache</Label>
            <Select value={values.targetLanguage || TARGET_LANGUAGE_DEFAULT} onValueChange={(v) => update({ targetLanguage: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_VALUES.map((code) => (
                  <SelectItem key={code} value={code}>{t(`chat.languageLabels.${code}`) || code.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={values.template || ''} onValueChange={(v) => update({ template: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Template wählen" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!values.useCache} onCheckedChange={(c) => update({ useCache: !!c })} />
              Cache verwenden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={values.extractionMethod === 'mistral_ocr' 
                  ? (values.includeOcrImages !== undefined ? values.includeOcrImages : true)
                  : (!!values.includeImages)} 
                onCheckedChange={(c) => {
                  if (values.extractionMethod === 'mistral_ocr') {
                    update({ includeOcrImages: !!c, includePageImages: !!c });
                  } else {
                    update({ includeImages: !!c });
                  }
                }} 
              />
              {values.extractionMethod === 'mistral_ocr' ? 'OCR & Seiten-Bilder extrahieren' : 'Bilder extrahieren'}
            </label>
          </div>
          <div className="space-y-2">
            <Label>Extraktionsmethode</Label>
            <Select value={values.extractionMethod || 'native'} onValueChange={(v) => update({ extractionMethod: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Methode wählen" />
              </SelectTrigger>
              <SelectContent>
                {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={saveAndClose}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



```

```typescriptreact
            <Select value={values.extractionMethod || 'mistral_ocr'} onValueChange={(v) => update({ extractionMethod: v })}>
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { LibraryService } from '@/lib/services/library-service';
import { StorageFactory } from '@/lib/storage/storage-factory';

function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/;
  return markdown.replace(fm, '');
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Kein Benutzer-E-Mail gefunden' }, { status: 401 });

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : '';
    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    const ingest = Boolean(body.ingest);
    if (!libraryId || !fileId) return NextResponse.json({ error: 'libraryId und fileId erforderlich' }, { status: 400 });

    // Markdown laden (provider-agnostisch)
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined);
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 });

    let markdown = '';
    const factory = StorageFactory.getInstance();
    factory.setLibraries([{ id: lib.id, label: lib.label, type: lib.type, path: lib.path, isEnabled: lib.isEnabled, config: (lib.config as unknown as Record<string, unknown>) || {} }]);
    const provider = await factory.getProvider(lib.id);
    const bin = await provider.getBinary(fileId);
    markdown = await bin.blob.text();

    const extractedText = stripFrontmatter(markdown);

    // Internen Job erstellen (ohne PDF-Extraktion) – reuse bestehende Callback-Logik
    const internalToken = process.env.INTERNAL_TEST_TOKEN || '';
    if (!internalToken) return NextResponse.json({ error: 'INTERNAL_TEST_TOKEN nicht konfiguriert' }, { status: 500 });

    const createRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''}/api/external/jobs/internal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ libraryId, parentId: 'root', fileName: 'shadow-twin.md', userEmail: '', targetLanguage: 'de', extractionMethod: 'mistral_ocr', includeImages: false })
    });
    if (!createRes.ok) {
      const t = await createRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Job konnte nicht erstellt werden: ${t}` }, { status: 500 });
    }
    const { jobId, callbackUrl } = await createRes.json() as { jobId: string; callbackUrl: string };

    // useIngestionPipeline optional setzen
    if (ingest) {
      const repo = new ExternalJobsRepository();
      await repo.mergeParameters(jobId, { useIngestionPipeline: true });
    }

    // Callback direkt füttern – nur Template/Store Pfade werden greifen
    const cbRes = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ data: { extracted_text: extractedText } })
    });
    if (!cbRes.ok) {
      const t = await cbRes.text().catch(() => 'Fehler');
      return NextResponse.json({ error: `Callback fehlgeschlagen: ${t}` }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { loadPdfDefaults, savePdfDefaults } from "@/lib/pdf-defaults";
import { useStorage } from "@/contexts/storage-context";
import { useAtom } from "jotai";
import { pdfOverridesAtom } from "@/atoms/pdf-defaults";
import type { PdfTransformOptions } from "@/lib/transform/transform-service";
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_DEFAULT,
} from "@/lib/chat/constants";
import { useTranslation } from "@/lib/i18n/hooks";

interface PdfPhaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPhaseSettings({ open, onOpenChange }: PdfPhaseSettingsProps) {
  const { t } = useTranslation()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  // provider wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provider: _unused_provider } = useStorage();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [overrides, setOverrides] = useAtom(pdfOverridesAtom);
  const [values, setValues] = React.useState<Partial<PdfTransformOptions>>({});

  React.useEffect(() => {
    if (!activeLibraryId) return;
    const db = loadPdfDefaults(activeLibraryId);
    const ov = overrides[activeLibraryId] || {};
    setValues({ ...db, ...ov });
  }, [activeLibraryId, open, overrides]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return;
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templates = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setTemplates(templates);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [activeLibraryId, open]);

  function update(partial: Partial<PdfTransformOptions>) {
    setValues(prev => ({ ...prev, ...partial }));
  }

  function saveAndClose() {
    if (!activeLibraryId) return onOpenChange(false);
    const defaults: PdfTransformOptions = {
      targetLanguage: typeof values.targetLanguage === 'string' ? values.targetLanguage : TARGET_LANGUAGE_DEFAULT,
      fileName: '',
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof values.extractionMethod === 'string' ? values.extractionMethod : 'mistral_ocr',
      useCache: values.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true
      includeOcrImages: values.extractionMethod === 'mistral_ocr' ? (values.includeOcrImages ?? true) : undefined,
      includePageImages: values.extractionMethod === 'mistral_ocr' ? (values.includePageImages ?? true) : undefined,
      includeImages: values.includeImages ?? false, // Rückwärtskompatibilität
      useIngestionPipeline: values.useIngestionPipeline ?? false,
      template: typeof values.template === 'string' ? values.template : undefined,
    };
    // Speichere in localStorage (persistent)
    savePdfDefaults(activeLibraryId, defaults);
    // Setze auch Runtime-Overrides für diese Session (Vorrang vor DB-Defaults haben Vorrang)
    setOverrides(prev => ({ ...prev, [activeLibraryId]: { extractionMethod: defaults.extractionMethod, template: defaults.template } }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PDF Standardwerte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Zielsprache</Label>
            <Select value={values.targetLanguage || TARGET_LANGUAGE_DEFAULT} onValueChange={(v) => update({ targetLanguage: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_VALUES.map((code) => (
                  <SelectItem key={code} value={code}>{t(`chat.languageLabels.${code}`) || code.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={values.template || ''} onValueChange={(v) => update({ template: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Template wählen" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!values.useCache} onCheckedChange={(c) => update({ useCache: !!c })} />
              Cache verwenden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={values.extractionMethod === 'mistral_ocr' 
                  ? (values.includeOcrImages !== undefined ? values.includeOcrImages : true)
                  : (!!values.includeImages)} 
                onCheckedChange={(c) => {
                  if (values.extractionMethod === 'mistral_ocr') {
                    update({ includeOcrImages: !!c, includePageImages: !!c });
                  } else {
                    update({ includeImages: !!c });
                  }
                }} 
              />
              {values.extractionMethod === 'mistral_ocr' ? 'OCR & Seiten-Bilder extrahieren' : 'Bilder extrahieren'}
            </label>
          </div>
          <div className="space-y-2">
            <Label>Extraktionsmethode</Label>
            <Select value={values.extractionMethod || 'mistral_ocr'} onValueChange={(v) => update({ extractionMethod: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Methode wählen" />
              </SelectTrigger>
              <SelectContent>
                {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={saveAndClose}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



```

```typescript
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { TransformService } from './transform-service';
import { 
  BaseTransformOptions, 
  BatchTranscriptionItem,
  BatchTransformationItem,
  AudioTransformSettings,
  VideoTransformSettings
} from '@/atoms/transcription-options';
import { transformText, transformTextWithTemplate } from '@/lib/secretary/client';
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming';
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types';

// Default-Einstellungen
const DEFAULT_AUDIO_SETTINGS: AudioTransformSettings = {
  sourceLanguage: 'auto',
  template: 'Besprechung'
};

const DEFAULT_VIDEO_SETTINGS: VideoTransformSettings = {
  ...DEFAULT_AUDIO_SETTINGS,
  extractAudio: true,
  extractFrames: false,
  frameInterval: 1
};

export interface BatchTransformProgress {
  currentItem: number;
  totalItems: number;
  currentFileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface BatchTransformResult {
  success: boolean;
  results: Array<{
    item: StorageItem;
    success: boolean;
    error?: string;
    savedItem?: StorageItem;
    updatedItems?: StorageItem[];
  }>;
}

export class BatchTransformService {
  /**
   * Transformiert eine Batch von Audio/Video-Dateien (jede einzeln)
   */
  static async transformBatch(
    items: BatchTranscriptionItem[],
    baseOptions: BaseTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Progress-Update
      onProgress?.({
        currentItem: i + 1,
        totalItems: items.length,
        currentFileName: item.item.metadata.name,
        status: 'processing'
      });

      try {
        let result;
        
        // Hole die Datei als Blob
        const { blob } = await provider.getBinary(item.item.id);
        if (!blob) {
          throw new Error("Datei konnte nicht geladen werden");
        }

        // Konvertiere Blob zu File für die Verarbeitung
        const file = new File([blob], item.item.metadata.name, { type: item.item.metadata.mimeType });
        
        // Generiere den Shadow-Twin-Namen mit zentraler Logik
        const artifactKey: ArtifactKey = {
          sourceId: item.item.id,
          kind: 'transcript',
          targetLanguage: baseOptions.targetLanguage,
        };
        const shadowTwinName = buildArtifactName(artifactKey, item.item.metadata.name).replace(/\.md$/, '');
        
        switch (item.type) {
          case 'audio':
            result = await TransformService.transformAudio(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          case 'video':
            result = await TransformService.transformVideo(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                ...DEFAULT_VIDEO_SETTINGS
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          case 'document':
            result = await TransformService.transformPdf(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                extractionMethod: "mistral_ocr" // Globaler Default: mistral_ocr
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          default:
            throw new Error(`Unsupported media type: ${item.type}`);
        }

        results.push({
          item: item.item,
          success: true,
          savedItem: result.savedItem,
          updatedItems: result.updatedItems
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'success'
        });

      } catch (error) {
        hasError = true;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          item: item.item,
          success: false,
          error: errorMessage
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'error',
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }

  /**
   * Transformiert eine Batch von Text-Dateien (alle zusammen als ein Dokument)
   */
  static async transformTextBatch(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
    template: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    try {
      // Progress: Lade alle Texte
      onProgress?.({
        currentItem: 0,
        totalItems: items.length,
        currentFileName: 'Lade alle Texte...',
        status: 'processing'
      });

      // Alle Text-Inhalte laden
      const textContents: Array<{ item: StorageItem; content: string; fileName: string }> = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: `Lade ${item.item.metadata.name}...`,
          status: 'processing'
        });

        try {
          // Text-Inhalt laden
          const { blob } = await provider.getBinary(item.item.id);
          if (!blob) {
            throw new Error(`Datei ${item.item.metadata.name} konnte nicht geladen werden`);
          }

          const content = await blob.text();
          textContents.push({
            item: item.item,
            content: content,
            fileName: item.item.metadata.name
          });

          // Erfolg für diese Datei markieren
          results.push({
            item: item.item,
            success: true
          });

        } catch (error) {
          hasError = true;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          results.push({
            item: item.item,
            success: false,
            error: errorMessage
          });
        }
      }

      // Wenn alle Texte erfolgreich geladen wurden, führe die Transformation durch
      if (textContents.length > 0) {
        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformiere kombinierten Text...',
          status: 'processing'
        });

        // Alle Texte zusammenführen
        const combinedText = textContents.map(tc => 
          `## ${tc.fileName}\n\n${tc.content}\n\n---\n\n`
        ).join('');

        console.log('[BatchTransformService] Kombinierter Text erstellt:', {
          fileCount: textContents.length,
          combinedLength: combinedText.length,
          template: template
        });

        // Template-Typ bestimmen
        const standardTemplates = ['Besprechung', 'Gedanken', 'Interview', 'Zusammenfassung'];
        const isStandardTemplate = standardTemplates.includes(template);

        let transformedText: string;

        if (isStandardTemplate) {
          // Standard-Template verwenden
          transformedText = await transformText(
            combinedText,
            baseOptions.targetLanguage,
            libraryId,
            template
          );
        } else {
          // Benutzerdefiniertes Template: Lade Template-Inhalt
          try {
            // Verwende zentrale Client-Library für MongoDB-Templates
            const { loadTemplate } = await import('@/lib/templates/template-service-client')
            const templateResult = await loadTemplate({
              libraryId,
              preferredTemplateName: template
            })
            const templateContent = templateResult.templateContent
            
            // Direkter Secretary Service Call mit Template-Content
            transformedText = await transformTextWithTemplate(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              templateContent
            );
          } catch (error) {
            console.error('[BatchTransformService] Fehler beim Laden des Template-Inhalts:', error);
            // Fallback auf Standard-Template
            transformedText = await transformText(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              "Besprechung"
            );
          }
        }

        // Generiere Dateinamen für das kombinierte Ergebnis
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const combinedFileName = baseOptions.fileName || `Kombinierte_Transformation_${timestamp}`;
        
        // Ergebnis speichern
        if (baseOptions.createShadowTwin) {
          // Explizite Parameter übergeben statt aus Dateinamen zu parsen
          const result = await TransformService.saveTransformedText(
            transformedText,
            items[0].item, // Verwende das erste Item als Referenz
            {
              ...baseOptions,
              fileName: combinedFileName
            },
            provider,
            refreshItems,
            libraryId, // libraryId für Modus-Bestimmung
            'transformation', // artifactKind: Template-Transformation
            template // templateName: Explizit übergeben
          );

          // Aktualisiere das erste Ergebnis mit den Speicher-Informationen
          if (results.length > 0) {
            results[0] = {
              ...results[0],
              savedItem: result.savedItem,
              updatedItems: result.updatedItems
            };
          }
        }

        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformation abgeschlossen',
          status: 'success'
        });

      }

    } catch (error) {
      hasError = true;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[BatchTransformService] Fehler bei der Batch-Text-Transformation:', error);
      
      // Markiere alle verbleibenden Items als fehlgeschlagen
      for (let i = results.length; i < items.length; i++) {
        results.push({
          item: items[i].item,
          success: false,
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }
} 
```

```typescript
/**
 * @fileoverview Secretary Service Client - HTTP Client for Secretary Service API
 * 
 * @description
 * HTTP client for communicating with the Secretary Service. Provides methods for
 * processing PDFs, audio, video, images, and sessions. Handles authentication,
 * request formatting, response parsing, and error handling. Supports streaming
 * responses and callback URL configuration.
 * 
 * @module secretary
 * 
 * @exports
 * - SecretaryServiceClient: Main client class for Secretary Service API
 * - SecretaryServiceError: Error class for Secretary Service errors
 * - SecretaryAudioResponse: Interface for audio processing responses
 * - SecretaryVideoResponse: Interface for video processing responses
 * - SecretaryImageResponse: Interface for image processing responses
 * - SecretaryPdfResponse: Interface for PDF processing responses
 * 
 * @usedIn
 * - src/app/api/secretary: Secretary API routes use client
 * - src/lib/external-jobs: External jobs use client for processing
 * 
 * @dependencies
 * - @/lib/utils/fetch-with-timeout: Timeout-aware fetch utility
 * - @/lib/env: Environment helpers for Secretary config
 * - @/lib/secretary/types: Secretary type definitions
 */

import { 
  TemplateExtractionResponse,
  SecretaryRagResponse 
} from './types';
import { getSecretaryConfig } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Typ für die Secretary Service Audio Response
 */
export interface SecretaryAudioResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      audio_source: string;
      source_info: {
        original_filename: string;
        file_size: number;
        file_type: string;
        file_ext: string;
      };
      source_language: string;
      target_language: string;
      template: string;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
    metadata?: {
      title: string;
      duration: number;
      format: string;
      channels: number;
      sample_rate: number;
      bit_rate: number;
      process_dir: string;
      chapters: unknown[];
    };
    process_id: string;
    transformation_result: unknown | null;
    status: string;
  };
}

/**
 * Typ für die Secretary Service Video Response
 */
export interface SecretaryVideoResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      source_language: string;
      target_language: string;
      template: string | null;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    metadata: {
      title: string;
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      duration: number;
      duration_formatted: string;
      file_size: number;
      process_dir: string;
      audio_file: string;
      video_id: string | null;
    };
    process_id: string;
    audio_result: unknown | null;
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
  };
}

/**
 * Typ für die Secretary Service PDF Response
 */
export interface SecretaryPdfResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;  // ← Geändert von text_content zu extracted_text
    ocr_text: string | null;
    metadata: {
      file_name: string;
      file_size: number;
      page_count: number;
      format: string;
      process_dir: string;
      image_paths: string[];
      preview_paths: string[];
      preview_zip: string | null;
      text_paths: string[];
      original_text_paths: string[];
      text_contents: Array<{
        page: number;
        content: string;
      }>;
      extraction_method: string;
    };
    process_id: string;
    processed_at: string;
    // Neu: Link statt großer Base64-Blobs
    images_archive_url?: string;
    // Alt (deprecated): verbleibt für Abwärtskompatibilität
    images_archive_data?: string; 
    images_archive_filename?: string; 
    // Neu: Rohdaten der Mistral-OCR-Ausgabe mit Seitenstruktur
    mistral_ocr_raw?: {
      pages: Array<{
        index: number;
        markdown: string;
        images: Array<{
          id: string;
          top_left_x: number;
          top_left_y: number;
          bottom_right_x: number;
          bottom_right_y: number;
          image_base64: string | null;
          image_annotation: string | null;
        }>;
        dimensions: {
          dpi: number;
          height: number;
          width: number;
        };
      }>;
    };
  };
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @param useCache Cache verwenden (Standard: true)
 * @returns Die vollständige Response vom Secretary Service oder nur den Text (für Abwärtskompatibilität)
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  useCache: boolean = true
): Promise<SecretaryAudioResponse | string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage, 'und useCache:', useCache);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('useCache', useCache.toString());
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    // Die API Route sollte bereits die vollständige Response vom Secretary Service durchreichen
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Name
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template-Name für die Transformation
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Inhalt
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param templateContent Template-Inhalt für die Transformation
 * @returns Den transformierten Text
 */
export async function transformTextWithTemplate(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  templateContent: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformTextWithTemplate aufgerufen mit Template-Content');
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Template-Content-Länge:', templateContent?.length || 0);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    if (!templateContent || templateContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Template-Content vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('templateContent', templateContent);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      templateContent: formData.get('templateContent') ? 'vorhanden' : 'fehlt'
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API mit Template-Content');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Template-Content-Transformation erfolgreich');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Template-Content-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes mit Template-Content');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<SecretaryVideoResponse> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryVideoResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
}

/**
 * Transformiert eine PDF-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende PDF-Datei 
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Verarbeitung
 * @param extractionMethod Die Extraktionsmethode (native, ocr, both, preview, preview_and_native, llm, llm_and_ocr, mistral_ocr)
 * @param useCache Ob Cache verwendet werden soll
 * @param includeImages Ob Bilder mit extrahiert werden sollen
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformPdf(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  template?: string,
  extractionMethod: string = 'mistral_ocr', // Globaler Default: mistral_ocr
  useCache: boolean = true,
  includeOcrImages?: boolean, // Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
  skipTemplate?: boolean,
  context?: { originalItemId?: string; parentId?: string; originalFileName?: string; policies?: import('@/lib/processing/phase-policy').PhasePolicies }
): Promise<SecretaryPdfResponse> {
  try {
    console.log('[secretary/client] transformPdf aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    // OneDrive Token-Sync: Wenn der Client Tokens im localStorage hat, stelle sicher,
    // dass der Server (DB) vor dem Jobstart aktuelle Tokens hat, damit Gates/Webhook funktionieren.
    await (async () => {
      try {
        const key = `onedrive_tokens_${libraryId}`;
        const json = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (!json) return;
        const tokens = JSON.parse(json) as { accessToken: string; refreshToken: string; expiry: number };
        const now = Date.now();
        const bufferMs = 120_000; // 2 Minuten Buffer
        let accessToken = tokens.accessToken;
        let refreshToken = tokens.refreshToken;
        let expiryMs = Number(tokens.expiry);

        // Falls abgelaufen oder kurz davor: Refresh über Serverroute
        if (!expiryMs || expiryMs - now <= bufferMs) {
          const resp = await fetch('/api/auth/onedrive/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ libraryId, refreshToken })
          });
          if (resp.ok) {
            const data = await resp.json();
            accessToken = data.accessToken;
            refreshToken = data.refreshToken || refreshToken;
            // Server liefert expiresIn in Sekunden
            expiryMs = now + (Number(data.expiresIn || 0) * 1000);
            // Update localStorage
            localStorage.setItem(key, JSON.stringify({ accessToken, refreshToken, expiry: expiryMs }));
          }
        }

        // Persistiere Tokens in DB (Server), damit Webhook/Server‑Gates Zugriff haben
        await fetch(`/api/libraries/${libraryId}/tokens`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiryMs / 1000).toString() })
        });
      } catch {}
    })();
    
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = extractionMethod === 'mistral_ocr';
    const includeOcrImagesValue = includeOcrImages !== undefined 
      ? includeOcrImages 
      : (isMistralOcr ? true : false); // Standard: true für Mistral OCR
    const includePageImagesValue = isMistralOcr ? true : false; // Standard: true für Mistral OCR
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extractionMethod', extractionMethod);
    formData.append('useCache', useCache.toString());
    formData.append('includeOcrImages', includeOcrImagesValue.toString());
    formData.append('includePageImages', includePageImagesValue.toString());
    // Policies als JSON übergeben (neues Format)
    if (context?.policies) {
      formData.append('policies', JSON.stringify(context.policies));
    }
    
    // Template-Option
    if (template) {
      formData.append('template', template);
    }
    // Kontext-Informationen für zielgenaues Speichern
    if (context?.originalItemId) {
      formData.append('originalItemId', context.originalItemId);
    }
    if (context?.parentId) {
      formData.append('parentId', context.parentId);
    }
    if (context?.originalFileName) {
      formData.append('originalFileName', context.originalFileName);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-pdf', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] PDF-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryPdfResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der PDF-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der PDF-Datei');
  }
}

/**
 * Interface für Image-OCR-Response
 */
export interface SecretaryImageResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;
    metadata: {
      file_name: string;
      file_size: number;
      dimensions: string;
      format: string;
      color_mode: string;
      dpi: number[];
      process_dir: string;
      extraction_method: string;
      preview_paths: string[];
    };
    process_id: string;
    processed_at: string;
    status: string;
  };
}

/**
 * Interface für Session-Import-Response
 */
export interface SessionImportResponse {
  status: string;
  data: {
    session: string;
    filename: string;
    track: string;
    video_url: string;
    attachments_url?: string;
    event: string;
    url: string;
    day: string;
    starttime: string;
    endtime: string;
    speakers: string[];
    speakers_url?: string[];
    speakers_image_url?: string[];
    source_language: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transformiert ein Bild mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Bilddatei
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param extractionMethod Die Extraktionsmethode (ocr, llm, llm_and_ocr, native, both, preview, preview_and_native)
 * @param context Optionaler JSON-Kontext für LLM-Optimierung
 * @param useCache Ob Cache verwendet werden soll
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformImage(
  file: File,
  targetLanguage: string,
  libraryId: string,
  extractionMethod: string = 'ocr',
  context?: string,
  useCache: boolean = true
): Promise<SecretaryImageResponse> {
  try {
    console.log('[secretary/client] transformImage aufgerufen mit Sprache:', targetLanguage, 'und Methode:', extractionMethod);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extraction_method', extractionMethod);
    formData.append('useCache', useCache.toString());
    
    // Context-Option
    if (context) {
      formData.append('context', context);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-image', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Bild-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryImageResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Bild-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Bilddatei');
  }
}

/**
 * Importiert Session-Daten aus einer Website-URL mithilfe des Secretary Services
 * 
 * @param url Die zu analysierende Website-URL
 * @param options Optionen für die Session-Extraktion
 * @param options.containerSelector Optional: XPath-Ausdruck für Container-Selektor zur gezielten Extraktion
 * @returns Die extrahierten Session-Daten
 */
export async function importSessionFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    template?: string;
    useCache?: boolean;
    containerSelector?: string;
  } = {}
): Promise<TemplateExtractionResponse> {
  try {
    console.log('[secretary/client] importSessionFromUrl aufgerufen mit URL:', url);
    
    const requestBody: Record<string, unknown> = {
      url,
      source_language: options.sourceLanguage || 'en',
      target_language: options.targetLanguage || 'en',
      template: options.template || 'ExtractSessionDataFromWebsite',
      use_cache: options.useCache ?? false
    };
    
    // Container-Selector optional hinzufügen, falls vorhanden
    if (options.containerSelector && options.containerSelector.trim().length > 0) {
      requestBody.container_selector = options.containerSelector.trim();
    }
    
    const response = await fetch('/api/secretary/import-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SecretaryServiceError(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: TemplateExtractionResponse = await response.json();
    console.log('[secretary/client] Session-Import erfolgreich:', data);
    
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler beim Session-Import:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError(
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Session-Import'
    );
  }
} 

/**
 * Liest eine Webseite aus und gibt den extrahierten Text zurück.
 *
 * Motivation: Im Creation Wizard wollen wir eine URL als Quelle nutzen, ohne
 * Session-spezifische Daten zu mappen. Wir verwenden denselben Proxy wie der
 * Session-Import (`/api/secretary/import-from-url`) und nehmen nur `data.text`.
 */
export async function extractTextFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    /** Optional: Secretary Template-Name für URL-Extraktion (Default bleibt wie Session-Import) */
    template?: string;
    useCache?: boolean;
    containerSelector?: string;
  } = {}
): Promise<{ text: string; raw: TemplateExtractionResponse }> {
  const raw = await importSessionFromUrl(url, options)
  const text = raw?.data?.text
  if (typeof text !== 'string' || !text.trim()) {
    throw new SecretaryServiceError('Webseite konnte nicht gelesen werden (kein Text gefunden).')
  }
  return { text, raw }
}

/**
 * Startet die vollständige Session-Verarbeitung im Secretary Service
 * und liefert Markdown/ZIP im Response.
 */
export interface ProcessSessionInput {
  event: string;
  session: string;
  url: string;
  filename: string;
  track: string;
  day?: string;
  starttime?: string;
  endtime?: string;
  speakers?: string[];
  speakers_url?: string[];
  speakers_image_url?: string[];
  video_url?: string;
  video_transcript?: string;
  attachments_url?: string;
  source_language?: string;
  target_language?: string;
  target?: string;
  template?: string;
  use_cache?: boolean;
  create_archive?: boolean;
}

export interface ProcessSessionSuccessData {
  status: 'success';
  data?: {
    output?: {
      archive_data?: string;
      archive_filename?: string;
      markdown_content?: string;
      markdown_file?: string;
    };
  };
}

export interface ProcessSessionErrorData {
  status: 'error';
  error?: { code?: string; message?: string };
}

export type ProcessSessionResponse = ProcessSessionSuccessData | ProcessSessionErrorData | unknown;

export async function processSession(input: ProcessSessionInput): Promise<ProcessSessionResponse> {
  try {
    const resp = await fetch('/api/secretary/session/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data: ProcessSessionResponse = await resp.json();
    if (!resp.ok || (data as ProcessSessionErrorData)?.status === 'error') {
      const message = (data as ProcessSessionErrorData)?.error?.message || resp.statusText;
      throw new SecretaryServiceError(message);
    }
    return data;
  } catch (error) {
    if (error instanceof SecretaryServiceError) throw error;
    throw new SecretaryServiceError('Fehler bei processSession');
  }
}

/**
 * Ruft den RAG Embedding-Endpoint des Secretary Services auf.
 * Sendet Markdown-Text und erhält Chunks mit Embeddings zurück.
 * 
 * @param params RAG Embedding-Parameter
 * @returns Response vom Secretary Service mit Chunks und Embeddings
 */
export async function embedTextRag(params: {
  markdown: string;
  documentId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
  embedding_dimensions?: number;
  metadata?: Record<string, unknown>;
}): Promise<SecretaryRagResponse> {
  const { baseUrl, apiKey } = getSecretaryConfig();
  if (!baseUrl) {
    throw new SecretaryServiceError('SECRETARY_SERVICE_URL nicht konfiguriert');
  }
  if (!apiKey) {
    throw new SecretaryServiceError('SECRETARY_SERVICE_API_KEY nicht konfiguriert');
  }

  // baseUrl enthält bereits /api, daher nur /rag/embed-text anhängen
  const url = `${baseUrl}/rag/embed-text`;
  
  // Debug-Logging für URL-Verifikation
  console.log('[secretary/client] embedTextRag - URL:', url);
  console.log('[secretary/client] embedTextRag - baseUrl:', baseUrl);
  
  // Request-Body gemäß RAG API Dokumentation
  const body = {
    markdown: params.markdown,
    document_id: params.documentId,
    chunk_size: params.chunkSize ?? 1000,
    chunk_overlap: params.chunkOverlap ?? 200,
    embedding_model: params.embeddingModel ?? 'voyage-3-large',
    embedding_dimensions: params.embedding_dimensions,
    metadata: params.metadata || {},
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Secretary-Api-Key': apiKey,
  };

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
      timeoutMs: 60000, // 60 Sekunden Timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[secretary/client] embedTextRag - Fehler:', {
        status: res.status,
        statusText: res.statusText,
        url,
        errorText: errorText.substring(0, 500), // Erste 500 Zeichen
      });
      throw new SecretaryServiceError(`Secretary Service RAG Fehler: ${res.status} ${errorText.substring(0, 200)}`);
    }

    const data = await res.json() as SecretaryRagResponse;
    
    if (data.status === 'error') {
      const errorMessage = data.error?.message || 'Unbekannter Fehler beim RAG Embedding';
      throw new SecretaryServiceError(errorMessage);
    }

    return data;
  } catch (error) {
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    
    // Spezifische Fehlerbehandlung für verschiedene Fehlertypen
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Prüfe auf Netzwerkfehler (Service nicht erreichbar)
    if (errorMessage.includes('fetch failed') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('NetworkError')) {
      console.error('[secretary/client] embedTextRag - Secretary Service nicht erreichbar:', {
        url,
        baseUrl,
        error: errorMessage,
        hint: 'Bitte prüfen Sie, ob der Secretary Service läuft und erreichbar ist.'
      });
      throw new SecretaryServiceError(
        `Secretary Service nicht erreichbar (${url}). ` +
        `Bitte prüfen Sie, ob der Service läuft und die URL korrekt ist. ` +
        `Fehler: ${errorMessage}`
      );
    }
    
    // Prüfe auf Timeout-Fehler
    if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
      console.error('[secretary/client] embedTextRag - Timeout:', {
        url,
        timeoutMs: 60000,
        error: errorMessage
      });
      throw new SecretaryServiceError(
        `Secretary Service Timeout nach 60 Sekunden. ` +
        `Die Anfrage war zu groß oder der Service antwortet zu langsam. ` +
        `Fehler: ${errorMessage}`
      );
    }
    
    // Generischer Fehler
    throw new SecretaryServiceError(`Fehler beim RAG Embedding: ${errorMessage}`);
  }
}
```

Prüfe Lints und füge Tests hinzu:


Erstelle Tests für die Default-Logik:


```typescript
import { describe, expect, it } from 'vitest'
import { getEffectivePdfDefaults } from '@/atoms/pdf-defaults'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

describe('getEffectivePdfDefaults', () => {
  it('sollte mistral_ocr als globalen Default setzen, wenn extractionMethod nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', undefined, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod nicht gesetzt ist (globaler Default mistral_ocr)', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includeOcrImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeOcrImages).toBe(true)
  })

  it('sollte includePageImages nicht überschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', { 
      extractionMethod: 'mistral_ocr',
      includePageImages: false 
    }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(false)
  })

  it('sollte includePageImages nicht setzen, wenn extractionMethod nicht mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'native' }, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.includePageImages).toBeUndefined()
  })

  it('sollte Runtime-Overrides vor DB-Defaults anwenden', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'native' }
    const overrides = { 'library-1': { extractionMethod: 'mistral_ocr' } }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, overrides)
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte DB-Defaults verwenden, wenn keine Overrides vorhanden sind', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { 
      extractionMethod: 'native',
      targetLanguage: 'en'
    }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte auch ohne libraryId funktionieren', () => {
    const result = getEffectivePdfDefaults(undefined, {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages bei mistral_ocr immer true setzen, auch wenn DB-Defaults es nicht setzen', () => {
    // Simuliert Fall: DB hat mistral_ocr, aber includePageImages nicht gesetzt
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'mistral_ocr' }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true) // Sollte automatisch auf true gesetzt werden
  })
})

```

Prüfe alle geänderten Dateien auf Lint-Fehler:


Alle Tests bestehen. Abschließen der TODOs:


## Zusammenfassung der Änderungen

### 1. Globaler Default `mistral_ocr`
- `src/atoms/pdf-defaults.ts`: `getEffectivePdfDefaults` erweitert
  - Neuer globaler Default: `mistral_ocr` (statt `native`)
  - `applyMistralDefaults`: Erzwingt `includePageImages = true` bei Mistral OCR

### 2. `includePageImages` bei Mistral OCR erzwungen
- In `getEffectivePdfDefaults` automatisch auf `true` gesetzt, wenn `extractionMethod === 'mistral_ocr'`
- Kann explizit überschrieben werden, wenn nötig

### 3. Alle PDF-Flows auf Defaults ausgerichtet
Aktualisierte Dateien:
- `src/components/library/pdf-bulk-import-dialog.tsx` - Batch-Dialog
- `src/components/library/flow/flow-actions.tsx` - Single-Flow
- `src/components/library/phase-stepper.tsx` - Phase-Stepper
- `src/components/library/pdf-transform.tsx` - PDF-Transform-Komponente
- `src/components/library/pdf-phase-settings.tsx` - Phase-Settings
- `src/components/settings/secretary-service-form.tsx` - Settings-Form
- `src/app/api/secretary/process-pdf/batch/route.ts` - Batch-API
- `src/app/api/secretary/process-pdf/route.ts` - Single-API
- `src/lib/external-jobs/secretary-request.ts` - Secretary-Request
- `src/app/api/external/jobs/[jobId]/start/route.ts` - Start-Route
- `src/app/api/external/jobs/internal/create/route.ts` - Internal-Create-Route
- `src/app/api/metadata/template/run/route.ts` - Template-Run-Route
- `src/lib/transform/batch-transform-service.ts` - Batch-Transform-Service
- `src/lib/secretary/client.ts` - Secretary-Client

### 4. Tests hinzugefügt
- `tests/unit/atoms/pdf-defaults.test.ts`: 10 Tests für die Default-Logik
  - Globaler Default `mistral_ocr`
  - Automatisches Setzen von `includePageImages` bei Mistral OCR
  - Überschreiben von Defaults
  - Runtime-Overrides
  - Alle Tests bestehen

### 5. Lints geprüft
- Keine Lint-Fehler in den geänderten Dateien

Alle Änderungen sind implementiert und getestet. Der globale Default ist jetzt `mistral_ocr`, und `includePageImages` wird bei Mistral OCR automatisch auf `true` gesetzt.

---

**User**

Ich habe mit PDF Stapelverarbeitung PDFs transformiert und er hat alle PDFs mit der Endung *.en.md erstellt. Woher kommt nun diese English Default Wert? erstens kann ich ihn nirgends auswählen und Default sollte doch de sein, den wir im "config.chat" als Target Language spezifiziert haben, oder wo wird das definiert in diesem Extractionsschritt?

library config:
config: {
  "secretaryService": {
    "pdfDefaults": {
      "extractionMethod": "mistral_ocr",
      "template": "pdfanalyse"
    }
  },
  "shadowTwin": {
    "mode": "v2"
  },
  "chat": {
    "placeholder": "Write your question...",
    "maxChars": 500,
    "maxCharsWarningMessage": "Your question is too long, please shorten it.",
    "footerText": "",
    "embeddings": {
      "embeddingModel": "voyage-3-large",
      "chunkSize": 1000,
      "chunkOverlap": 200,
      "dimensions": 2048
    },
    "targetLanguage": "de",
    "character": [
      "undefined"
    ],
    "socialContext": "undefined",
    "gallery": {
      "detailViewType": "book",
      "facets": [
        {
          "metaKey": "authors",
          "label": "Authors",
          "type": "string[]",
          "multi": true,
          "visible": true
        },
        {
          "metaKey": "year",
          "label": "Year",
          "type": "number",
          "multi": true,
          "visible": true
        },
        {
          "metaKey": "region",
          "label": "Region",
          "type": "string",
          "multi": true,
          "visible": true
        },
        {
          "metaKey": "docType",
          "label": "DocType",
          "type": "string",
          "multi": true,
          "visible": true
        },
        {
          "metaKey": "source",
          "label": "Source",
          "type": "string",
          "multi": true,
          "visible": true
        },
        {
          "metaKey": "tags",
          "label": "Tags",
          "type": "string[]",
          "multi": true,
          "visible": true
        }
      ]
    },
    "vectorStore": {
      "collectionName": "doc_meta__ff73d3a2-fe01-4674-bce1-feb708235a5a"
    }
  }
}
---
Verzeichnisstruktur

    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
dar--l         1/17/2026  12:21 PM                RückmeldungenDerLandesverwaltung                                     
-a----         1/18/2026  10:24 AM              0 dir.txt                                                              


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
dar--l         1/17/2026  12:21 PM                .KBR_SHF_Presentazione-17.09.2024_final.pdf                          
dar--l         1/17/2026  12:42 PM                Bürgerrat                                                            
dar--l         1/17/2026  12:39 PM                Stakeholder                                                          
-a---l         1/17/2026  10:54 AM        1580296 KBR_SHF_Presentazione-17.09.2024_final.pdf                           
-a---l         1/17/2026  11:17 AM            199 Rückmeldungen der Landesverwaltung zu den Vorschlägen des            
                                                  Klimabürgerrats und des Stakeholder Forum Klima für den Klimaplan    
                                                  S.url                                                                


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\.KBR_SHF_Presentazione-17.09.2024_final.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:21 PM           9777 KBR_SHF_Presentazione-17.09.2024_final.en.md                         
-a---l         1/17/2026  12:21 PM           5788 KBR_SHF_Presentazione-17.09.2024_final.pdfanalyse.en.md              


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Bürgerrat


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
dar--l         1/17/2026  12:37 PM                .240826_KBR_DIGITAL_DE.pdf                                           
dar--l         1/17/2026  12:43 PM                .Vorschlaege_KBR_BEREITS_IN_UMSETZUNG.pdf                            
dar--l         1/17/2026  12:33 PM                .Vorschlaege_KBR_IM_KLIMAPLAN_ENTHALTEN.pdf                          
dar--l         1/17/2026  12:34 PM                .Vorschlaege_KBR_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf                   
dar--l         1/17/2026  12:35 PM                .Vorschlaege_KBR_NEU_UMSETZBAR.pdf                                   
dar--l         1/17/2026  12:40 PM                .Vorschlaege_KBR_NICHT_UMSETZBAR.pdf                                 
dar--l         1/17/2026  12:38 PM                .Vorschlaege_KBR_VERTIEFT_ZU_PRUeFEN.pdf                             
dar--l         1/17/2026  12:36 PM                .Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf                      
-a---l         1/17/2026  11:22 AM       24395901 240826_KBR_DIGITAL_DE.pdf                                            
-a---l         1/17/2026  11:15 AM        1133132 Vorschlaege_KBR_BEREITS_IN_UMSETZUNG.pdf                             
-a---l         1/17/2026  11:15 AM         237744 Vorschlaege_KBR_IM_KLIMAPLAN_ENTHALTEN.pdf                           
-a---l         1/17/2026  11:15 AM         210821 Vorschlaege_KBR_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf                    
-a---l         1/17/2026  11:15 AM         486437 Vorschlaege_KBR_NEU_UMSETZBAR.pdf                                    
-a---l         1/17/2026  11:16 AM         633539 Vorschlaege_KBR_NICHT_UMSETZBAR.pdf                                  
-a---l         1/17/2026  11:16 AM         581214 Vorschlaege_KBR_VERTIEFT_ZU_PRUeFEN.pdf                              
-a---l         1/17/2026  11:16 AM         147989 Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf                       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Bürgerrat\.240826_KBR_DIGITAL_DE.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:36 PM         149392 240826_KBR_DIGITAL_DE.en.md                                          
-a---l         1/17/2026  12:37 PM           6444 240826_KBR_DIGITAL_DE.pdfanalyse.en.md                               


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Bürgerrat\.Vorschlaege_KBR_BEREITS_IN_UMSETZUNG.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:42 PM         309511 Vorschlaege_KBR_BEREITS_IN_UMSETZUNG.en.md                           
-a---l         1/17/2026  12:43 PM           6689 Vorschlaege_KBR_BEREITS_IN_UMSETZUNG.pdfanalyse.en.md                


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Bürgerrat\.Vorschlaege_KBR_IM_KLIMAPLAN_ENTHALTEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:32 PM          19227 Vorschlaege_KBR_IM_KLIMAPLAN_ENTHALTEN.en.md                         
-a---l         1/17/2026  12:33 PM           7653 Vorschlaege_KBR_IM_KLIMAPLAN_ENTHALTEN.pdfanalyse.en.md              


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Bürgerrat\.Vorschlaege_KBR_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:33 PM           7683 Vorschlaege_KBR_IN_ANDEREM_FACHPLAN_ENTHALTEN.en.md                  
-a---l         1/17/2026  12:34 PM           6101 Vorschlaege_KBR_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdfanalyse.en.md       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Bürgerrat\.Vorschlaege_KBR_NEU_UMSETZBAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:35 PM          75336 Vorschlaege_KBR_NEU_UMSETZBAR.en.md                                  
-a---l         1/17/2026  12:35 PM           7250 Vorschlaege_KBR_NEU_UMSETZBAR.pdfanalyse.en.md                       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Bürgerrat\.Vorschlaege_KBR_NICHT_UMSETZBAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:40 PM          97558 Vorschlaege_KBR_NICHT_UMSETZBAR.en.md                                
-a---l         1/17/2026  12:40 PM           7164 Vorschlaege_KBR_NICHT_UMSETZBAR.pdfanalyse.en.md                     


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Bürgerrat\.Vorschlaege_KBR_VERTIEFT_ZU_PRUeFEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:37 PM          92075 Vorschlaege_KBR_VERTIEFT_ZU_PRUeFEN.en.md                            
-a---l         1/17/2026  12:38 PM           5895 Vorschlaege_KBR_VERTIEFT_ZU_PRUeFEN.pdfanalyse.en.md                 


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Bürgerrat\.Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:36 PM           8292 Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md                     
-a---l         1/17/2026  12:36 PM           6318 Vorschlaege_KBR_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md          


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Stakeholder


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
dar--l         1/17/2026  12:28 PM                .240826_SHF_DIGITAL_DE.pdf                                           
dar--l         1/17/2026  12:27 PM                .Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf                            
dar--l         1/17/2026  11:55 AM                .Vorschlaege_SHF_IM_KLIMAPLAN_ENTHALTEN.pdf                          
dar--l         1/17/2026  11:59 AM                .Vorschlaege_SHF_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf                   
dar--l         1/17/2026  12:39 PM                .Vorschlaege_SHF_NEU_UMSETZBAR.pdf                                   
dar--l         1/17/2026  12:33 PM                .Vorschlaege_SHF_NICHT_UMSETZBAR.pdf                                 
dar--l         1/17/2026  12:27 PM                .Vorschlaege_SHF_VERTIEFT_ZU_PRUeFEN.pdf                             
dar--l         1/17/2026  12:32 PM                .Vorschlaege_SHF_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf                      
-a---l         1/17/2026  10:54 AM       26755611 240826_SHF_DIGITAL_DE.pdf                                            
-a---l         1/17/2026  10:55 AM         949594 Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf                             
-a---l         1/17/2026  10:55 AM         239911 Vorschlaege_SHF_IM_KLIMAPLAN_ENTHALTEN.pdf                           
-a---l         1/17/2026  10:55 AM         221309 Vorschlaege_SHF_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf                    
-a---l         1/17/2026  10:55 AM         293971 Vorschlaege_SHF_NEU_UMSETZBAR.pdf                                    
-a---l         1/17/2026  10:55 AM         438075 Vorschlaege_SHF_NICHT_UMSETZBAR.pdf                                  
-a---l         1/17/2026  10:56 AM         639497 Vorschlaege_SHF_VERTIEFT_ZU_PRUeFEN.pdf                              
-a---l         1/17/2026  10:56 AM         460950 Vorschlaege_SHF_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf                       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Stakeholder\.240826_SHF_DIGITAL_DE.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:27 PM         242219 240826_SHF_DIGITAL_DE.en.md                                          
-a---l         1/17/2026  12:28 PM           5847 240826_SHF_DIGITAL_DE.pdfanalyse.en.md                               


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Stakeholder\.Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:26 PM         249391 Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.en.md                           
-a---l         1/17/2026  12:27 PM           7925 Vorschlaege_SHF_BEREITS_IN_UMSETZUNG.pdfanalyse.en.md                


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Stakeholder\.Vorschlaege_SHF_IM_KLIMAPLAN_ENTHALTEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  11:54 AM          19273 Vorschlaege_SHF_IM_KLIMAPLAN_ENTHALTEN.en.md                         
-a---l         1/17/2026  11:55 AM           6819 Vorschlaege_SHF_IM_KLIMAPLAN_ENTHALTEN.pdfanalyse.en.md              


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Stakeholder\.Vorschlaege_SHF_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  11:58 AM           9404 Vorschlaege_SHF_IN_ANDEREM_FACHPLAN_ENTHALTEN.en.md                  
-a---l         1/17/2026  11:59 AM           4178 Vorschlaege_SHF_IN_ANDEREM_FACHPLAN_ENTHALTEN.pdfanalyse.en.md       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Stakeholder\.Vorschlaege_SHF_NEU_UMSETZBAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:39 PM          44491 Vorschlaege_SHF_NEU_UMSETZBAR.en.md                                  
-a---l         1/17/2026  12:39 PM           6666 Vorschlaege_SHF_NEU_UMSETZBAR.pdfanalyse.en.md                       


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design 
    GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLandesverwaltung\Stakeholder\.Vorschlaege_SHF_NICHT_UMSETZBAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:32 PM          46123 Vorschlaege_SHF_NICHT_UMSETZBAR.en.md                                
-a---l         1/17/2026  12:33 PM           5511 Vorschlaege_SHF_NICHT_UMSETZBAR.pdfanalyse.en.md                     


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Stakeholder\.Vorschlaege_SHF_VERTIEFT_ZU_PRUeFEN.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:26 PM         148532 Vorschlaege_SHF_VERTIEFT_ZU_PRUeFEN.en.md                            
-a---l         1/17/2026  12:27 PM           7383 Vorschlaege_SHF_VERTIEFT_ZU_PRUeFEN.pdfanalyse.en.md                 


    Verzeichnis: C:\Users\peter.aichner\OneDrive - Crystal Design GmbH\Klimaarchiv\www.klimaland.bz\RückmeldungenDerLan
    desverwaltung\Stakeholder\.Vorschlaege_SHF_VORSCHLAG-ZUORDNUNG-UNKLAR.pdf


Mode                 LastWriteTime         Length Name                                                                 
----                 -------------         ------ ----                                                                 
-a---l         1/17/2026  12:30 PM          30596 Vorschlaege_SHF_VORSCHLAG-ZUORDNUNG-UNKLAR.en.md                     
-a---l         1/17/2026  12:32 PM           5274 Vorschlaege_SHF_VORSCHLAG-ZUORDNUNG-UNKLAR.pdfanalyse.en.md          




---

**Cursor**

Untersuche, wo `targetLanguage` für die Batch-Verarbeitung gesetzt wird und warum `en` statt `de` verwendet wird.


Prüfe, wo `TARGET_LANGUAGE_DEFAULT` definiert ist und wie `targetLanguage` aus der Library-Config geladen werden sollte:


Problem: `TARGET_LANGUAGE_DEFAULT` ist `'en'`, und `getEffectivePdfDefaults` berücksichtigt `config.chat.targetLanguage` nicht. Prüfe, wie die Library-Config im Client geladen wird:


Erweitere `getEffectivePdfDefaults`, um `targetLanguage` aus der Library-Config (`config.chat.targetLanguage`) zu verwenden, wenn keine anderen Defaults gesetzt sind. Prüfe, wie die Library-Config geladen wird:


Erweitere `getEffectivePdfDefaults`, um `targetLanguage` aus der Library-Config zu verwenden, wenn keine anderen Defaults gesetzt sind:


Erweitere `getEffectivePdfDefaults`, um `targetLanguage` aus der Library-Config zu verwenden:


```typescript
import { atom } from 'jotai'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'
import type { TargetLanguage } from '@/lib/chat/constants'

/**
 * Runtime-Overrides für PDF-Standardwerte pro Library (nicht persistent).
 * Lebensdauer: bis zum Reload. Vorrang vor DB-Defaults in der UI.
 */
export type PdfRuntimeOverrides = Partial<PdfTransformOptions>;

// Map: libraryId -> Overrides
export const pdfOverridesAtom = atom<Record<string, PdfRuntimeOverrides>>({})

/**
 * Globaler Default für extractionMethod: mistral_ocr (wenn nichts gesetzt ist).
 * WICHTIG: Dieser Default gilt für alle PDF-Flows, wenn keine explizite Auswahl getroffen wurde.
 */
const GLOBAL_DEFAULT_EXTRACTION_METHOD: PdfTransformOptions['extractionMethod'] = 'mistral_ocr'

/**
 * Erzwingt Mistral-spezifische Defaults für Bild-Extraktion.
 * Wenn extractionMethod === 'mistral_ocr', dann sind includePageImages und includeOcrImages standardmäßig true.
 */
function applyMistralDefaults(options: Partial<PdfTransformOptions>): Partial<PdfTransformOptions> {
  const extractionMethod = options.extractionMethod || GLOBAL_DEFAULT_EXTRACTION_METHOD
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  return {
    ...options,
    extractionMethod,
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    includePageImages: isMistralOcr 
      ? (options.includePageImages !== undefined ? options.includePageImages : true)
      : options.includePageImages,
    // Bei Mistral OCR: includeOcrImages standardmäßig true (kann überschrieben werden)
    includeOcrImages: isMistralOcr
      ? (options.includeOcrImages !== undefined ? options.includeOcrImages : true)
      : options.includeOcrImages,
  }
}

/**
 * Bestimmt die effektive targetLanguage basierend auf Priorität:
 * 1. dbDefaults.targetLanguage (localStorage)
 * 2. libraryConfigChatTargetLanguage (config.chat.targetLanguage)
 * 3. TARGET_LANGUAGE_DEFAULT ('en')
 */
function getEffectiveTargetLanguage(
  dbTargetLanguage: string | undefined,
  libraryConfigChatTargetLanguage: TargetLanguage | undefined
): string {
  // Priorität 1: localStorage-Defaults
  if (dbTargetLanguage) {
    return dbTargetLanguage
  }
  // Priorität 2: Library-Config (config.chat.targetLanguage)
  if (libraryConfigChatTargetLanguage) {
    return libraryConfigChatTargetLanguage
  }
  // Priorität 3: Globaler Default
  return TARGET_LANGUAGE_DEFAULT
}

export function getEffectivePdfDefaults(
  libraryId: string | undefined,
  dbDefaults: Partial<PdfTransformOptions> | undefined,
  overridesMap: Record<string, PdfRuntimeOverrides>,
  libraryConfigChatTargetLanguage?: TargetLanguage
): Partial<PdfTransformOptions> {
  if (!libraryId) {
    const merged = { 
      ...(dbDefaults || {}),
      // Verwende Library-Config targetLanguage, wenn dbDefaults.targetLanguage nicht gesetzt ist
      targetLanguage: getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage)
    }
    return applyMistralDefaults(merged)
  }
  const ov = overridesMap[libraryId] || {}
  const merged = { 
    ...(dbDefaults || {}), 
    ...ov,
    // Verwende Library-Config targetLanguage, wenn weder dbDefaults noch overrides targetLanguage setzen
    targetLanguage: ov.targetLanguage ?? getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage)
  }
  return applyMistralDefaults(merged)
}



```

Aktualisiere `pdf-bulk-import-dialog.tsx`, um die Library-Config zu verwenden:


```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides, libraryConfigChatTargetLanguage);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          // targetLanguage wird bereits in getEffectivePdfDefaults bestimmt (inkl. Library-Config)
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Aktualisiere die anderen Aufrufe von `getEffectivePdfDefaults`:


```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides, libraryConfigChatTargetLanguage);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          // targetLanguage wird bereits in getEffectivePdfDefaults bestimmt (inkl. Library-Config)
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides, libraryConfigChatTargetLanguage);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides, libraryConfigChatTargetLanguage);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Aktualisiere `phase-stepper.tsx`:


```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
    const targetLanguage = typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT;
    
    // Nutze zentrale buildArtifactName() Logik für Dateinamen-Generierung
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage,
    };
    const fileName = buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
    
    const base: PdfTransformOptions = {
      targetLanguage,
      fileName,
      createShadowTwin: true,
      fileExtension: 'md',
      // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
      useCache: defaults.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
      includeOcrImages: defaults.includeOcrImages,
      includePageImages: defaults.includePageImages,
      includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    const policies = {
      extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
      metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
      ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
    } as import('@/lib/processing/phase-policy').PhasePolicies;
    return {
      ...base,
      policies,
    } as PdfTransformOptions;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean) {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides, libraryConfigChatTargetLanguage);
    const targetLanguage = typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT;
    
    // Nutze zentrale buildArtifactName() Logik für Dateinamen-Generierung
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage,
    };
    const fileName = buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
    
    const base: PdfTransformOptions = {
      targetLanguage,
      fileName,
      createShadowTwin: true,
      fileExtension: 'md',
      // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
      useCache: defaults.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
      includeOcrImages: defaults.includeOcrImages,
      includePageImages: defaults.includePageImages,
      includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    const policies = {
      extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
      metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
      ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
    } as import('@/lib/processing/phase-policy').PhasePolicies;
    return {
      ...base,
      policies,
    } as PdfTransformOptions;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean) {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

Suche nach weiteren Verwendungen von `getEffectivePdfDefaults`:


Aktualisiere die Tests und `flow-actions.tsx`:


```typescript
import { describe, expect, it } from 'vitest'
import { getEffectivePdfDefaults } from '@/atoms/pdf-defaults'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

describe('getEffectivePdfDefaults', () => {
  it('sollte mistral_ocr als globalen Default setzen, wenn extractionMethod nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', undefined, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod nicht gesetzt ist (globaler Default mistral_ocr)', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includeOcrImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeOcrImages).toBe(true)
  })

  it('sollte includePageImages nicht überschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', { 
      extractionMethod: 'mistral_ocr',
      includePageImages: false 
    }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(false)
  })

  it('sollte includePageImages nicht setzen, wenn extractionMethod nicht mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'native' }, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.includePageImages).toBeUndefined()
  })

  it('sollte Runtime-Overrides vor DB-Defaults anwenden', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'native' }
    const overrides = { 'library-1': { extractionMethod: 'mistral_ocr' } }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, overrides)
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte DB-Defaults verwenden, wenn keine Overrides vorhanden sind', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { 
      extractionMethod: 'native',
      targetLanguage: 'en'
    }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte auch ohne libraryId funktionieren', () => {
    const result = getEffectivePdfDefaults(undefined, {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages bei mistral_ocr immer true setzen, auch wenn DB-Defaults es nicht setzen', () => {
    // Simuliert Fall: DB hat mistral_ocr, aber includePageImages nicht gesetzt
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'mistral_ocr' }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true) // Sollte automatisch auf true gesetzt werden
  })

  it('sollte Library-Config targetLanguage verwenden, wenn dbDefaults.targetLanguage nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {}, 'de')
    
    expect(result.targetLanguage).toBe('de')
  })

  it('sollte dbDefaults.targetLanguage vor Library-Config targetLanguage priorisieren', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { targetLanguage: 'en' }
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {}, 'de')
    
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte TARGET_LANGUAGE_DEFAULT verwenden, wenn weder dbDefaults noch Library-Config targetLanguage gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.targetLanguage).toBe('en') // TARGET_LANGUAGE_DEFAULT
  })
})

```

Führe die Tests aus, um sicherzustellen, dass alles funktioniert:


## Zusammenfassung der Änderungen

### Problem
Bei der PDF-Stapelverarbeitung wurden alle PDFs mit der Endung `*.en.md` erstellt, obwohl die Library-Konfiguration `config.chat.targetLanguage: "de"` hatte. Der Grund: `getEffectivePdfDefaults` verwendete `TARGET_LANGUAGE_DEFAULT` (`'en'`), wenn keine localStorage-Defaults gesetzt waren, und ignorierte die Library-Config.

### Lösung
1. `getEffectivePdfDefaults` erweitert (`src/atoms/pdf-defaults.ts`):
   - Neuer optionaler Parameter `libraryConfigChatTargetLanguage`
   - Neue Funktion `getEffectiveTargetLanguage` mit Priorität:
     1. `dbDefaults.targetLanguage` (localStorage)
     2. `libraryConfigChatTargetLanguage` (`config.chat.targetLanguage`)
     3. `TARGET_LANGUAGE_DEFAULT` (`'en'`)

2. Client-Komponenten aktualisiert:
   - `src/components/library/pdf-bulk-import-dialog.tsx`: Lädt `activeLibraryAtom` und übergibt `libraryConfigChatTargetLanguage` an `getEffectivePdfDefaults`
   - `src/components/library/phase-stepper.tsx`: Gleiche Änderung

3. Tests erweitert (`tests/unit/atoms/pdf-defaults.test.ts`):
   - 3 neue Tests für die `targetLanguage`-Priorität
   - Alle 13 Tests bestehen

### Ergebnis
Bei der PDF-Stapelverarbeitung wird jetzt `targetLanguage` aus `config.chat.targetLanguage` verwendet, wenn keine localStorage-Defaults gesetzt sind. In Ihrem Fall werden die PDFs mit `*.de.md` statt `*.en.md` erstellt.

Die Änderungen sind rückwärtskompatibel: Wenn `libraryConfigChatTargetLanguage` nicht übergeben wird, wird der globale Default (`'en'`) verwendet.

---

**User**

Wo kann man localStorage-Defaults verwalten?

---

**Cursor**

Suche nach UI-Komponenten, die die localStorage-Defaults für PDF-Verarbeitung verwalten:


Prüfe, wo die `PdfPhaseSettings`-Komponente verwendet wird:


Prüfe, wie die Settings geöffnet werden:


Suche nach dem Settings-Button im Batch-Import-Dialog:


Die localStorage-Defaults für PDF-Verarbeitung können an zwei Stellen verwaltet werden:

## 1. Im Batch-Import-Dialog

**Ort:** PDF-Verzeichnis verarbeiten Dialog

**Zugriff:** 
- Öffne den Dialog "PDF-Verzeichnis verarbeiten"
- Klicke auf das Zahnrad-Icon oben rechts im Dialog-Header
- Der Dialog zeigt: "Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden."

```252:254:src/components/library/pdf-bulk-import-dialog.tsx
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
```

## 2. Im Phase-Stepper (Einzelne PDFs)

**Ort:** Phase-Stepper-Komponente (wenn eine PDF-Datei ausgewählt ist)

**Zugriff:**
- Wähle eine PDF-Datei aus
- Klicke auf das Einstellungs-Icon neben dem "Starten"-Button

```167:169:src/components/library/phase-stepper.tsx
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
```

## Was kann verwaltet werden?

Die `PdfPhaseSettings` Komponente bietet folgende Einstellungen:

- **Zielsprache** (`targetLanguage`) – z. B. "de", "en"
- **Template** – Template für die Transformation
- **Cache verwenden** (`useCache`) – Checkbox
- **Bilder extrahieren** (`includeImages`/`includeOcrImages`/`includePageImages`) – Checkbox
- **Extraktionsmethode** (`extractionMethod`) – Dropdown: native, ocr, both, preview, preview_and_native, llm, llm_and_ocr, mistral_ocr

Die Einstellungen werden in localStorage gespeichert (Schlüssel: `pdfDefaults:${libraryId}`) und gelten pro Library.

**Hinweis:** Die Priorität ist:
1. localStorage-Defaults (hier verwaltet)
2. Library-Config (`config.chat.targetLanguage`)
3. Globaler Default (`'en'`)

```typescriptreact
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
```

```typescriptreact
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
```

---

**User**

Okay, ist diese Maske, aber sie übernimmt nicht die Werte, die in der Config definiert sind, als Defaultwerte, weder die Zielsprache noch das Template. Und diese Maske ist nur über diese Batch-Transformation erreichbar, aber nicht über diesen Story-Mode. Wie kann ich es dort einstellen?

---

**Cursor**

```typescript
import { atom } from 'jotai'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'
import type { TargetLanguage } from '@/lib/chat/constants'

/**
 * Runtime-Overrides für PDF-Standardwerte pro Library (nicht persistent).
 * Lebensdauer: bis zum Reload. Vorrang vor DB-Defaults in der UI.
 */
export type PdfRuntimeOverrides = Partial<PdfTransformOptions>;

// Map: libraryId -> Overrides
export const pdfOverridesAtom = atom<Record<string, PdfRuntimeOverrides>>({})

/**
 * Globaler Default für extractionMethod: mistral_ocr (wenn nichts gesetzt ist).
 * WICHTIG: Dieser Default gilt für alle PDF-Flows, wenn keine explizite Auswahl getroffen wurde.
 */
const GLOBAL_DEFAULT_EXTRACTION_METHOD: PdfTransformOptions['extractionMethod'] = 'mistral_ocr'

/**
 * Erzwingt Mistral-spezifische Defaults für Bild-Extraktion.
 * Wenn extractionMethod === 'mistral_ocr', dann sind includePageImages und includeOcrImages standardmäßig true.
 */
function applyMistralDefaults(options: Partial<PdfTransformOptions>): Partial<PdfTransformOptions> {
  const extractionMethod = options.extractionMethod || GLOBAL_DEFAULT_EXTRACTION_METHOD
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  return {
    ...options,
    extractionMethod,
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    includePageImages: isMistralOcr 
      ? (options.includePageImages !== undefined ? options.includePageImages : true)
      : options.includePageImages,
    // Bei Mistral OCR: includeOcrImages standardmäßig true (kann überschrieben werden)
    includeOcrImages: isMistralOcr
      ? (options.includeOcrImages !== undefined ? options.includeOcrImages : true)
      : options.includeOcrImages,
  }
}

/**
 * Bestimmt die effektive targetLanguage basierend auf Priorität:
 * 1. dbDefaults.targetLanguage (localStorage)
 * 2. libraryConfigChatTargetLanguage (config.chat.targetLanguage)
 * 3. TARGET_LANGUAGE_DEFAULT ('en')
 */
function getEffectiveTargetLanguage(
  dbTargetLanguage: string | undefined,
  libraryConfigChatTargetLanguage: TargetLanguage | undefined
): string {
  // Priorität 1: localStorage-Defaults
  if (dbTargetLanguage) {
    return dbTargetLanguage
  }
  // Priorität 2: Library-Config (config.chat.targetLanguage)
  if (libraryConfigChatTargetLanguage) {
    return libraryConfigChatTargetLanguage
  }
  // Priorität 3: Globaler Default
  return TARGET_LANGUAGE_DEFAULT
}

/**
 * Bestimmt das effektive Template basierend auf Priorität:
 * 1. dbDefaults.template (localStorage)
 * 2. libraryConfigPdfTemplate (config.secretaryService.pdfDefaults.template)
 */
function getEffectiveTemplate(
  dbTemplate: string | undefined,
  libraryConfigPdfTemplate: string | undefined
): string | undefined {
  if (dbTemplate) return dbTemplate
  if (libraryConfigPdfTemplate) return libraryConfigPdfTemplate
  return undefined
}

export function getEffectivePdfDefaults(
  libraryId: string | undefined,
  dbDefaults: Partial<PdfTransformOptions> | undefined,
  overridesMap: Record<string, PdfRuntimeOverrides>,
  libraryConfigChatTargetLanguage?: TargetLanguage,
  libraryConfigPdfTemplate?: string
): Partial<PdfTransformOptions> {
  if (!libraryId) {
    const merged = { 
      ...(dbDefaults || {}),
      // Verwende Library-Config targetLanguage, wenn dbDefaults.targetLanguage nicht gesetzt ist
      targetLanguage: getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage),
      template: getEffectiveTemplate(dbDefaults?.template, libraryConfigPdfTemplate),
    }
    return applyMistralDefaults(merged)
  }
  const ov = overridesMap[libraryId] || {}
  const merged = { 
    ...(dbDefaults || {}), 
    ...ov,
    // Verwende Library-Config targetLanguage, wenn weder dbDefaults noch overrides targetLanguage setzen
    targetLanguage: ov.targetLanguage ?? getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage),
    template: ov.template ?? getEffectiveTemplate(dbDefaults?.template, libraryConfigPdfTemplate),
  }
  return applyMistralDefaults(merged)
}



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(
        activeLibraryId,
        loadPdfDefaults(activeLibraryId),
        pdfOverrides,
        libraryConfigChatTargetLanguage,
        libraryConfigPdfTemplate
      );
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          // targetLanguage wird bereits in getEffectivePdfDefaults bestimmt (inkl. Library-Config)
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
          // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
          includeOcrImages: defaults.includeOcrImages,
          includePageImages: defaults.includePageImages,
          includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(
                        activeLibraryId,
                        loadPdfDefaults(activeLibraryId),
                        pdfOverrides,
                        libraryConfigChatTargetLanguage,
                        libraryConfigPdfTemplate
                      );
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(
                        activeLibraryId,
                        loadPdfDefaults(activeLibraryId),
                        pdfOverrides,
                        libraryConfigChatTargetLanguage,
                        libraryConfigPdfTemplate
                      );
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(
      activeLibraryId,
      loadPdfDefaults(activeLibraryId),
      pdfOverrides,
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate
    );
    const targetLanguage = typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT;
    
    // Nutze zentrale buildArtifactName() Logik für Dateinamen-Generierung
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage,
    };
    const fileName = buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
    
    const base: PdfTransformOptions = {
      targetLanguage,
      fileName,
      createShadowTwin: true,
      fileExtension: 'md',
      // Globaler Default: mistral_ocr (wird bereits in getEffectivePdfDefaults angewendet)
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
      useCache: defaults.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true (werden bereits in getEffectivePdfDefaults angewendet)
      includeOcrImages: defaults.includeOcrImages,
      includePageImages: defaults.includePageImages,
      includeImages: defaults.includeImages ?? false, // Rückwärtskompatibilität
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    const policies = {
      extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
      metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
      ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
    } as import('@/lib/processing/phase-policy').PhasePolicies;
    return {
      ...base,
      policies,
    } as PdfTransformOptions;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean) {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, activeLibraryIdAtom } from "@/atoms/library-atom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { loadPdfDefaults, savePdfDefaults } from "@/lib/pdf-defaults";
import { useStorage } from "@/contexts/storage-context";
import { useAtom } from "jotai";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import type { PdfTransformOptions } from "@/lib/transform/transform-service";
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_DEFAULT,
} from "@/lib/chat/constants";
import { useTranslation } from "@/lib/i18n/hooks";

interface PdfPhaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPhaseSettings({ open, onOpenChange }: PdfPhaseSettingsProps) {
  const { t } = useTranslation()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  // provider wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provider: _unused_provider } = useStorage();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [overrides, setOverrides] = useAtom(pdfOverridesAtom);
  const [values, setValues] = React.useState<Partial<PdfTransformOptions>>({});

  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

  React.useEffect(() => {
    if (!activeLibraryId) return;
    const db = loadPdfDefaults(activeLibraryId);
    const eff = getEffectivePdfDefaults(
      activeLibraryId,
      db,
      overrides,
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate
    );
    setValues(eff);
  }, [activeLibraryId, open, overrides, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return;
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templates = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setTemplates(templates);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [activeLibraryId, open]);

  function update(partial: Partial<PdfTransformOptions>) {
    setValues(prev => ({ ...prev, ...partial }));
  }

  function saveAndClose() {
    if (!activeLibraryId) return onOpenChange(false);
    const effectiveTargetLanguage = typeof values.targetLanguage === 'string'
      ? values.targetLanguage
      : (libraryConfigChatTargetLanguage || TARGET_LANGUAGE_DEFAULT);
    const effectiveTemplate = typeof values.template === 'string'
      ? values.template
      : libraryConfigPdfTemplate;
    const defaults: PdfTransformOptions = {
      targetLanguage: effectiveTargetLanguage,
      fileName: '',
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof values.extractionMethod === 'string' ? values.extractionMethod : 'mistral_ocr',
      useCache: values.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true
      includeOcrImages: values.extractionMethod === 'mistral_ocr' ? (values.includeOcrImages ?? true) : undefined,
      includePageImages: values.extractionMethod === 'mistral_ocr' ? (values.includePageImages ?? true) : undefined,
      includeImages: values.includeImages ?? false, // Rückwärtskompatibilität
      useIngestionPipeline: values.useIngestionPipeline ?? false,
      template: effectiveTemplate,
    };
    // Speichere in localStorage (persistent)
    savePdfDefaults(activeLibraryId, defaults);
    // Setze auch Runtime-Overrides für diese Session (Vorrang vor DB-Defaults haben Vorrang)
    setOverrides(prev => ({ ...prev, [activeLibraryId]: { extractionMethod: defaults.extractionMethod, template: defaults.template } }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PDF Standardwerte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Zielsprache</Label>
            <Select
              value={values.targetLanguage || libraryConfigChatTargetLanguage || TARGET_LANGUAGE_DEFAULT}
              onValueChange={(v) => update({ targetLanguage: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_VALUES.map((code) => (
                  <SelectItem key={code} value={code}>{t(`chat.languageLabels.${code}`) || code.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={values.template || libraryConfigPdfTemplate || ''}
              onValueChange={(v) => update({ template: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Template wählen" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!values.useCache} onCheckedChange={(c) => update({ useCache: !!c })} />
              Cache verwenden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={values.extractionMethod === 'mistral_ocr' 
                  ? (values.includeOcrImages !== undefined ? values.includeOcrImages : true)
                  : (!!values.includeImages)} 
                onCheckedChange={(c) => {
                  if (values.extractionMethod === 'mistral_ocr') {
                    update({ includeOcrImages: !!c, includePageImages: !!c });
                  } else {
                    update({ includeImages: !!c });
                  }
                }} 
              />
              {values.extractionMethod === 'mistral_ocr' ? 'OCR & Seiten-Bilder extrahieren' : 'Bilder extrahieren'}
            </label>
          </div>
          <div className="space-y-2">
            <Label>Extraktionsmethode</Label>
            <Select value={values.extractionMethod || 'mistral_ocr'} onValueChange={(v) => update({ extractionMethod: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Methode wählen" />
              </SelectTrigger>
              <SelectContent>
                {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={saveAndClose}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/flow/flow-actions.tsx
@@
 type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"
+
+const PdfPhaseSettings = React.lazy(() =>
+  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
+)
@@
         if (kind === "pdf") {
           jobId = await enqueuePdfJob({
             libraryId,
             sourceFile,
             parentId,
             targetLanguage: args.targetLanguage,
             templateName: args.templateName,
             policies: args.policies,
+            libraryConfigChatTargetLanguage,
+            libraryConfigPdfTemplate,
           })
         } else if (kind === "audio") {
@@
       {isPdf ? (
         <>
@@
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button
                     type="button"
                     variant={leftPaneMode === "off" ? "secondary" : "outline"}
                     size="icon"
                     className="h-8 w-8"
                     aria-label="Linkes Panel ausblenden"
                     aria-pressed={leftPaneMode === "off"}
                     onClick={() => void setLeftPaneMode("off")}
                   >
                     <PanelLeftClose className="h-4 w-4" />
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent side="bottom">Links: Ausblenden</TooltipContent>
               </Tooltip>
+
+              <Tooltip>
+                <TooltipTrigger asChild>
+                  <Button
+                    type="button"
+                    variant="outline"
+                    size="icon"
+                    className="h-8 w-8"
+                    aria-label="PDF-Standardwerte"
+                    onClick={() => setSettingsOpen(true)}
+                  >
+                    <Settings className="h-4 w-4" />
+                  </Button>
+                </TooltipTrigger>
+                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
+              </Tooltip>
             </>
           ) : null}
@@
-      </TooltipProvider>
+      </TooltipProvider>
+      {settingsOpen && (
+        <React.Suspense>
+          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
+        </React.Suspense>
+      )}
     </div>
   )
 }
*** End Patch
```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/flow/flow-actions.tsx
@@
-      </TooltipProvider>
+      </TooltipProvider>
+      {settingsOpen && (
+        <React.Suspense>
+          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
+        </React.Suspense>
+      )}
     </div>
   )
 }
*** End Patch
```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescript
import { describe, expect, it } from 'vitest'
import { getEffectivePdfDefaults } from '@/atoms/pdf-defaults'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

describe('getEffectivePdfDefaults', () => {
  it('sollte mistral_ocr als globalen Default setzen, wenn extractionMethod nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', undefined, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod nicht gesetzt ist (globaler Default mistral_ocr)', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includeOcrImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeOcrImages).toBe(true)
  })

  it('sollte includePageImages nicht überschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', { 
      extractionMethod: 'mistral_ocr',
      includePageImages: false 
    }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(false)
  })

  it('sollte includePageImages nicht setzen, wenn extractionMethod nicht mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'native' }, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.includePageImages).toBeUndefined()
  })

  it('sollte Runtime-Overrides vor DB-Defaults anwenden', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'native' }
    const overrides = { 'library-1': { extractionMethod: 'mistral_ocr' } }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, overrides)
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte DB-Defaults verwenden, wenn keine Overrides vorhanden sind', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { 
      extractionMethod: 'native',
      targetLanguage: 'en'
    }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte auch ohne libraryId funktionieren', () => {
    const result = getEffectivePdfDefaults(undefined, {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages bei mistral_ocr immer true setzen, auch wenn DB-Defaults es nicht setzen', () => {
    // Simuliert Fall: DB hat mistral_ocr, aber includePageImages nicht gesetzt
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'mistral_ocr' }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true) // Sollte automatisch auf true gesetzt werden
  })

  it('sollte Library-Config targetLanguage verwenden, wenn dbDefaults.targetLanguage nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {}, 'de')
    
    expect(result.targetLanguage).toBe('de')
  })

  it('sollte dbDefaults.targetLanguage vor Library-Config targetLanguage priorisieren', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { targetLanguage: 'en' }
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {}, 'de')
    
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte TARGET_LANGUAGE_DEFAULT verwenden, wenn weder dbDefaults noch Library-Config targetLanguage gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.targetLanguage).toBe('en') // TARGET_LANGUAGE_DEFAULT
  })

  it('sollte Library-Config template verwenden, wenn dbDefaults.template nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {}, undefined, 'pdfanalyse')
    
    expect(result.template).toBe('pdfanalyse')
  })

  it('sollte dbDefaults.template vor Library-Config template priorisieren', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { template: 'custom-template' }
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {}, undefined, 'pdfanalyse')
    
    expect(result.template).toBe('custom-template')
  })
})

```

Ich sehe zwei Ursachen: Die Maske nutzt localStorage‑Defaults pro Library, und diese hatten bei dir offenbar „English“. Zusätzlich ist der globale `TARGET_LANGUAGE_DEFAULT` in `chat/constants` weiterhin `'en'`, sodass ohne localStorage auch Englisch erscheint. Das ist konsistent mit dem aktuellen Verhalten, aber widerspricht deiner Library‑Config, die `config.chat.targetLanguage: "de"` setzt.

Ich habe deshalb die Default‑Logik so erweitert, dass `config.chat.targetLanguage` (und das Template aus `config.secretaryService.pdfDefaults.template`) als Fallback genutzt werden, **wenn** keine localStorage‑Defaults existieren. Außerdem habe ich den PDF‑Standardwerte‑Dialog auch im Story‑Mode zugänglich gemacht. UI‑seitig habe ich das nicht manuell getestet, nur die Unit‑Tests laufen grün.

### Was jetzt gilt
- **Priorität**: localStorage‑Defaults → Library‑Config → globaler Default  
- **Template**: localStorage‑Template → `config.secretaryService.pdfDefaults.template`

```43:103:src/atoms/pdf-defaults.ts
/**
 * Bestimmt die effektive targetLanguage basierend auf Priorität:
 * 1. dbDefaults.targetLanguage (localStorage)
 * 2. libraryConfigChatTargetLanguage (config.chat.targetLanguage)
 * 3. TARGET_LANGUAGE_DEFAULT ('en')
 */
function getEffectiveTargetLanguage(...)
...
/**
 * Bestimmt das effektive Template basierend auf Priorität:
 * 1. dbDefaults.template (localStorage)
 * 2. libraryConfigPdfTemplate (config.secretaryService.pdfDefaults.template)
 */
function getEffectiveTemplate(...)
...
export function getEffectivePdfDefaults(...)
```

```27:102:src/components/library/pdf-phase-settings.tsx
const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

React.useEffect(() => {
  const db = loadPdfDefaults(activeLibraryId);
  const eff = getEffectivePdfDefaults(...);
  setValues(eff);
}, ...)

function saveAndClose() {
  const effectiveTargetLanguage = ...;
  const effectiveTemplate = ...;
  savePdfDefaults(activeLibraryId, defaults);
}
```

### Wie du es **im Story‑Mode** einstellen kannst
- Öffne den **Story Creator** (oben „Story Creator“).
- In der oberen Toolbar gibt es jetzt ein **Zahnrad‑Icon „PDF‑Standardwerte“**.
- Dort kannst du Zielsprache und Template speichern (persistiert in localStorage).

### Falls weiterhin „English“ angezeigt wird
Dann liegt ein gespeicherter localStorage‑Wert vor. Den kannst du löschen:
- Browser DevTools → **Application** → **Local Storage**  
- Key: `pdfDefaults:<libraryId>` löschen  
Dann greift automatisch die Library‑Config („de“, „pdfanalyse“).

### Tests
- `pnpm test tests/unit/atoms/pdf-defaults.test.ts`

Wenn du möchtest, kann ich die Priorität ändern, sodass **Library‑Config immer** gewinnt (also localStorage ignoriert).

```typescript
/**
 * Bestimmt die effektive targetLanguage basierend auf Priorität:
 * 1. dbDefaults.targetLanguage (localStorage)
 * 2. libraryConfigChatTargetLanguage (config.chat.targetLanguage)
 * 3. TARGET_LANGUAGE_DEFAULT ('en')
 */
function getEffectiveTargetLanguage(...)
...
/**
 * Bestimmt das effektive Template basierend auf Priorität:
 * 1. dbDefaults.template (localStorage)
 * 2. libraryConfigPdfTemplate (config.secretaryService.pdfDefaults.template)
 */
function getEffectiveTemplate(...)
...
export function getEffectivePdfDefaults(...)
```

```typescriptreact
const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

React.useEffect(() => {
  const db = loadPdfDefaults(activeLibraryId);
  const eff = getEffectivePdfDefaults(...);
  setValues(eff);
}, ...)

function saveAndClose() {
  const effectiveTargetLanguage = ...;
  const effectiveTemplate = ...;
  savePdfDefaults(activeLibraryId, defaults);
}
```

