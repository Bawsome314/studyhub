import { supabase } from './supabase';
import { putGuide, getGuide, getAllGuides, deleteGuide } from './indexedDB';
import { updateGuideIndex, readGuideIndex, removeFromGuideIndex } from './guideIndex';
import { markKeyAsReal } from '../hooks/useLocalStorage';

const SYNC_PREFIX = 'studyhub-';
// Keys that are device-local only — never push/pull these
const SKIP_KEYS = [
  'studyhub-deleted-guides',
  'studyhub-last-session',
  'studyhub-pending-writes',
];
const GUIDE_KEY_PREFIX = 'studyhub-guide-data:';
const DELETED_GUIDES_KEY = 'studyhub-deleted-guides';

// ═══ DELETION TOMBSTONES ═══

function getDeletedGuideIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_GUIDES_KEY) || '[]'));
  } catch { return new Set(); }
}

function markGuideDeleted(courseId) {
  const deleted = getDeletedGuideIds();
  deleted.add(courseId);
  localStorage.setItem(DELETED_GUIDES_KEY, JSON.stringify([...deleted]));
}

export function unmarkGuideDeleted(courseId) {
  const deleted = getDeletedGuideIds();
  deleted.delete(courseId);
  localStorage.setItem(DELETED_GUIDES_KEY, JSON.stringify([...deleted]));
}

// ═══ HELPERS ═══

function isGuideKey(key) {
  return key.startsWith(GUIDE_KEY_PREFIX);
}

function isSyncable(key) {
  return key.startsWith(SYNC_PREFIX) && !SKIP_KEYS.includes(key) && !isGuideKey(key) && key !== 'studyhub-guide-index';
}

function getAllLocalKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isSyncable(key)) keys.push(key);
  }
  return keys;
}

// ═══ IMMEDIATE PUSH — no debounce, fires right now ═══

export async function pushKeyNow(userId, key) {
  if (!supabase || !userId || !isSyncable(key)) return;

  let value;
  try {
    value = JSON.parse(localStorage.getItem(key));
  } catch {
    value = localStorage.getItem(key);
  }

  if (value === null || value === undefined) {
    await supabase.from('user_data').delete().eq('user_id', userId).eq('key', key);
  } else {
    const { error } = await supabase
      .from('user_data')
      .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
    if (error) throw error;
  }
}

// ═══ PULL — Supabase wins for all localStorage data ═══

export async function pullFromSupabase(userId) {
  if (!supabase || !userId) return { pulled: 0, remoteKeys: new Set() };

  const { data, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', userId);

  if (error) throw error;

  console.log(`[Sync] Pull: got ${(data || []).length} rows from Supabase`);

  let pulled = 0;
  const remoteKeys = new Set();

  for (const row of data || []) {
    if (isGuideKey(row.key)) continue;
    if (row.key === 'studyhub-guide-index') continue;
    if (SKIP_KEYS.includes(row.key)) continue;

    remoteKeys.add(row.key);

    const remoteValue = JSON.stringify(row.value);
    const localValue = localStorage.getItem(row.key);

    if (remoteValue !== localValue) {
      // Safety check: don't overwrite real local data with empty remote data.
      // This handles the case where empty defaults were previously pushed to Supabase.
      const remoteEmpty = remoteValue === '[]' || remoteValue === '{}' || remoteValue === '""' || remoteValue === 'null';
      const localHasData = localValue && localValue !== '[]' && localValue !== '{}' && localValue !== '""' && localValue !== 'null';

      if (remoteEmpty && localHasData) {
        console.log(`[Sync] Pull SKIPPING ${row.key}: remote is empty but local has data (fixing Supabase)`);
        // Push the real local data UP to fix Supabase
        let value;
        try { value = JSON.parse(localValue); } catch { value = localValue; }
        supabase.from('user_data')
          .upsert({ user_id: userId, key: row.key, value }, { onConflict: 'user_id,key' })
          .then(({ error }) => {
            if (error) console.error('[Sync] Fix push failed:', row.key, error);
            else console.log('[Sync] Fixed Supabase:', row.key);
          });
        continue;
      }

      const localPreview = localValue ? localValue.substring(0, 80) : '(empty)';
      const remotePreview = remoteValue.substring(0, 80);
      console.log(`[Sync] Pull overwriting ${row.key}:`);
      console.log(`  LOCAL:  ${localPreview}`);
      console.log(`  REMOTE: ${remotePreview}`);

      localStorage.setItem(row.key, remoteValue);
      markKeyAsReal(row.key);
      pulled++;
    }
  }

  console.log(`[Sync] Pull complete: ${pulled} keys updated`);
  return { pulled, remoteKeys };
}

// ═══ PUSH — only push keys that Supabase doesn't have yet ═══

export async function pushNewKeysToSupabase(userId, remoteKeys) {
  if (!supabase || !userId) return { pushed: 0 };

  const localKeys = getAllLocalKeys();
  // Only push keys that Supabase didn't return (new local-only data)
  const newKeys = localKeys.filter(k => !remoteKeys.has(k));

  if (newKeys.length === 0) return { pushed: 0 };

  const rows = newKeys.map(key => {
    let value;
    try { value = JSON.parse(localStorage.getItem(key)); }
    catch { value = localStorage.getItem(key); }
    return { user_id: userId, key, value };
  });

  const { error } = await supabase
    .from('user_data')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) throw error;
  return { pushed: newKeys.length };
}

