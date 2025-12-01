# Common Knowledge Stack

**An open research and development project for commons-oriented knowledge infrastructures.**

The Common Knowledge Stack explores how distributed information (audio, video, documents, and images) can be transformed into structured, accessible, and collectively negotiated knowledge — outside commercial logic and with transparency at every step.

---

## 🧩 Structure

The Common Knowledge Stack follows a file-sharing approach to knowledge distribution, designed to work both server-side and **locally** (with a planned Electron-based desktop implementation). The architecture consists of:

### Core Components

- **Knowledge Scout** – Next.js web application that currently runs server-side but is **prepared for local execution** with a planned Electron implementation. It provides the main interface for organizing, publishing, and exploring knowledge. It features an **abstracted storage layer** with three drivers:
  - **Local File System** – Direct access to files on your computer
  - **OneDrive** – Integration with Microsoft OneDrive for cloud storage
  - **Nextcloud** – Integration with Nextcloud for self-hosted cloud storage (in development)
  
  This storage abstraction allows you to organize files locally and share knowledge through file sharing, independent of where the files are physically stored. The abstraction layer enables seamless transition between server-side and local desktop deployment. **The goal is to achieve absolute sovereignty over your own data** and migrate from locked-in scenarios to self-organized scenarios where you can share knowledge with others while maintaining full control over your information.

- **Secretary Service** – External Python service that helps transform media files (audio, video, PDFs, images) in your file system into structured Markdown documents. It processes raw materials and creates "shadow twin" Markdown files alongside the originals.

- **Knowledge Library & Chat** – Built on top of the transformed Markdown files, these tools enable:
  - **Gallery** – Publishing and organizing knowledge for discovery
  - **Chat & story mode** – Dialog-based exploration using RAG (Retrieval-Augmented Generation)

### Workflow

The typical workflow follows this path:

1. **Content Collection** → 
   - **File Organization**: Store media files (PDFs, audio, video) in your chosen storage (local, OneDrive, or Nextcloud)
   - **Web Scraping**: Scrape websites to collect event data, talks, slides, video transcripts, and web content (e.g., using the Session Manager)
2. **Transformation** → Secretary Service transforms these files and scraped content into structured Markdown documents. For events and talks, this includes extracting slides, video transcripts, web text, and metadata into organized Markdown files
3. **Knowledge Layer** → Use the Markdown files to build galleries and enable chat-based exploration
4. **Sharing** → Share knowledge through file sharing, making the transformed content accessible to others

---

## 🚀 Installation

### Docker (Recommended for Production)

The easiest way to deploy Common Knowledge Scout is using Docker. A pre-built image is available on GitHub Container Registry:

```bash
docker pull ghcr.io/bcommonslab/commonkno:latest
```

### Docker Compose

For a complete setup with all required environment variables, use Docker Compose. An example configuration file is provided: [`docker-compose.example.yml`](./docker-compose.example.yml)

Copy the example file and customize it with your configuration:

```bash
cp docker-compose.example.yml docker-compose.yml
# Edit docker-compose.yml with your settings
docker-compose up -d
```

### Local Development

For local development and contribution:

```bash
# Clone the repository
git clone [repository-url]
cd CommonKnowledgeScout

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## ⚙️ Configuration

### Environment Variables

The application requires several environment variables to be configured. Create a `.env.local` file (for development) or `.env` file (for production) based on `.env.example`.

#### Application Settings

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Application URL (e.g., `http://localhost:3000` or production URL) |
| `PORT` | No | Next.js port (default: 3000) |

#### Internal Security

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_TEST_TOKEN` | Recommended | Shared secret for internal server-to-server calls. Used as `X-Internal-Token` header. **Required in production** to prevent callback failures. |
| `INTERNAL_SELF_BASE_URL` | No | Base URL for internal self-calls (e.g., `http://127.0.0.1:3000`). Falls back to request origin or `NEXT_PUBLIC_APP_URL`. |

