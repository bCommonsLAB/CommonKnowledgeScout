# Dependency Analysis

This document analyzes import patterns and dependencies across the codebase.

## Most Imported Modules

Based on import analysis (1079 imports from `@/` across 328 files), the most frequently imported modules are:

### Core Infrastructure (Most Imported)
1. **`@/lib/storage/storage-factory.ts`** - Storage provider factory
2. **`@/lib/storage/types.ts`** - Storage type definitions
3. **`@/lib/services/library-service.ts`** - Library service
4. **`@/types/library.ts`** - Library type definitions
5. **`@/lib/env.ts`** - Environment variables
6. **`@/lib/auth.ts`** - Authentication utilities
7. **`@/lib/mongodb-service.ts`** - Database service

### Storage Layer
- `@/lib/storage/filesystem-provider.ts`
- `@/lib/storage/onedrive-provider.ts`
- `@/lib/storage/server-provider.ts`
- `@/contexts/storage-context.tsx`
- `@/hooks/use-storage-provider.tsx`

### Chat System
- `@/lib/chat/orchestrator.ts`
- `@/lib/chat/loader.ts`
- `@/lib/chat/config.ts`
- `@/lib/chat/constants.ts`
- `@/lib/chat/retrievers/chunks.ts`
- `@/lib/chat/retrievers/summaries-mongo.ts`
- `@/lib/chat/common/prompt.ts`
- `@/lib/chat/common/filters.ts`
- `@/lib/chat/common/llm.ts`

### Components
- `@/components/library/library.tsx`
- `@/components/ui/*` (UI components)
- `@/components/shared/*` (Shared components)

### Types
- `@/types/chat.ts`
- `@/types/chat-response.ts`
- `@/types/query-log.ts`
- `@/types/session.ts`
- `@/types/external-job.ts`

## Dependency Graph Structure

### Layer 1: Core Infrastructure (No internal dependencies)
- `src/middleware.ts`
- `src/app/layout.tsx`
- `src/instrumentation.ts`
- `src/lib/env.ts`
- `src/lib/auth.ts`
- `src/lib/mongodb-service.ts`

### Layer 2: Storage Layer (Depends on Layer 1)
- `src/lib/storage/types.ts` → `src/types/library.ts`
- `src/lib/storage/storage-factory.ts` → `src/lib/storage/types.ts`, `src/lib/storage/filesystem-provider.ts`, `src/lib/storage/onedrive-provider.ts`
- `src/lib/storage/filesystem-provider.ts` → `src/lib/storage/types.ts`, `src/types/library.ts`
- `src/lib/storage/onedrive-provider.ts` → `src/lib/storage/types.ts`, `src/types/library.ts`
- `src/contexts/storage-context.tsx` → `src/lib/storage/storage-factory.ts`
- `src/hooks/use-storage-provider.tsx` → `src/contexts/storage-context.tsx`

### Layer 3: Library System (Depends on Layer 2)
- `src/types/library.ts` → (no internal deps)
- `src/atoms/library-atom.ts` → `src/types/library.ts`
- `src/lib/services/library-service.ts` → `src/lib/mongodb-service.ts`, `src/types/library.ts`
- `src/components/library/library.tsx` → `src/lib/storage/storage-factory.ts`, `src/atoms/library-atom.ts`, `src/lib/services/library-service.ts`

### Layer 4: Chat System (Depends on Layer 3)
- `src/types/chat.ts` → `src/types/library.ts`
- `src/lib/chat/constants.ts` → (no internal deps)
- `src/lib/chat/orchestrator.ts` → `src/lib/chat/loader.ts`, `src/lib/chat/common/prompt.ts`, `src/lib/chat/common/llm.ts`
- `src/lib/chat/loader.ts` → `src/lib/services/library-service.ts`, `src/lib/mongodb-service.ts`
- `src/app/api/chat/[libraryId]/stream/route.ts` → `src/lib/chat/orchestrator.ts`, `src/lib/services/library-service.ts`

### Layer 5: API Routes & Components (Depends on Layers 1-4)
- All API routes depend on services and libraries
- Components depend on hooks, contexts, and library code

## Circular Dependencies

### Potential Circular Dependencies to Check:
1. **Storage Factory ↔ Storage Providers**
   - `storage-factory.ts` imports providers
   - Providers may import factory (needs verification)

2. **Library Service ↔ Storage Factory**
   - `library-service.ts` may use storage
   - Storage may reference library types

3. **Chat Orchestrator ↔ Chat Loader**
   - `orchestrator.ts` imports `loader.ts`
   - `loader.ts` may import orchestrator utilities

## Unused Imports (To Verify)

Based on commented-out imports found:
- `src/app/api/external/jobs/[jobId]/route.ts` has commented imports:
  - `FileSystemProvider` (commented)
  - `ImageExtractionService` (commented)
  - `TransformService` (commented)
  - `parseSecretaryMarkdownStrict` (marked as unused)

## Import Patterns

### Most Common Import Patterns:
1. **Type Imports**: `import type { ... } from '@/types/...'`
2. **Component Imports**: `import { Component } from '@/components/...'`
3. **Service Imports**: `import { Service } from '@/lib/services/...'`
4. **Utility Imports**: `import { util } from '@/lib/utils'`

### Import Categories:
- **Types**: ~15% of imports
- **Components**: ~35% of imports
- **Library/Utils**: ~30% of imports
- **Hooks/Contexts**: ~10% of imports
- **Atoms**: ~5% of imports
- **Other**: ~5% of imports

## Recommendations

1. **Document Core Modules First**: Start with Layer 1 (Core Infrastructure)
2. **Follow Dependency Order**: Document layers in order (1 → 2 → 3 → 4 → 5)
3. **Check Circular Dependencies**: Verify and document any circular dependencies found
4. **Clean Up Unused Imports**: Remove commented imports and verify unused code
5. **Standardize Import Patterns**: Ensure consistent import style across codebase

## Next Steps

1. Complete dependency analysis for specific modules
2. Create visual dependency graph
3. Identify and document circular dependencies
4. Create import/export audit report
5. Document module boundaries and interfaces

