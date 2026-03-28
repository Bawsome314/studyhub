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
function getUserId() {
  return _cachedUserId;
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    _cachedUserId = data?.session?.user?.id || null;
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedUserId = session?.user?.id || null;
    // On sign-in, flush any pending writes
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
    // Not signed in — queue for later
    addPendingWrite(key, value);
    return;
  }

  if (!_isOnline) {
    // Offline — queue for reconnect
    addPendingWrite(key, value);
    return;
  }

  // Online + signed in — push immediately
  const doWrite = (value === null || value === undefined)
    ? supabase.from('user_data').delete().eq('user_id', userId).eq('key', key)
    : supabase.from('user_data').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

  doWrite.then(({ error }) => {
    if (error) {
      console.error('[Sync] Push failed, queuing:', key, error.message);
      addPendingWrite(key, value);
    } else {
      // Success — remove from pending if it was there
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

  // Write to localStorage AND push to Supabase
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      if (json === lastWrittenRef.current) return;
      lastWrittenRef.current = json;
      localStorage.setItem(key, json);

      // Push to Supabase (queues if offline/failed)
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
