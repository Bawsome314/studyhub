import { supabase } from './supabase';
import { putGuide, getGuide, getAllGuides } from './indexedDB';
import { updateGuideIndex } from './guideIndex';

// Keys that should sync to Supabase (everything except device-local/internal keys)
const SYNC_PREFIX = 'studyhub-';
const SKIP_KEYS = [
  'studyhub-theme',
  'studyhub-custom-theme',
  'studyhub-sync-timestamps',
  'studyhub-deleted-guides',
  'studyhub-last-session',
  'studyhub-guide-index',  // rebuilt locally from IndexedDB by syncGuides
];
const GUIDE_KEY_PREFIX = 'studyhub-guide-data:';
const DELETED_GUIDES_KEY = 'studyhub-deleted-guides';

// Track deleted guide IDs so sync doesn't resurrect them
function getDeletedGuideIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_GUIDES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markGuideDeleted(courseId) {
  const deleted = getDeletedGuideIds();
  deleted.add(courseId);
  localStorage.setItem(DELETED_GUIDES_KEY, JSON.stringify([...deleted]));
}

function unmarkGuideDeleted(courseId) {
  const deleted = getDeletedGuideIds();
  deleted.delete(courseId);
  localStorage.setItem(DELETED_GUIDES_KEY, JSON.stringify([...deleted]));
}

function isGuideKey(key) {
  return key.startsWith(GUIDE_KEY_PREFIX);
}

function isSyncable(key) {
  return key.startsWith(SYNC_PREFIX) && !SKIP_KEYS.includes(key);
}

// Get all studyhub keys from localStorage (excludes guide data which is in IndexedDB)
function getAllLocalKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isSyncable(key)) keys.push(key);
  }
  return keys;
}

// Pull all data from Supabase for this user
export async function pullFromSupabase(userId) {
  if (!supabase || !userId) return { pulled: 0 };

  const { data, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', userId);

  if (error) throw error;

  let pulled = 0;
  for (const row of data || []) {
    // Guide data is handled exclusively by syncGuides() — skip here to avoid
    // double-processing and timestamp conflicts
    if (isGuideKey(row.key)) continue;

    // Skip the guide index too — syncGuides rebuilds it from actual guide data
    if (row.key === 'studyhub-guide-index') continue;

    const localTimestamp = getLocalTimestamp(row.key);
    const remoteTimestamp = new Date(row.updated_at).getTime();

    // Remote wins if newer, or if no local data exists
    if (!localTimestamp || remoteTimestamp > localTimestamp) {
      localStorage.setItem(row.key, JSON.stringify(row.value));
      setLocalTimestamp(row.key, remoteTimestamp);
      pulled++;
    }
  }

  return { pulled };
}

// Push all local data to Supabase
export async function pushToSupabase(userId) {
  if (!supabase || !userId) return { pushed: 0 };

  const keys = getAllLocalKeys();
  if (keys.length === 0) return { pushed: 0 };

  const rows = keys.map(key => {
    let value;
    try {
      value = JSON.parse(localStorage.getItem(key));
    } catch {
      value = localStorage.getItem(key);
    }
    return { user_id: userId, key, value };
  });

  const { error } = await supabase
    .from('user_data')
    .upsert(rows, { onConflict: 'user_id,key' });

  if (error) throw error;

  // Update local timestamps
  const now = Date.now();
  for (const key of keys) {
    setLocalTimestamp(key, now);
  }

  return { pushed: keys.length };
}

// Push a single key to Supabase
export async function pushKeyToSupabase(userId, key) {
  if (!supabase || !userId || !isSyncable(key)) return;

  // Skip guide-related keys that are now in IndexedDB
  if (isGuideKey(key)) return;

  let value;
  try {
    value = JSON.parse(localStorage.getItem(key));
  } catch {
    value = localStorage.getItem(key);
  }

  if (value === null || value === undefined) {
    // Key was removed locally - delete from remote
    await supabase
      .from('user_data')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);
  } else {
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { user_id: userId, key, value },
        { onConflict: 'user_id,key' }
      );
    if (error) throw error;
  }

  setLocalTimestamp(key, Date.now());
}

// Push a single guide to Supabase immediately (call after import)
export async function pushGuideToSupabase(userId, guide) {
  if (!supabase || !userId || !guide?.courseId) return;

  // Clear any deletion tombstone — this guide is being (re)imported
  unmarkGuideDeleted(guide.courseId);

  const key = `${GUIDE_KEY_PREFIX}${guide.courseId}`;
  const { error } = await supabase
    .from('user_data')
    .upsert(
      { user_id: userId, key, value: guide },
      { onConflict: 'user_id,key' }
    );

  if (error) throw error;
  setLocalTimestamp(key, Date.now());
}

