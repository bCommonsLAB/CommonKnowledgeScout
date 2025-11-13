'use client';

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/hooks";

export function LoginButton() {
  const { t } = useTranslation();
  
  return (
    <SignInButton mode="modal">
      <Button variant="secondary">
        {t('common.signIn')}
      </Button>
    </SignInButton>
  );
} 