import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync, pushKeyNow } from '../lib/sync';

const SyncContext = createContext();

const PERIODIC_SYNC_MS = 3 * 60 * 1000; // 3 minutes

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const periodicTimerRef = useRef(null);
  const pushQueueRef = useRef(new Set());
  const pushingRef = useRef(false);

  // Full sync on login / mount
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setLastSynced(null);
      return;
    }

    doFullSync();

    // Periodic sync (every 3 minutes)
    periodicTimerRef.current = setInterval(doFullSync, PERIODIC_SYNC_MS);

    // Sync on tab focus
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

  // Listen for writes and push IMMEDIATELY (no debounce)
  useEffect(() => {
    if (!user) return;

    const handleStorageSync = (e) => {
      const key = e.detail?.key;
      if (!key || !key.startsWith('studyhub-')) return;
      // Skip internal keys
      if (key === 'studyhub-theme' || key === 'studyhub-custom-theme' ||
          key === 'studyhub-sync-timestamps' || key === 'studyhub-deleted-guides' ||
          key === 'studyhub-last-session' || key === 'studyhub-guide-index' ||
          key.startsWith('studyhub-guide-data:')) return;

      pushQueueRef.current.add(key);
      flushPushQueue();
    };

    window.addEventListener('studyhub-storage-write', handleStorageSync);
    return () => window.removeEventListener('studyhub-storage-write', handleStorageSync);
  }, [user]);

  const flushPushQueue = useCallback(async () => {
    if (!user || pushingRef.current || pushQueueRef.current.size === 0) return;
    pushingRef.current = true;

    const keys = [...pushQueueRef.current];
    pushQueueRef.current.clear();

    try {
      for (const key of keys) {
        await pushKeyNow(user.id, key);
      }
      setLastSynced(new Date());
      if (syncStatus !== 'syncing') setSyncStatus('synced');
    } catch (err) {
      console.error('Push error:', err);
      // Re-queue failed keys for retry
      for (const key of keys) pushQueueRef.current.add(key);
    }
    pushingRef.current = false;

    // If more keys queued while we were pushing, flush again
    if (pushQueueRef.current.size > 0) {
      setTimeout(flushPushQueue, 100);
    }
  }, [user, syncStatus]);

  const doFullSync = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await fullSync(user.id);
      setSyncStatus('synced');
      setLastSynced(new Date());
      // Notify all hooks to re-read from localStorage
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
      setSyncError(err.message);
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
