import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { fullSync, pushKeyToSupabase } from '../lib/sync';

const SyncContext = createContext();

const DEBOUNCE_MS = 2000;
const PERIODIC_SYNC_MS = 5 * 60 * 1000; // 5 minutes

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [lastSynced, setLastSynced] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const pendingKeysRef = useRef(new Set());
  const debounceTimerRef = useRef(null);
  const periodicTimerRef = useRef(null);

  // Full sync on login / mount
  useEffect(() => {
    if (!user) {
      setSyncStatus('idle');
      setLastSynced(null);
      return;
    }

    doFullSync();

    // Periodic sync
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

  // Listen for localStorage writes from useLocalStorage
  useEffect(() => {
    if (!user) return;

    const handleStorageSync = (e) => {
      const key = e.detail?.key;
      if (key && key.startsWith('studyhub-') && key !== 'studyhub-theme' && key !== 'studyhub-sync-timestamps' && !key.startsWith('studyhub-guide-data:')) {
        pendingKeysRef.current.add(key);
        debouncedPush();
      }
    };

    window.addEventListener('studyhub-storage-write', handleStorageSync);
    return () => window.removeEventListener('studyhub-storage-write', handleStorageSync);
  }, [user]);

  const doFullSync = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await fullSync(user.id);
      setSyncStatus('synced');
      setLastSynced(new Date());
      // Dispatch events so UI re-reads localStorage and IndexedDB
      window.dispatchEvent(new Event('studyhub-sync-pull'));
      window.dispatchEvent(new Event('studyhub-guides-updated'));
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
      setSyncError(err.message);
    }
  }, [user]);

  const debouncedPush = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (!user || pendingKeysRef.current.size === 0) return;

      const keys = [...pendingKeysRef.current];
      pendingKeysRef.current.clear();

      try {
        for (const key of keys) {
          await pushKeyToSupabase(user.id, key);
        }
        setLastSynced(new Date());
        setSyncStatus('synced');
      } catch (err) {
        console.error('Push error:', err);
        // Don't set error status for individual pushes - they'll retry on next sync
      }
    }, DEBOUNCE_MS);
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
