import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync } from '../lib/sync';

const SyncContext = createContext();

const WRITE_COOLDOWN_MS = 15000; // 15 seconds — don't pull if user wrote recently
const PERIODIC_SYNC_MS = 3 * 60 * 1000;

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const syncingRef = useRef(false);
  const lastWriteRef = useRef(0);
  const hasInitialSyncedRef = useRef(false);

  // Track user writes
  useEffect(() => {
    const handleWrite = () => { lastWriteRef.current = Date.now(); };
    window.addEventListener('studyhub-storage-write', handleWrite);
    return () => window.removeEventListener('studyhub-storage-write', handleWrite);
  }, []);

  const doSync = useCallback(async (force = false) => {
    if (!user || syncingRef.current) return;

    // ALL syncs respect cooldown unless forced
    if (!force) {
      const elapsed = Date.now() - lastWriteRef.current;
      if (elapsed < WRITE_COOLDOWN_MS && lastWriteRef.current > 0) {
        console.log(`[Sync] Skipping — user wrote ${Math.round(elapsed / 1000)}s ago`);
        return;
      }
    }

    syncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      await fullSync(user.id);
      setSyncStatus('synced');
      setLastSynced(new Date());
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

  // Initial sync on sign-in (once)
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setLastSynced(null);
      hasInitialSyncedRef.current = false;
      return;
    }

    // Only do initial sync ONCE per sign-in, not on every token refresh
    if (hasInitialSyncedRef.current) return;
    hasInitialSyncedRef.current = true;

    doSync(true); // force = true for initial sync

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') doSync();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => doSync(), PERIODIC_SYNC_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [user, doSync]);

  const manualSync = useCallback(() => doSync(true), [doSync]);

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
