'use client';

import { SignInButton } from "@clerk/nextjs";
import { Button } from '@ks/ui'
import { useTranslation } from "@ks/i18n/react";

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