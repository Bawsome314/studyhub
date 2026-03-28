import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ═══ SYNC CONFIG ═══

const NO_SYNC = new Set([
  'studyhub-theme',
  'studyhub-custom-theme',
  'studyhub-deleted-guides',
  'studyhub-last-session',
  'studyhub-guide-index',
]);

function shouldSync(key) {
  return key.startsWith('studyhub-') && !NO_SYNC.has(key) &&
    !key.startsWith('studyhub-guide-data:');
}

// ═══ AUTH CACHE ═══

let _cachedUserId = null;
let _sessionReady = false;

function getUserId() {
  return _cachedUserId;
}

if (supabase) {
  // Get initial session
  supabase.auth.getSession().then(({ data }) => {
    _cachedUserId = data?.session?.user?.id || null;
    _sessionReady = true;
    if (_cachedUserId) {
      console.log('[Sync] Session ready, userId:', _cachedUserId.substring(0, 8) + '...');
      flushPendingWrites();
    }
  });
  // Listen for changes
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedUserId = session?.user?.id || null;
    _sessionReady = true;
    if (_cachedUserId) flushPendingWrites();
  });
}

// ═══ OFFLINE QUEUE ═══
// When offline or Supabase write fails, writes queue here.
// On reconnect, they flush to Supabase.

const PENDING_KEY = 'studyhub-pending-writes';

function getPendingWrites() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
  } catch { return {}; }
}

function addPendingWrite(key, value) {
  const pending = getPendingWrites();
  pending[key] = { value, timestamp: Date.now() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function removePendingWrite(key) {
  const pending = getPendingWrites();
  delete pending[key];
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function clearAllPending() {
  localStorage.removeItem(PENDING_KEY);
}

// ═══ ONLINE STATUS ═══

let _isOnline = navigator.onLine;

window.addEventListener('online', () => {
  _isOnline = true;
  window.dispatchEvent(new Event('studyhub-online-change'));
  flushPendingWrites();
});
window.addEventListener('offline', () => {
  _isOnline = false;
  window.dispatchEvent(new Event('studyhub-online-change'));
});

export function isOnline() { return _isOnline; }

// ═══ PUSH TO SUPABASE ═══

function pushToSupabase(key, value) {
  if (!supabase || !shouldSync(key)) return;

  const userId = getUserId();
  if (!userId) {
    console.log('[Sync] No userId yet, queuing:', key);
    addPendingWrite(key, value);
    return;
  }

  if (!_isOnline) {
    console.log('[Sync] Offline, queuing:', key);
    addPendingWrite(key, value);
    return;
  }

  // Online + signed in — push immediately
  const doWrite = (value === null || value === undefined)
    ? supabase.from('user_data').delete().eq('user_id', userId).eq('key', key)
    : supabase.from('user_data').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

  doWrite.then(({ error }) => {
    if (error) {
      console.error('[Sync] Push FAILED:', key, error.message);
      addPendingWrite(key, value);
    } else {
      removePendingWrite(key);
    }
  });
}

// Flush all pending writes to Supabase
async function flushPendingWrites() {
  if (!supabase || !_isOnline) return;
  const userId = getUserId();
  if (!userId) return;

  const pending = getPendingWrites();
  const keys = Object.keys(pending);
  if (keys.length === 0) return;

  console.log(`[Sync] Flushing ${keys.length} pending writes...`);

  for (const key of keys) {
    const { value } = pending[key];
    try {
      const op = (value === null || value === undefined)
        ? supabase.from('user_data').delete().eq('user_id', userId).eq('key', key)
        : supabase.from('user_data').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

      const { error } = await op;
      if (!error) {
        removePendingWrite(key);
      } else {
        console.error('[Sync] Flush failed for:', key, error.message);
      }
    } catch (err) {
      console.error('[Sync] Flush error:', key, err);
    }
  }
}

// Export for force sync
export { flushPendingWrites, clearAllPending };

// ═══ THE HOOK ═══

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const lastWrittenRef = useRef(null);
  const isFirstRender = useRef(true);
  const hadExistingData = useRef(localStorage.getItem(key) !== null);

  // Write to localStorage AND push to Supabase
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      if (json === lastWrittenRef.current) return;

      const isMount = isFirstRender.current;
      isFirstRender.current = false;
      lastWrittenRef.current = json;
      localStorage.setItem(key, json);

      // CRITICAL: Don't push to Supabase on initial mount if we're just
      // writing the default value. This prevents empty defaults from
      // overwriting real data in Supabase.
      if (isMount && !hadExistingData.current) {
        // This is a default initialization — don't push to Supabase
        return;
      }

      // User-initiated change OR existing data loaded — push to Supabase
      pushToSupabase(key, storedValue);

      // Notify other hook instances on this page
      window.dispatchEvent(new CustomEvent('studyhub-storage-write', { detail: { key } }));
    } catch {}
  }, [key, storedValue]);

  // Re-read when another hook instance writes to the same key
  useEffect(() => {
    const handleStorageWrite = (e) => {
      if (e.detail?.key === key) {
        try {
          const item = localStorage.getItem(key);
          if (item !== null && item !== lastWrittenRef.current) {
            lastWrittenRef.current = item;
            setStoredValue(JSON.parse(item));
          }
        } catch {}
      }
    };
    window.addEventListener('studyhub-storage-write', handleStorageWrite);
    return () => window.removeEventListener('studyhub-storage-write', handleStorageWrite);
  }, [key]);

  // Re-read from localStorage when a sync pull happens
  useEffect(() => {
    const handleSyncPull = () => {
      try {
        const item = localStorage.getItem(key);
        if (item !== null && item !== lastWrittenRef.current) {
          lastWrittenRef.current = item;
          setStoredValue(JSON.parse(item));
        }
      } catch {}
    };
    window.addEventListener('studyhub-sync-pull', handleSyncPull);
    return () => window.removeEventListener('studyhub-sync-pull', handleSyncPull);
  }, [key]);

  return [storedValue, setStoredValue];
}
