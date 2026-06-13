import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Holt einmal pro Lauf einen Clerk-Testing-Token (nutzt CLERK_SECRET_KEY +
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY aus .env). Der Token wird von
 * setupClerkTestingToken in den Tests verwendet, um Clerks Bot-Erkennung zu
 * umgehen — sonst scheitert der Session-Handshake im automatisierten Browser.
 */
export default async function globalSetup(): Promise<void> {
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY })
}
