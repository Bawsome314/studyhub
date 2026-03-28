import { supabase } from './supabase';
import { putGuide, getGuide, getAllGuides, deleteGuide } from './indexedDB';
import { updateGuideIndex, readGuideIndex, removeFromGuideIndex } from './guideIndex';

const SYNC_PREFIX = 'studyhub-';
// Keys that are device-local only — never push/pull these
const SKIP_KEYS = [
  'studyhub-theme',
  'studyhub-custom-theme',
  'studyhub-sync-timestamps',
  'studyhub-deleted-guides',
  'studyhub-last-session',
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
      // Log what's being overwritten
      const localPreview = localValue ? localValue.substring(0, 80) : '(empty)';
      const remotePreview = remoteValue.substring(0, 80);
      console.log(`[Sync] Pull overwriting ${row.key}:`);
      console.log(`  LOCAL:  ${localPreview}`);
      console.log(`  REMOTE: ${remotePreview}`);

      localStorage.setItem(row.key, remoteValue);
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

  // CRITICAL: Push local changes to Supabase BEFORE pulling.
  // This prevents the pull from overwriting changes that haven't been uploaded yet.
  // Only pushes non-empty values to avoid wiping Supabase with defaults.
  await pushLocalChangesToSupabase(userId);

  // Now pull — Supabase has our latest, so overwriting local is safe
  const { pulled, remoteKeys } = await pullFromSupabase(userId);

  // Push any keys that still only exist locally (new keys from this device)
  const { pushed } = await pushNewKeysToSupabase(userId, remoteKeys);

  // Sync guides
  await syncGuides(userId);

  return { pulled, pushed };
}

// Push local data to Supabase before pulling.
// Only pushes keys that have REAL data (not empty defaults).
async function pushLocalChangesToSupabase(userId) {
  if (!supabase || !userId) return;

  // Flush any pending writes from the offline queue first
  const { flushPendingWrites } = await import('../hooks/useLocalStorage.js');
  await flushPendingWrites();

  const keys = getAllLocalKeys();
  if (keys.length === 0) return;

  // Filter out empty/default values that would wipe real Supabase data
  const rows = [];
  for (const key of keys) {
    let value;
    try { value = JSON.parse(localStorage.getItem(key)); }
    catch { value = localStorage.getItem(key); }

    // Skip empty arrays, empty objects, empty strings, null
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    if (value === '') continue;

    rows.push({ user_id: userId, key, value });
  }

  if (rows.length === 0) {
    console.log('[Sync] Pre-pull push: nothing to push (all empty defaults)');
    return;
  }

  console.log(`[Sync] Pre-pull push: uploading ${rows.length} keys:`, rows.map(r => r.key));

  const { error } = await supabase
    .from('user_data')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) console.error('[Sync] Pre-pull push FAILED:', error);
  else console.log(`[Sync] Pre-pull push: SUCCESS (${rows.length} keys)`);
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
