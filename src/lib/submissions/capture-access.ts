/**
 * @fileoverview Server-Helfer: Erfass-Berechtigung einer Library (ADR-0004 E2).
 *
 * @description
 * EINE Wahrheit fuer beide Erfass-Einstiege: die Capture-Route
 * (`POST /api/submissions`) und den UI-Gate (`GET /api/libraries/[id]/me/capture`,
 * der „Inhalte erfassen"-Button). Owner ueber Library-Besitz, sonst aktive
 * Mitglieds-Rolle; gemappt via `resolveCreatorRole`. Kein stiller Fallback —
 * fehlende Berechtigung ergibt `null`.
 *
 * @see src/lib/submissions/submission-capture.ts (resolveCreatorRole)
 * @module lib/submissions
 */

import { LibraryService } from '@/lib/services/library-service';
import { getActiveMemberRole } from '@/lib/repositories/library-members-repo';
import { resolveCreatorRole } from '@/lib/submissions/submission-capture';
import type { SubmissionCreatorRole } from '@/types/wizard-submission';

/**
 * Ermittelt die Erfasser-Rolle des Users in der Library oder `null` (kein Recht).
 * Owner kurzschliessen: bei Library-Besitz wird die Mitglieds-Rolle nicht geladen.
 */
export async function resolveCaptureRole(
  userEmail: string,
  libraryId: string,
): Promise<SubmissionCreatorRole | null> {
  const isOwner = (await LibraryService.getInstance().getLibrary(userEmail, libraryId)) !== null;
  const memberRole = isOwner ? null : await getActiveMemberRole(libraryId, userEmail);
  return resolveCreatorRole(isOwner, memberRole);
}
