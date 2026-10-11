import React from 'react';
import AuthLayout from '@/components/AuthLayout';
import { ShieldCheck } from 'lucide-react';

export default function OAuthConsent() {
  return (
    <AuthLayout
      icon={ShieldCheck}
      title="External access"
      subtitle="This application does not use the previous Base44 MCP authorization service."
    >
      <p className="text-sm text-muted-foreground text-center">
        External AI-client authorization is not enabled in the independent deployment.
      </p>
    </AuthLayout>
  );
}
