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
  if (!supabase || !userId) return { pulled: 0 };

  const { data, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', userId);

  if (error) throw error;

  let pulled = 0;
  const remoteKeys = new Set();

  for (const row of data || []) {
    if (isGuideKey(row.key)) continue; // handled by syncGuides
    if (row.key === 'studyhub-guide-index') continue; // rebuilt locally
    if (SKIP_KEYS.includes(row.key)) continue;

    remoteKeys.add(row.key);

    // ALWAYS write remote data — Supabase is source of truth
    const remoteValue = JSON.stringify(row.value);
    const localValue = localStorage.getItem(row.key);

    if (remoteValue !== localValue) {
      localStorage.setItem(row.key, remoteValue);
      pulled++;
    }
  }

  return { pulled, remoteKeys };
}

// ═══ PUSH — push all local keys to Supabase ═══

export async function pushToSupabase(userId) {
  if (!supabase || !userId) return { pushed: 0 };

  const keys = getAllLocalKeys();
  if (keys.length === 0) return { pushed: 0 };

  const rows = keys.map(key => {
    let value;
    try { value = JSON.parse(localStorage.getItem(key)); }
    catch { value = localStorage.getItem(key); }
    return { user_id: userId, key, value };
  });

  const { error } = await supabase
    .from('user_data')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) throw error;
  return { pushed: keys.length };
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
  if (!supabase || !userId) return { pulled: 0, pushed: 0 };

  // 1. Pull everything from Supabase (remote wins)
  const { pulled } = await pullFromSupabase(userId);

  // 2. Push local data to Supabase (new local keys get uploaded)
  const { pushed } = await pushToSupabase(userId);

  // 3. Sync guides (IndexedDB ↔ Supabase)
  await syncGuides(userId);

  return { pulled, pushed };
}
