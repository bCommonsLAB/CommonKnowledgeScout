# Knowledge Scout Project Context

## Project Overview
Knowledge Scout is a Next.js-based file management and knowledge organization system with a sophisticated storage provider architecture.

## Technical Stack
- Next.js 14.0.4 (App Router)
- React 18 + TypeScript 5
- Tailwind CSS 3.3.0
- UI: shadcn/ui, Radix UI, Lucide React, Geist
- State: Jotai, React Hook Form + Zod
- Auth: Clerk
- Package Manager: PNPM

## Core Architecture

### Project Structure
```
/app                    # Next.js App Router directory
  /api                  # API routes
  /library             # Library components
  layout.tsx           # Main layout
  page.tsx             # Main page
/src
  /components          # Reusable React components
  /hooks               # Custom React hooks
  /lib                 # Utilities and libraries
  /styles             # Styling files
  /types              # TypeScript definitions
```

### Key Components

1. Library Component (Main)
- Purpose: Central file library view
- Features: State management, directory navigation, file preview
- Props: libraries[], defaultLayout[20,32,48], defaultCollapsed, navCollapsedSize

2. Storage Provider System
- Abstract interface for different storage systems
- Implements uniform operations across storage types
- Core interface
-
1. File Management Components
- FileTree: Hierarchical folder structure navigation
- FileList: File listing with sort/filter capabilities
- FilePreview: Multi-format file preview support
- LibrarySwitcher: Library selection and management

### Data Flow Architecture
1. Frontend:
   - Component hierarchy: Library → FileTree/FileList/FilePreview
   - State management through Jotai
   - Form handling with React Hook Form + Zod validation

2. Storage Layer:
   - Provider abstraction for multiple storage systems
   - Event-based operation flow
   - Caching system for folder structures

3. API Layer:
   - Next.js API routes for backend operations
   - Middleware for request handling
   - TypeScript types for API safety

## Implementation Notes
- Uses ResizablePanelGroup for flexible layouts
- Implements dark/light mode via next-themes
- Markdown processing with react-markdown + rehype/remark plugins
- Storage provider factory pattern for extensibility
- Event-based communication between components

## Common Operations Flow
1. UI triggers provider method
2. Provider transforms to API request
3. Backend processes operation
4. Result propagates back
5. UI updates state

Key Technical Requirements:
- TypeScript strict mode
- ESLint for code quality
- Proper error handling at all levels
- Responsive design support
- Type-safe API communications