#### Secretary Service

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRETARY_SERVICE_URL` | Yes | URL of the Secretary Service API endpoint |
| `SECRETARY_SERVICE_API_KEY` | Yes | API key for authenticating with the Secretary Service |
| `EXTERNAL_REQUEST_TIMEOUT_MS` | No | Timeout for external requests (default: 600000 ms) |
| `EXTERNAL_TEMPLATE_TIMEOUT_MS` | No | Timeout for template processing (default: 600000 ms) |
| `ANALYZE_REQUEST_TIMEOUT_MS` | No | Timeout for internal analyze calls (default: 120000 ms) |

#### MongoDB

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DATABASE_NAME` | Yes | Database name |
| `MONGODB_COLLECTION_NAME` | No | Collection name (default: `libraries`) |

#### OpenAI Chat (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | OpenAI API key for chat features |
| `OPENAI_CHAT_MODEL_NAME` | No | Chat model name (default: `gpt-4.1-mini`) |
| `OPENAI_CHAT_TEMPERATURE` | No | Chat temperature (default: `0.2`) |

#### Authentication (Clerk)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes* | Clerk publishable key (*required if authentication is enabled) |
| `CLERK_SECRET_KEY` | Yes* | Clerk secret key (*required if authentication is enabled) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Sign-in URL path (default: `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Sign-up URL path (default: `/sign-up`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | Redirect after sign-in (default: `/`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | No | Redirect after sign-up (default: `/`) |

#### Job Worker Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `JOBS_EXECUTION_MODE` | No | Execution mode: `worker` or `direct` (default: `worker`) |
| `JOBS_WORKER_AUTOSTART` | No | Auto-start worker (default: `true`) |
| `JOBS_WORKER_INTERVAL_MS` | No | Worker polling interval (default: 2000 ms) |
| `JOBS_WORKER_CONCURRENCY` | No | Number of concurrent jobs (default: 3) |

#### Debug Settings

| Variable | Required | Description |
|----------|----------|-------------|
| `DEBUG_FILESYSTEM` | No | Enable filesystem debug logging (default: `false`) |

#### Additional Optional Services

- **Vimeo Integration**: `VIMEO_ACCESS_TOKEN` for video transcript extraction
- **Azure Storage**: `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` for cloud storage
- **Microsoft OneDrive**: `MS_REDIRECT_URI` for OneDrive integration

### Example Configuration

See [`docker-compose.example.yml`](./docker-compose.example.yml) for a complete example configuration.

---

## 📖 Workflows

### Library Setup

Create and configure a library to organize your knowledge base. Libraries serve as containers for documents, media files, and transformed content. Each library can have its own storage provider, access settings, and vector database configuration.

**Learn more:** [Library Setup Use Case](./docs/use-cases/library-setup.md)

### File Transformation

Transform various file formats into structured Markdown documents:

- **PDFs**: Extract text, images, and structure from PDF documents → [PDF Transformation Use Case](./docs/use-cases/file-transformation-pdf.md)
- **Audio/Video**: Transcribe audio and video files to text with speaker identification → [Media Transformation Use Case](./docs/use-cases/file-transformation-media.md)
- **Images**: Extract text using OCR and generate descriptions

Transformed files are saved as "shadow twins" alongside the original files, preserving the source while providing searchable, structured content.

**Batch Processing:** Process multiple files simultaneously → [Batch Operations Use Case](./docs/use-cases/batch-operations.md)

### Web Scraping & Event Import

Scrape and import content from websites using the Event Monitor. Extract structured data from web pages, convert them to Markdown format, and import them into your library. Useful for capturing event information, session data, and web-based content.

**Learn more:** [Web Scraping Use Case](./docs/use-cases/web-scraping.md)

### Gallery Publishing

Publish and organize transformed content in public or private galleries. Galleries provide a web interface for browsing, searching, and accessing knowledge. Content can be organized by tags, categories, and custom metadata.

**Learn more:** [Publishing Use Case](./docs/use-cases/publishing.md)

### Chat & Story Mode

Query your knowledge base using natural language. The Chat & story interface uses RAG (Retrieval-Augmented Generation) to find relevant content and generate answers based on your library's documents. Supports filtering by metadata, facets, and custom queries.

**Learn more:** [Chat & Story Mode Use Case](./docs/use-cases/chat-exploration.md)

---

## ⚖️ License

This repository uses a **dual-license model**:

- **Source Code** → [GNU Affero General Public License v3.0](./LICENSE)  
  - You are free to use, modify, and distribute the code **as long as you publish your modifications** under the same license.  
  - If you run a modified version as a web service, the corresponding source code **must be made available** to users (AGPL requirement).

- **Documentation, Texts, Slides, and Media** → [Creative Commons BY-NC-SA 4.0](./LICENSE_CONTENT.txt)  
  - You may share and adapt these materials **for non-commercial purposes**,  
    as long as you provide **proper attribution** and distribute derivatives under the same license.  
  - Commercial use requires **explicit written permission**.

---

## 🧠 Attribution

When reusing or citing materials from this repository, please include the following attribution:

> "Common Knowledge Stack by Peter Aichner (B*commonsLAB), licensed under CC BY-NC-SA 4.0 / AGPL v3."

If you use or extend the codebase, please keep the author credits in the source headers.

---

## 🤝 Contributing

We welcome non-commercial collaboration in the spirit of commons and open research.  
Pull requests, feedback, and local experiments are encouraged.

For partnership or academic collaboration requests, contact:  
📧 **peter.aichner@crystal-design.com**

---

## 📚 Further Documentation

### Use Cases

Practical step-by-step guides for common tasks:

- [Use Cases Overview](./docs/use-cases/index.md) – Complete list of available use cases
- [Library Setup](./docs/use-cases/library-setup.md) – Create and configure a library
- [PDF Transformation](./docs/use-cases/file-transformation-pdf.md) – Transform PDF files into Markdown
- [Media Transformation](./docs/use-cases/file-transformation-media.md) – Transcribe audio and video files
- [Web Scraping](./docs/use-cases/web-scraping.md) – Scrape web content and import events
- [Publishing](./docs/use-cases/publishing.md) – Publish your library publicly
- [Chat & Story Mode](./docs/use-cases/chat-exploration.md) – Explore knowledge with chat
- [Batch Operations](./docs/use-cases/batch-operations.md) – Process multiple files simultaneously

### Architecture Documentation

System design and module documentation:

- [Documentation Index](./docs/index.md) – Main documentation entry point
- [Module Hierarchy](./docs/architecture/module-hierarchy.md) – Application module structure
- [Dependency Graph](./docs/architecture/dependency-graph.md) – Module dependencies visualization

### Reference Documentation

Technical reference for developers:

- [File Index](./docs/reference/file-index.md) – Complete index of documented source files
- [Storage Module](./docs/reference/modules/storage.md) – Storage provider system documentation
- [Library Module](./docs/reference/modules/library.md) – Library management documentation
- [Chat Module](./docs/reference/modules/chat.md) – Chat and RAG system documentation

---

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State Management**: Jotai, React Hook Form
- **Authentication**: Clerk
- **Database**: MongoDB
- **Vector Database**: MongoDB Atlas Vector Search
- **AI/ML**: OpenAI (GPT models, embeddings)
- **Build Tool**: pnpm

---

## 📋 System Requirements

- Node.js >= 18
- pnpm >= 9.15
- Git
- MongoDB (or MongoDB Atlas)
- OpenAI API key (for chat and embeddings)

---

## 🌍 Project Home

Part of the **b*commonsLAB** initiative – developing open infrastructures for shared knowledge and digital sovereignty.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Clerk](https://clerk.dev/)
- [Radix UI](https://www.radix-ui.com/)
