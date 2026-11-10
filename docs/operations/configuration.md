# Configuration

Common Knowledge Scout is configured through environment variables. Use `.env.local` for development and `.env` or your container environment for production. [`.env.example`](https://github.com/bCommonsLAB/CommonKnowledgeScout/blob/master/.env.example) and [`docker-compose.example.yml`](https://github.com/bCommonsLAB/CommonKnowledgeScout/blob/master/docker-compose.example.yml) are the starting points.

Secrets belong in the environment only. They are never sent to the browser.

## Required services

| Service | Purpose |
|---|---|
| MongoDB with vector search | Libraries, documents, shadow twins, jobs and the retrieval index |
| Secretary Service | Transcription, OCR, PDF extraction and all language-model calls |
| Clerk | Sign-in and user management |
| Azure Blob Storage (optional) | Published images and media |

## Application

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the application, for example `http://localhost:3000` |
| `PORT` | No | Port of the Next.js server (default `3000`) |
| `PUBLIC_DOMAIN_LIBRARY_MAP` | No | JSON object that maps a domain to a library slug. A mapped domain shows that library's website at `/`. Invalid JSON is logged and ignored. |
| `NEXT_PUBLIC_DEBUG_DETAIL` | No | `true` shows developer details at the end of the session detail view |

## Internal calls

| Variable | Required | Description |
|---|---|---|
| `INTERNAL_TEST_TOKEN` | Production | Shared secret for server-to-server calls, sent as `X-Internal-Token`. Without it, job callbacks fail in production. |
| `INTERNAL_SELF_BASE_URL` | No | Base URL for calls of the application to itself, for example `http://127.0.0.1:3000` |

## Secretary Service

| Variable | Required | Description |
|---|---|---|
| `SECRETARY_SERVICE_URL` | Yes | URL of the Secretary Service API. A library can override it under Settings → Transformation. |
| `SECRETARY_SERVICE_API_KEY` | Yes | API key for the Secretary Service |
| `EXTERNAL_REQUEST_TIMEOUT_MS` | No | Timeout for requests to the service (default `600000`) |
| `EXTERNAL_TEMPLATE_TIMEOUT_MS` | No | Timeout for template processing (default: the value above) |

## MongoDB

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | Connection string |
| `MONGODB_DATABASE_NAME` | Yes | Database name |
| `MONGODB_COLLECTION_NAME` | No | Collection that holds the libraries (default `libraries`) |

## Chat and story mode

All language-model calls go through the Secretary Service; no model provider key is configured here.

| Variable | Required | Description |
|---|---|---|
| `QUESTION_ANALYZER_MODEL` | Yes | Model used to analyse a question. There is no default. |
| `QUESTION_ANALYZER_TEMPERATURE` | Yes | Temperature for question analysis. There is no default. |
| `LLM_CHAT_TIMEOUT_MS` | No | Timeout for a chat request (default `240000`) |

## Authentication (Clerk)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Path of the sign-in page |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Path of the sign-up page |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | Redirect after sign-in |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | Redirect after sign-up |

## Storage connections

Storage access (Nextcloud app password, OneDrive client secret and tokens) belongs to a user account and is stored encrypted in MongoDB.

| Variable | Required | Description |
|---|---|---|
| `CREDENTIALS_ENCRYPTION_KEY` | Yes | 32-byte key, Base64 or hex, for AES-256-GCM encryption of stored credentials. Without it, creating or reading a storage connection fails. Generate one with `openssl rand -base64 32`. |
| `MS_REDIRECT_URI` | OneDrive | Redirect URI of the OneDrive sign-in |
| `AZURE_STORAGE_CONNECTION_STRING` | No | Azure Blob Storage for published images and media. A library can set its own values under Settings → Story. |
| `AZURE_STORAGE_CONTAINER_NAME` | No | Container name for the above |

## MCP server

The MCP server is available at `/api/mcp/mcp` (Streamable HTTP). Without configuration it is closed and answers with HTTP 503.

| Variable | Required | Description |
|---|---|---|
| `MCP_API_KEY` | For MCP | Secret that signs the personal account keys users create in their account settings. An account key acts with the full rights of its owner. |
| `MCP_USER_EMAIL` | No | User for the legacy mode in which `MCP_API_KEY` itself is used as the key |

## Job worker

| Variable | Required | Description |
|---|---|---|
| `JOBS_WORKER_AUTOSTART` | No | Start the worker with the application (default `true`) |
| `JOBS_WORKER_INTERVAL_MS` | No | Polling interval (default `2000`) |
| `JOBS_WORKER_CONCURRENCY` | No | Number of jobs that run at the same time (default `3`) |
| `JOBS_WORKER_POOL_ID` | No | Set a different ID per instance when several instances share one MongoDB, so each worker claims only its own jobs |

## Capture

| Variable | Required | Description |
|---|---|---|
| `SUBMISSION_MAX_FILE_BYTES` | No | Largest file accepted by the capture inbox (default 100 MiB). Larger uploads are rejected with HTTP 413. |
| `SUBMISSION_MAX_TOTAL_BYTES` | No | Largest total size of one submission (default 250 MiB) |

## Optional integrations

| Variable | Description |
|---|---|
| `VIMEO_ACCESS_TOKEN` | Access to Vimeo for video transcripts |
| `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME` | Sending e-mail, for example invitations |
| `ELECTRON_MSAL_CLIENT_ID`, `ELECTRON_MSAL_TENANT_ID` | Desktop application only: sign-in for Microsoft Teams recordings |
| `DEBUG_FILESYSTEM` | `true` enables debug logging of the local file system provider |
