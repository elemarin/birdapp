import { createContext, useContext, type ReactNode } from 'react';

import { useBirdListener } from '@/hooks/useBirdListener';
import { useDiagnosticClip } from '@/hooks/useDiagnosticClip';
import { useLocationFilter } from '@/hooks/useLocationFilter';

function useSession() {
  const location = useLocationFilter();
  const listener = useBirdListener(location.scores);
  const clip = useDiagnosticClip(listener.snapshot, listener.stop);
  return { location, listener, clip };
}

const BirdSessionContext = createContext<ReturnType<typeof useSession> | null>(null);

export function BirdSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  return <BirdSessionContext value={session}>{children}</BirdSessionContext>;
}

export function useBirdSession() {
  const session = useContext(BirdSessionContext);
  if (!session) throw new Error('Bird session must be used inside BirdSessionProvider.');
  return session;
}
