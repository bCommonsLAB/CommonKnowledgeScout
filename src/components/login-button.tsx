'use client';

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  return (
    <SignInButton mode="modal">
      <Button>
        Anmelden
      </Button>
    </SignInButton>
  );
} 