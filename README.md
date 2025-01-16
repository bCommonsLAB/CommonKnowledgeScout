# Knowledge Scout

A sophisticated file management and knowledge organization system built with Next.js 14, featuring a flexible storage provider architecture and modern UI components.

## Features

- 📁 Advanced file management with hierarchical navigation
- 🔍 Powerful file preview for multiple formats (Markdown, Audio, Video, Images)
- 🎨 Modern, responsive UI with dark/light mode support
- 🔄 Flexible storage provider system for different backends
- 📝 Rich Markdown support with Obsidian compatibility
- 🎵 Audio transcription capabilities
- 🔒 Secure authentication with Clerk

## Tech Stack

- **Framework:** Next.js 14.0.4 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3.3.0
- **UI Components:** 
  - shadcn/ui
  - Radix UI
  - Geist UI
  - Lucide React icons
- **State Management:**
  - Jotai for atomic state
  - TanStack Query for server state
  - React Hook Form + Zod for forms
- **Authentication:** Clerk
- **Package Manager:** pnpm

## Getting Started

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
cd knowledge-scout
\`\`\`

2. Install dependencies:
\`\`\`bash
pnpm install
\`\`\`

3. Copy the environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Configure your environment variables in \`.env\`

5. Start the development server:
\`\`\`bash
pnpm dev
\`\`\`

## Project Structure

\`\`\`
/app                    # Next.js App Router directory
  /api                  # API routes
  /library             # Library components
  layout.tsx           # Main layout
  page.tsx             # Main page
/src
  /components          # Reusable React components
    /library          # Library-specific components
    /mail            # Mail components
    /ui              # UI components
    /shared          # Shared components
  /hooks              # Custom React hooks
  /lib                # Utilities and libraries
  /styles            # Styling files
  /types             # TypeScript definitions
\`\`\`

## Storage Provider System

The application uses a flexible storage provider architecture that allows integration with various storage backends:

- Local filesystem
- SharePoint/OneDrive (planned)
- Google Drive (planned)
- Custom storage implementations

Each provider implements a standard interface for consistent file operations across different storage systems.

## Development

### Code Style

- Functional and declarative programming patterns
- TypeScript with strict mode enabled
- ESLint and Prettier for code formatting
- Component-based architecture

### Testing

- Vitest for unit and integration tests
- Playwright for E2E testing
- Testing Library best practices

### Performance

- React Server Components (RSC) where possible
- Dynamic imports for code splitting
- Image optimization with next/image
- Proper caching strategies

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[License Type] - See LICENSE file for details

