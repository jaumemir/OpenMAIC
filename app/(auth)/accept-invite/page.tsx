'use client';

import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import AcceptInviteForm from './accept-invite-form';

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Verificant invitació...</p>
          </CardContent>
        </Card>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
