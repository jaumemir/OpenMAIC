import { Suspense } from 'react';
import ResetPasswordForm from './reset-password-form';
import { Card, CardContent } from '@/components/ui/card';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Carregant...</CardContent>
        </Card>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
