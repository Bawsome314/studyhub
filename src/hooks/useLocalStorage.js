import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ═══ SYNC CONFIG ═══

const NO_SYNC = new Set([
  'studyhub-deleted-guides',
  'studyhub-last-session',
  'studyhub-guide-index',
  'studyhub-pending-writes',
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

// Track in-flight pushes so sync can wait for them
const _inFlightPushes = new Set();
export function hasPendingPushes() {
  return _inFlightPushes.size > 0 || Object.keys(getPendingWrites()).length > 0;
}

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

  // Track this push as in-flight
  _inFlightPushes.add(key);

  const doWrite = (value === null || value === undefined)
    ? supabase.from('user_data').delete().eq('user_id', userId).eq('key', key)
    : supabase.from('user_data').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

  doWrite
    .then(({ error }) => {
      _inFlightPushes.delete(key);
      if (error) {
        console.error('[Sync] Push FAILED:', key, error.message);
        addPendingWrite(key, value);
      } else {
        console.log('[Sync] Push OK:', key);
        removePendingWrite(key);
      }
    })
    .catch(err => {
      _inFlightPushes.delete(key);
      console.error('[Sync] Push ERROR:', key, err);
      addPendingWrite(key, value);
    });
}

// Flush all pending writes to Supabase — BATCHED into one request
async function flushPendingWrites() {
  if (!supabase || !_isOnline) return;
  const userId = getUserId();
  if (!userId) return;

  const pending = getPendingWrites();
  const keys = Object.keys(pending);
  if (keys.length === 0) return;

  console.log(`[Sync] Flushing ${keys.length} pending writes (batched)...`);

  // Batch all writes into a single upsert
  const rows = [];
  for (const key of keys) {
    const { value } = pending[key];
    if (value !== null && value !== undefined) {
      rows.push({ user_id: userId, key, value });
    }
  }

  if (rows.length > 0) {
    try {
      const { error } = await supabase
        .from('user_data')
        .upsert(rows, { onConflict: 'user_id,key' });

      if (!error) {
        console.log(`[Sync] Flushed ${rows.length} pending writes OK`);
        clearAllPending();
      } else {
        console.error('[Sync] Batch flush failed:', error.message);
      }
    } catch (err) {
      console.error('[Sync] Batch flush error:', err);
    }
  } else {
    clearAllPending();
  }
}

// On page unload: only save keys that have in-flight pushes
// Don't blindly dump everything — that causes 99-write flushes
window.addEventListener('beforeunload', () => {
  for (const key of _inFlightPushes) {
    if (!shouldSync(key)) continue;
    let value;
    try { value = JSON.parse(localStorage.getItem(key)); } catch { continue; }
    if (value !== null && value !== undefined) {
      addPendingWrite(key, value);
    }
  }
});

// Export for force sync
export { flushPendingWrites, clearAllPending };

// ═══ THE HOOK ═══

// Global tracker: keys that have been written by USER ACTIONS (not mount defaults).
// Only keys in this set are allowed to push to Supabase.
const _userChangedKeys = new Set();

// Called when a sync pull writes data — marks those keys as "real" so they can push
export function markKeyAsReal(key) {
  _userChangedKeys.add(key);
}

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
  const mountedRef = useRef(false);

  // Write to localStorage AND push to Supabase
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      if (json === lastWrittenRef.current) return;
      lastWrittenRef.current = json;
      localStorage.setItem(key, json);

      // Only push to Supabase if this key has been changed by a USER ACTION.
      // On mount, components write default values — those must NEVER push.
      // After the first user-initiated change, the key is marked as "real"
      // and all subsequent writes push normally.
      if (!mountedRef.current) {
        mountedRef.current = true;
        // First write from this hook instance — don't push, it's the mount default
        return;
      }

      // Mark this key as user-changed and push
      _userChangedKeys.add(key);
      pushToSupabase(key, storedValue);

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
