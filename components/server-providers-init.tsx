'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/auth/client';
import { useSettingsStore } from '@/lib/store/settings';

/**
 * Fetches server-configured providers on mount and merges into settings store.
 * Also hydrates admin config from DB after login (all pages).
 * Renders nothing — purely a side-effect component.
 */
export function ServerProvidersInit() {
  const { data: session } = useSession();
  const fetchServerProviders = useSettingsStore((state) => state.fetchServerProviders);

  // Immediat: server providers per a tothom (sense sessió requerida)
  useEffect(() => {
    fetchServerProviders();
  }, [fetchServerProviders]);

  // Post-login: admin → hydrate des de BD (totes les pàgines); non-admin → re-fetch filtrat
  useEffect(() => {
    if (!session?.user?.id) return;

    if (session.user.role === 'admin') {
      fetch('/api/admin/config/providers')
        .then((r) => r.json())
        .then((data) => {
          if (data?.config) {
            useSettingsStore.getState().hydrate(data.config);
          }
        })
        .catch(() => {});
    } else {
      // Re-fetch post-login per aplicar filtre allowedModels per a l'usuari concret
      fetchServerProviders();
    }
  }, [session?.user?.id, session?.user?.role, fetchServerProviders]);

  return null;
}
