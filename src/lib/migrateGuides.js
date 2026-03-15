import { putGuide } from './indexedDB';

/**
 * One-time migration: moves study guides from localStorage to IndexedDB.
 * Creates a lightweight guide index in localStorage for synchronous metadata access.
 * Removes the old `studyhub-study-guides` key after successful migration.
 */
export async function migrateGuidesToIndexedDB() {
  try {
    const raw = localStorage.getItem('studyhub-study-guides');
    if (!raw) return; // Nothing to migrate

    const guides = JSON.parse(raw);
    const entries = Object.values(guides);
    if (entries.length === 0) {
      localStorage.removeItem('studyhub-study-guides');
      return;
    }

    // Read existing index (in case a partial migration happened before)
    const existingIndex = JSON.parse(localStorage.getItem('studyhub-guide-index') || '{}');

    // Write each guide to IndexedDB and build index
    for (const guide of entries) {
      if (!guide.courseId) continue;
      await putGuide(guide);

      const units = guide.units || [];
      const totalCards = units.reduce((sum, u) => sum + (u.cards?.length || 0), 0);

      // Determine which study tools have content
      const tools = [];
      const hasCards = totalCards > 0;
      const hasQuestions = units.some(u => (u.questions?.length || 0) > 0) ||
        units.some(u => (u.cards || []).some(c => c.question));
      if (hasCards) tools.push('flashcards', 'rapidfire');
      if (hasQuestions || (guide.mockPool?.length > 0) || (guide.extraQuestions?.length > 0)) tools.push('quiz', 'mock-exam');
      if (hasCards) tools.push('match');

      existingIndex[guide.courseId] = {
        courseCode: guide.courseCode || '',
        courseName: guide.courseName || '',
        totalCards,
        unitCount: units.length,
        tools,
        toolbarTools: Array.isArray(guide.tools) ? guide.tools : [],
      };
    }

    localStorage.setItem('studyhub-guide-index', JSON.stringify(existingIndex));

    // Remove old key after successful migration
    localStorage.removeItem('studyhub-study-guides');

    console.log(`[Migration] Migrated ${entries.length} study guide(s) to IndexedDB`);
  } catch (err) {
    console.error('[Migration] Failed to migrate study guides:', err);
  }
}
