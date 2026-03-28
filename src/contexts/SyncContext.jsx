import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync } from '../lib/sync';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const syncingRef = useRef(false);
  const lastWriteRef = useRef(0); // timestamp of last user write

  // Track when user makes changes — prevents pull from racing
  useEffect(() => {
    const handleWrite = () => { lastWriteRef.current = Date.now(); };
    window.addEventListener('studyhub-storage-write', handleWrite);
    return () => window.removeEventListener('studyhub-storage-write', handleWrite);
  }, []);

  const doFullSync = useCallback(async () => {
    if (!user || syncingRef.current) return;

    // Don't pull if user wrote something in the last 10 seconds
    // Their push might still be in-flight
    const timeSinceWrite = Date.now() - lastWriteRef.current;
    if (timeSinceWrite < 10000 && lastWriteRef.current > 0) {
      console.log(`[Sync] Skipping pull — user wrote ${Math.round(timeSinceWrite / 1000)}s ago`);
      return;
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

  // Sync on login
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setLastSynced(null);
      return;
    }

    // On login: sync immediately (no write cooldown check)
    syncingRef.current = true;
    setSyncStatus('syncing');
    fullSync(user.id).then(() => {
      setSyncStatus('synced');
      setLastSynced(new Date());
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    }).catch(err => {
      console.error('[Sync] Login sync error:', err);
      setSyncStatus('error');
      setSyncError(err.message);
    }).finally(() => {
      syncingRef.current = false;
    });

    // Sync on tab focus (with write cooldown)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        doFullSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic sync every 3 min (with write cooldown)
    const interval = setInterval(doFullSync, 3 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [user]);

  const manualSync = useCallback(async () => {
    // Manual sync bypasses write cooldown
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await fullSync(user.id);
      setSyncStatus('synced');
      setLastSynced(new Date());
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err.message);
    } finally {
      syncingRef.current = false;
    }
  }, [user]);

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