// ═══ GUIDE SYNC — IndexedDB ↔ Supabase ═══

export async function pushGuideToSupabase(userId, guide) {
  if (!supabase || !userId || !guide?.courseId) return;
  unmarkGuideDeleted(guide.courseId);

  const key = `${GUIDE_KEY_PREFIX}${guide.courseId}`;
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, key, value: guide }, { onConflict: 'user_id,key' });

  if (error) throw error;
}

export async function deleteGuideFromSupabase(userId, courseId) {
  markGuideDeleted(courseId);
  if (!supabase || !userId || !courseId) return;

  const key = `${GUIDE_KEY_PREFIX}${courseId}`;
  await supabase.from('user_data').delete().eq('user_id', userId).eq('key', key);
}

export async function syncGuides(userId) {
  if (!supabase || !userId) return;

  const { data: remoteRows, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', userId)
    .like('key', `${GUIDE_KEY_PREFIX}%`);

  if (error) throw error;

  const deletedIds = getDeletedGuideIds();
  const remoteCourseIds = new Set();
  let changed = false;

  // Process remote guides
  for (const row of remoteRows || []) {
    const guide = row.value;
    if (!guide?.courseId) continue;

    if (deletedIds.has(guide.courseId)) {
      // Deleted locally — remove from Supabase
      await supabase.from('user_data').delete().eq('user_id', userId).eq('key', row.key);
      continue;
    }

    remoteCourseIds.add(guide.courseId);

    // Always write remote guide to IndexedDB (Supabase wins)
    await putGuide(guide);
    changed = true;
  }

  // Push local-only guides to Supabase
  const localGuides = await getAllGuides();
  const pushRows = [];

  for (const guide of localGuides) {
    if (!guide.courseId) continue;
    if (deletedIds.has(guide.courseId)) continue;
    if (!remoteCourseIds.has(guide.courseId)) {
      pushRows.push({ user_id: userId, key: `${GUIDE_KEY_PREFIX}${guide.courseId}`, value: guide });
    }
  }

  if (pushRows.length > 0) {
    const { error: pushErr } = await supabase
      .from('user_data')
      .upsert(pushRows, { onConflict: 'user_id,key' });
    if (pushErr) throw pushErr;
    changed = true;
  }

  // Rebuild guide index from IndexedDB (single source of truth for index)
  const allGuides = await getAllGuides();
  // Clear and rebuild
  const currentIndex = readGuideIndex();
  for (const id of Object.keys(currentIndex)) {
    if (deletedIds.has(id)) removeFromGuideIndex(id);
  }
  for (const guide of allGuides) {
    if (guide?.courseId && !deletedIds.has(guide.courseId)) {
      updateGuideIndex(guide);
    }
  }

  if (changed) {
    window.dispatchEvent(new Event('studyhub-guides-updated'));
  }
}

// ═══ FULL SYNC — the main entry point ═══

export async function fullSync(userId) {
  if (!supabase || !userId) return { pulled: 0 };

  // Flush any pending offline writes before pulling
  await flushBeforePull(userId);

  // Now pull — Supabase has our latest, so overwriting local is safe
  const { pulled, remoteKeys } = await pullFromSupabase(userId);

  // Push any keys that still only exist locally (new keys from this device)
  const { pushed } = await pushNewKeysToSupabase(userId, remoteKeys);

  // Sync guides
  await syncGuides(userId);

  return { pulled, pushed };
}

// Flush pending writes before pulling — these are writes that were
// in-flight when the page unloaded, saved to the pending queue
async function flushBeforePull(userId) {
  if (!supabase || !userId) return;

  try {
    const { flushPendingWrites } = await import('../hooks/useLocalStorage.js');
    await flushPendingWrites();
    console.log('[Sync] Pending writes flushed before pull');
  } catch (e) {
    console.error('[Sync] Flush pending failed:', e);
  }
}

// ═══ FORCE SYNC — nuclear reset, clear all local, re-pull everything ═══

export async function forceSync(userId) {
  if (!supabase || !userId) throw new Error('Not signed in');

  // Clear all studyhub localStorage keys (except theme)
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('studyhub-') && key !== 'studyhub-theme' && key !== 'studyhub-custom-theme') {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  // Clear IndexedDB guides
  try {
    const guides = await getAllGuides();
    for (const guide of guides) {
      if (guide.courseId) await deleteGuide(guide.courseId);
    }
  } catch (e) {
    console.error('[ForceSync] IndexedDB clear error:', e);
  }

  // Pull fresh from Supabase
  await fullSync(userId);

  return { cleared: keysToRemove.length };
}
