/**
 * @fileoverview Clerk Sign-In Page (App Router)
 *
 * @description
 * Minimal Sign-In Route für Clerk. Diese Route ist notwendig, weil unsere Middleware
 * bei geschützten Routen auf `/sign-in` redirectet.
 *
 * Wichtig: Wir halten die Seite bewusst klein, damit sie als stabile Basis für UI-Tests
 * (z.B. V0 PDF Job-Flow) dient.
 *
 * @module app/sign-in
 */

import { SignIn } from "@clerk/nextjs";
import { SignInRedirectHandler } from "@/components/auth/sign-in-redirect";

export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center px-4 py-10">
      {/* Client-only: nach erfolgreichem Login optional zur gespeicherten URL navigieren */}
      <SignInRedirectHandler />

      <div className="w-full max-w-md">
        <SignIn />
      </div>
    </div>
  );
}


