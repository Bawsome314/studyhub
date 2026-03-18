/**
 * IndexedDB utility module for storing large study guide JSON files.
 *
 * Uses a single database 'studyhub-db' with an object store 'study-guides'
 * keyed by courseId. All operations are async and handle errors gracefully.
 */

const DB_NAME = 'studyhub-db';
const DB_VERSION = 1;
const STORE_NAME = 'study-guides';

/** @type {IDBDatabase | null} */
let cachedDB = null;

/**
 * Opens (or creates/upgrades) the IndexedDB database.
 * Uses a module-level cached reference so the database is only opened once.
 * @returns {Promise<IDBDatabase>} The database instance.
 */
export async function openDB() {
  if (cachedDB) {
    return cachedDB;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'courseId' });
      }
    };

    request.onsuccess = (event) => {
      cachedDB = event.target.result;

      // Clear the cached reference if the database is unexpectedly closed
      cachedDB.onclose = () => {
        cachedDB = null;
      };

      resolve(cachedDB);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Reads a single study guide from IndexedDB by courseId.
 * @param {string} courseId - The course identifier.
 * @returns {Promise<object | null>} The guide object, or null if not found or on error.
 */
export async function getGuide(courseId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(courseId);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[IndexedDB] getGuide failed:', err);
    return null;
  }
}

/**
 * Writes a study guide object into IndexedDB.
 * The guide must have a `courseId` property.
 * @param {object} guide - The study guide object to store.
 * @returns {Promise<void>}
 */
export async function putGuide(guide) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(guide);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[IndexedDB] putGuide failed:', err);
  }
}

/**
 * Removes a study guide by courseId.
 * @param {string} courseId - The course identifier.
 * @returns {Promise<void>}
 */
export async function deleteGuide(courseId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(courseId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[IndexedDB] deleteGuide failed:', err);
  }
}

/**
 * Returns an array of all stored study guide objects.
 * @returns {Promise<object[]>} All guides, or an empty array on error.
 */
export async function getAllGuides() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[IndexedDB] getAllGuides failed:', err);
    return [];
  }
}

/**
 * Returns lightweight metadata for all stored guides without the full
 * question and card data.
 * @returns {Promise<Array<{courseId: string, courseCode: string, courseName: string, unitCount: number, cardCount: number, tools: string[]}>>}
 */
export async function getGuideMetadata() {
  try {
    const guides = await getAllGuides();

    return guides.map((guide) => {
      const units = guide.units ?? [];
      const cardCount = units.reduce(
        (sum, unit) => sum + (unit.cards?.length ?? 0),
        0
      );

      // Determine which study tools have content
      const tools = [];
      const hasCards = cardCount > 0;
      const hasQuestions = units.some(
        (unit) => (unit.questions?.length ?? 0) > 0
      );

      if (hasCards) tools.push('flashcards', 'rapidfire');
      if (hasQuestions) tools.push('quiz', 'mock-exam');
      if (hasCards) tools.push('match');

      return {
        courseId: guide.courseId,
        courseCode: guide.courseCode ?? '',
        courseName: guide.courseName ?? '',
        unitCount: units.length,
        cardCount,
        tools,
      };
    });
  } catch (err) {
    console.error('[IndexedDB] getGuideMetadata failed:', err);
    return [];
  }
}

/**
 * Removes any guides from IndexedDB that are not in the guide index.
 * Cleans up orphaned data from failed deletions or interrupted syncs.
 * @returns {Promise<number>} Number of orphaned guides removed.
 */
export async function cleanOrphanedGuides() {
  try {
    const indexRaw = localStorage.getItem('studyhub-guide-index');
    const index = indexRaw ? JSON.parse(indexRaw) : {};
    const validIds = new Set(Object.keys(index));

    const allGuides = await getAllGuides();
    let removed = 0;

    for (const guide of allGuides) {
      if (guide.courseId && !validIds.has(guide.courseId)) {
        await deleteGuide(guide.courseId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[IndexedDB] Cleaned up ${removed} orphaned guide(s)`);
    }
    return removed;
  } catch (err) {
    console.error('[IndexedDB] cleanOrphanedGuides failed:', err);
    return 0;
  }
}

/**
 * Returns an estimate of IndexedDB storage usage in bytes using the
 * Storage API. Returns null if the API is unavailable.
 * @returns {Promise<{usage: number, quota: number} | null>}
 */
export async function getStorageEstimate() {
  try {
    if (navigator?.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    }
    return null;
  } catch (err) {
    console.error('[IndexedDB] getStorageEstimate failed:', err);
    return null;
  }
}