// Delete a guide from Supabase (call after local deletion)
export async function deleteGuideFromSupabase(userId, courseId) {
  // Mark as deleted FIRST so sync can never resurrect it
  markGuideDeleted(courseId);

  if (!supabase || !userId || !courseId) return;

  const key = `${GUIDE_KEY_PREFIX}${courseId}`;
  await supabase
    .from('user_data')
    .delete()
    .eq('user_id', userId)
    .eq('key', key);

  // Clean up local timestamp
  try {
    const timestamps = JSON.parse(localStorage.getItem('studyhub-sync-timestamps') || '{}');
    delete timestamps[key];
    localStorage.setItem('studyhub-sync-timestamps', JSON.stringify(timestamps));
  } catch {}
}

// Sync all study guides between IndexedDB and Supabase
export async function syncGuides(userId) {
  if (!supabase || !userId) return;

  // 1. Pull guide keys from Supabase
  const { data: remoteRows, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', userId)
    .like('key', `${GUIDE_KEY_PREFIX}%`);

  if (error) throw error;

  const remoteCourseIds = new Set();
  const deletedIds = getDeletedGuideIds();
  let guidesChanged = false;

  // Delete remotely any guides that were deleted locally
  for (const row of remoteRows || []) {
    const guide = row.value;
    if (!guide?.courseId) continue;
    if (deletedIds.has(guide.courseId)) {
      // This guide was deleted locally — remove from Supabase too
      await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId)
        .eq('key', row.key);
      continue;
    }
    remoteCourseIds.add(guide.courseId);
  }

  // Write remote guides to IndexedDB if newer (skip deleted)
  for (const row of remoteRows || []) {
    const guide = row.value;
    if (!guide?.courseId) continue;
    if (deletedIds.has(guide.courseId)) continue;

    const localTimestamp = getLocalTimestamp(row.key);
    const remoteTimestamp = new Date(row.updated_at).getTime();

    if (!localTimestamp || remoteTimestamp > localTimestamp) {
      await putGuide(guide);
      updateGuideIndex(guide);
      setLocalTimestamp(row.key, remoteTimestamp);
      guidesChanged = true;
    }
  }

  // 2. Push local-only guides (in IndexedDB but not in Supabase)
  const localGuides = await getAllGuides();
  const pushRows = [];

  for (const guide of localGuides) {
    if (!guide.courseId) continue;
    if (deletedIds.has(guide.courseId)) continue; // Don't push deleted guides
    if (!remoteCourseIds.has(guide.courseId)) {
      const key = `${GUIDE_KEY_PREFIX}${guide.courseId}`;
      pushRows.push({ user_id: userId, key, value: guide });
    }
  }

  if (pushRows.length > 0) {
    const { error: pushErr } = await supabase
      .from('user_data')
      .upsert(pushRows, { onConflict: 'user_id,key' });

    if (pushErr) throw pushErr;

    const now = Date.now();
    for (const row of pushRows) {
      setLocalTimestamp(row.key, now);
    }
    guidesChanged = true;
  }

  // Always rebuild guide index from IndexedDB to ensure consistency
  if (guidesChanged) {
    const allLocal = await getAllGuides();
    for (const guide of allLocal) {
      if (guide?.courseId && !deletedIds.has(guide.courseId)) {
        updateGuideIndex(guide);
      }
    }
    window.dispatchEvent(new Event('studyhub-guides-updated'));
  }
}

// Full bidirectional sync: pull remote, then push local, then sync guides
export async function fullSync(userId) {
  if (!supabase || !userId) return { pulled: 0, pushed: 0 };

  // Pull first (remote updates win for conflicts)
  const { pulled } = await pullFromSupabase(userId);

  // Then push local data (new local keys get sent up)
  const { pushed } = await pushToSupabase(userId);

  // Sync guides via IndexedDB
  await syncGuides(userId);

  return { pulled, pushed };
}

// Timestamp tracking for conflict resolution
function getLocalTimestamp(key) {
  try {
    const timestamps = JSON.parse(localStorage.getItem('studyhub-sync-timestamps') || '{}');
    return timestamps[key] || 0;
  } catch {
    return 0;
  }
}

function setLocalTimestamp(key, timestamp) {
  try {
    const timestamps = JSON.parse(localStorage.getItem('studyhub-sync-timestamps') || '{}');
    timestamps[key] = timestamp;
    localStorage.setItem('studyhub-sync-timestamps', JSON.stringify(timestamps));
  } catch {
    // ignore
  }
}
