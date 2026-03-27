import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Keys that should NOT sync to Supabase
const NO_SYNC = new Set([
  'studyhub-theme',
  'studyhub-custom-theme',
  'studyhub-sync-timestamps',
  'studyhub-deleted-guides',
  'studyhub-last-session',
  'studyhub-guide-index',
]);

function shouldSync(key) {
  return key.startsWith('studyhub-') && !NO_SYNC.has(key) &&
    !key.startsWith('studyhub-guide-data:');
}

// Get current user ID from supabase session (cached)
let _cachedUserId = null;
async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    _cachedUserId = data?.session?.user?.id || null;
    return _cachedUserId;
  } catch { return null; }
}

// Listen for auth changes to update cached user ID
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    _cachedUserId = session?.user?.id || null;
  });
}

// Push a single key to Supabase — fire and forget, no await in the hook
function pushToSupabase(key, value) {
  if (!supabase || !shouldSync(key)) return;

  getUserId().then(userId => {
    if (!userId) return;

    if (value === null || value === undefined) {
      supabase.from('user_data').delete().eq('user_id', userId).eq('key', key)
        .then(({ error }) => { if (error) console.error('[Sync] Delete failed:', key, error); });
    } else {
      supabase.from('user_data')
        .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
        .then(({ error }) => { if (error) console.error('[Sync] Push failed:', key, error); });
    }
  });
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

  // Write to localStorage AND push to Supabase
  useEffect(() => {
    try {
      const json = JSON.stringify(storedValue);
      // Don't re-write if the value hasn't actually changed
      if (json === lastWrittenRef.current) return;
      lastWrittenRef.current = json;
      localStorage.setItem(key, json);

      // Push to Supabase immediately (fire and forget)
      pushToSupabase(key, storedValue);

      // Notify other hook instances on this page
      window.dispatchEvent(new CustomEvent('studyhub-storage-write', { detail: { key } }));
    } catch {
      // Storage full or unavailable
    }
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
