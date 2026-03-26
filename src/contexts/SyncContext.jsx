import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync, pushKeyNow } from '../lib/sync';

const SyncContext = createContext();

const PERIODIC_SYNC_MS = 3 * 60 * 1000;

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const periodicTimerRef = useRef(null);

  // Push queue and lock
  const pushQueueRef = useRef(new Set());
  const syncLockRef = useRef(false); // true when fullSync is running

  // Full sync on login
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

  // Listen for writes → push immediately (unless sync is running)
  useEffect(() => {
    if (!user) return;

    const handleStorageSync = (e) => {
      const key = e.detail?.key;
      if (!key || !key.startsWith('studyhub-')) return;
      if (key === 'studyhub-theme' || key === 'studyhub-custom-theme' ||
          key === 'studyhub-sync-timestamps' || key === 'studyhub-deleted-guides' ||
          key === 'studyhub-last-session' || key === 'studyhub-guide-index' ||
          key.startsWith('studyhub-guide-data:')) return;

      pushQueueRef.current.add(key);

      // If fullSync is NOT running, push immediately
      if (!syncLockRef.current) {
        flushPushQueue();
      }
      // If fullSync IS running, the queue will flush after it completes
    };

    window.addEventListener('studyhub-storage-write', handleStorageSync);
    return () => window.removeEventListener('studyhub-storage-write', handleStorageSync);
  }, [user]);

  const flushPushQueue = useCallback(async () => {
    if (!user || pushQueueRef.current.size === 0) return;

    const keys = [...pushQueueRef.current];
    pushQueueRef.current.clear();

    try {
      for (const key of keys) {
        await pushKeyNow(user.id, key);
      }
      setLastSynced(new Date());
    } catch (err) {
      console.error('[Sync] Push failed:', err);
      // Re-queue for retry
      for (const key of keys) pushQueueRef.current.add(key);
    }
  }, [user]);

  const doFullSync = useCallback(async () => {
    if (!user || syncLockRef.current) return;
    syncLockRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      // Step 1: Flush any pending pushes FIRST so Supabase has our latest
      await flushPushQueue();

      // Step 2: Now pull + push + sync guides
      await fullSync(user.id);

      // Step 3: Flush anything that queued during sync
      await flushPushQueue();

      setSyncStatus('synced');
      setLastSynced(new Date());
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    } catch (err) {
      console.error('[Sync] Full sync error:', err);
      setSyncStatus('error');
      setSyncError(err.message);
    } finally {
      syncLockRef.current = false;
    }
  }, [user, flushPushQueue]);

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
