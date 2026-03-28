import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync, forceSync as forceSyncFn } from '../lib/sync';

const SyncContext = createContext();

const PERIODIC_SYNC_MS = 3 * 60 * 1000;

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const syncingRef = useRef(false);
  const periodicTimerRef = useRef(null);

  // Pull from Supabase on login, tab focus, and periodically
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setLastSynced(null);
      return;
    }

    doFullSync();

    periodicTimerRef.current = setInterval(doFullSync, PERIODIC_SYNC_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        doFullSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(periodicTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const doFullSync = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      await fullSync(user.id);
      setSyncStatus('synced');
      setLastSynced(new Date());
      // Tell all useLocalStorage hooks to re-read from localStorage
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    } catch (err) {
      console.error('[Sync] Error:', err);
      setSyncStatus('error');
      setSyncError(err.message);
    } finally {
      syncingRef.current = false;
    }
  }, [user]);

  const manualSync = useCallback(() => doFullSync(), [doFullSync]);

  return (
    <SyncContext.Provider value={{ syncStatus, lastSynced, syncError, manualSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}
