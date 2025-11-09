# Unused and Redundant Code Analysis

Analysis of potentially unused or redundant files in the codebase, based on import analysis and codebase search.

**Analysis Date**: 2025-01-XX
**Total Files Analyzed**: ~424 files

## Summary

- **✅ Removed**: 7 files (Test/Development files, redundant wrappers, unused atoms, redundant toast hook)
- **⚠️ Legacy/Deprecated**: 2 files (Azure Storage - optional, still used in ingestion-service.ts)
- **✅ Resolved**: PDF defaults are NOT redundant (different purposes)
- **🔍 Needs Review**: 10+ files (Low import count, potential consolidation)

---

## 🔴 Confirmed Unused Files (Safe to Remove)

### Test/Development Files

| File Path | Type | Reason | Import Count |
|-----------|------|--------|--------------|
| `src/app/api/auth-test/route.ts` | Test API | Test endpoint, not used in production | 0 |
| `src/app/api/teststorage/route.ts` | Test API | Test endpoint, not used in production | 0 |
| `src/app/api/env-test/route.ts` | Test API | Test endpoint, only imports test-env | 1 |
| `src/lib/test-env.ts` | Test Utility | Only used by env-test route | 1 |
| `src/lib/debug/wdyr.ts` | Dev Tool | Why Did You Render - development only | 1 |

**Action**: Remove all test/development files listed above.

---

## 🟡 Redundant Files (Duplicate Functionality)

### Debug Footer Wrappers

| File Path | Problem | Solution |
|-----------|---------|----------|
| `src/components/debug/debug-footer-client.tsx` | Both files wrap `debug-footer.tsx` identically with SSR disabled | Remove one (keep `debug-footer-wrapper.tsx`) |
| `src/components/debug/debug-footer-wrapper.tsx` | Both files wrap `debug-footer.tsx` identically with SSR disabled | Keep this one |

**Action**: Remove `debug-footer-client.tsx`, keep `debug-footer-wrapper.tsx`.

### Legacy Atoms File

| File Path | Problem | Solution |
|-----------|---------|----------|
| `src/lib/atoms/library.ts` | Never imported (0 imports found) | Remove - functionality moved to `src/atoms/library-atom.ts` |
| `src/atoms/library-atom.ts` | Active file for library state | Keep |

**Action**: Remove `src/lib/atoms/library.ts`.

---

## 🟡 Legacy/Deprecated Files (Needs Evaluation)

### Azure Storage Service

| File Path | Status | Usage | Recommendation |
|-----------|--------|-------|----------------|
| `src/lib/services/azure-storage-service.ts` | Legacy | 1 import (ingestion-service.ts) | **Evaluate**: If Azure Storage is deprecated in favor of Nextcloud, archive these files |
| `src/lib/config/azure-storage.ts` | Legacy | 2 imports (azure-storage-service, ingestion-service) | **Evaluate**: Check if still needed for existing deployments |

**Note**: According to README.md, Azure Storage was replaced by Nextcloud (in development). However, these files may still be needed for existing deployments.

**Action**: 
1. Check if Azure Storage is still configured in any libraries
2. If not, archive these files
3. If yes, keep until migration is complete

---

## 🟡 Potential Redundancy (Needs Review)

### PDF Defaults

| File Path | Location | Usage |
|-----------|----------|-------|
| `src/lib/pdf-defaults.ts` | Library code | To be verified |
| `src/atoms/pdf-defaults.ts` | Atoms | To be verified |

**Action**: Review if both files serve different purposes or can be consolidated.


---

## ✅ Resolved: Not Redundant

### PDF Defaults

| File Path | Purpose | Status |
|-----------|---------|--------|
| `src/lib/pdf-defaults.ts` | Persistent defaults in localStorage | **Keep** - Different purpose |
| `src/atoms/pdf-defaults.ts` | Runtime overrides in Jotai atoms | **Keep** - Different purpose |

**Conclusion**: These files serve different purposes and are both needed.

---

## 🟡 Toast Hooks Redundancy

| File Path | Usage | Difference | Recommendation |
|-----------|-------|-----------|----------------|
| `src/components/ui/use-toast.ts` | 11 imports | Uses `Number.MAX_VALUE` | **Keep** - Standard ShadCN version |
| `src/hooks/use-toast.ts` | 1 import | Uses `Number.MAX_SAFE_INTEGER` | **Replace** - Update import in `template-management.tsx` |

**Action**: 
1. Update `src/components/templates/template-management.tsx` to use `@/components/ui/use-toast` instead of `@/hooks/use-toast`
2. Remove `src/hooks/use-toast.ts` after verification

---

## 🟢 Low Usage Files (Needs Verification)

These files have low import counts and should be verified:

| File Path | Import Count | Notes |
|-----------|--------------|-------|
| `src/lib/external-jobs/template-files.ts` | 4 | Used in template management |
| `src/lib/library/favorites.ts` | 2 | Used in breadcrumb and library components |
| `src/lib/templates/placeholders.ts` | 1 | Used in template-files |
| `src/lib/ingestion/page-split.ts` | 1 | Used in ingestion service |
| `src/lib/session/session-utils.ts` | 3 | Used in chat components |
| `src/lib/markdown/compose.ts` | Unknown | Needs verification |
| `src/lib/pdfjs-worker-setup.ts` | Unknown | Needs verification |
| `src/lib/chat/debug-stats.ts` | Unknown | Needs verification |
| `src/lib/chat/metadata-extractor.ts` | Unknown | Needs verification |
| `src/lib/chat/embeddings.ts` | Unknown | Needs verification |
| `src/lib/chat/common/budget.ts` | Unknown | Needs verification |
| `src/lib/chat/common/toc-parser.ts` | Unknown | Needs verification |
| `src/lib/secretary/constants.ts` | Unknown | Needs verification |
| `src/atoms/create-library-atom.ts` | Unknown | Needs verification |
| `src/atoms/template-atom.ts` | Unknown | Needs verification |
| `src/atoms/combined-chat-atom.ts` | Unknown | Needs verification |
| `src/hooks/use-selected-file.ts` | Unknown | Needs verification |
| `src/hooks/use-transcription-twins.ts` | Unknown | Needs verification |

**Action**: Verify each file's usage before removal.

---

## Recommended Cleanup Order

### Phase 1: Safe Removals ✅ COMPLETED
1. ✅ Removed test API routes (`auth-test`, `teststorage`, `env-test`)
2. ✅ Removed test utility (`test-env.ts`)
3. ✅ Removed redundant debug wrapper (`debug-footer-client.tsx`)
4. ✅ Removed unused atoms file (`src/lib/atoms/library.ts`)

### Phase 2: Toast Hook Consolidation ✅ COMPLETED
1. ✅ Updated `template-management.tsx` to use `@/components/ui/use-toast`
2. ✅ Removed `src/hooks/use-toast.ts`

### Phase 3: Evaluation Required
1. ⚠️ Evaluate Azure Storage files (check if still needed)

### Phase 4: Verification Required
1. 🔍 Verify low-usage files before removal
2. 🔍 Check for commented-out code that can be removed
3. 🔍 Review deprecated API routes

---

## Notes

- All removals should be tested to ensure no runtime errors
- Files marked as "Legacy" should be archived rather than deleted if they might be needed for existing deployments
- Low-usage files may still be critical for specific features - verify before removal

