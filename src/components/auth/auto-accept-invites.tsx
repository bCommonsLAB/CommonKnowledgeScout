/**
 * @fileoverview Auto Accept Invites Component
 * 
 * @description
 * Client component that automatically accepts pending invitations after login.
 * Should be included in the root layout to handle invitations globally.
 * 
 * @module components/auth
 */

"use client"

import { useAutoAcceptInvites } from '@/hooks/use-auto-accept-invites'

/**
 * Component that automatically accepts pending invitations after login
 * 
 * This component uses the useAutoAcceptInvites hook to handle automatic
 * acceptance of invitations when a user logs in or registers.
 */
export function AutoAcceptInvites() {
  useAutoAcceptInvites()
  return null
}

