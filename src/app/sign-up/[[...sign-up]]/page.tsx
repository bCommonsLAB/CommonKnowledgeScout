/**
 * @fileoverview Clerk Sign-Up Page (App Router)
 *
 * @description
 * Minimal Sign-Up Route für Clerk. Unsere Middleware erlaubt `/sign-up(.*)` als public,
 * daher muss diese Route existieren, sonst erhalten Benutzer eine 404.
 *
 * @module app/sign-up
 */

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <SignUp />
      </div>
    </div>
  );
}


