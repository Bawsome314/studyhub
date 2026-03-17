/**
 * Helpers for managing the lightweight guide index in localStorage.
 * The index stores just metadata (no cards/questions) for synchronous access.
 * Shape: { [courseId]: { courseCode, courseName, totalCards, unitCount, tools } }
 */

const INDEX_KEY = 'studyhub-guide-index';

export function readGuideIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeGuideIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  // Dispatch event so sync layer and useLocalStorage hooks notice the change
  window.dispatchEvent(new CustomEvent('studyhub-storage-write', { detail: { key: INDEX_KEY } }));
}

/**
 * Add or update a guide entry in the index from a full guide object.
 */
export function updateGuideIndex(guide) {
  if (!guide?.courseId) return;

  const index = readGuideIndex();
  const units = guide.units || [];
  const totalCards = units.reduce((sum, u) => sum + (u.cards?.length || 0), 0);

  const tools = [];
  const hasCards = totalCards > 0;
  const hasQuestions = units.some(u => (u.questions?.length || 0) > 0) ||
    units.some(u => (u.cards || []).some(c => c.question));
  if (hasCards) tools.push('flashcards', 'rapidfire');
  if (hasQuestions || (guide.mockPool?.length > 0) || (guide.extraQuestions?.length > 0)) tools.push('quiz', 'mock-exam');
  if (hasCards) tools.push('match');

  const allCards = units.flatMap(u => u.cards || []);
  const highPriority = allCards.filter(c => c.priority === 'high').length;
  const hasTermId = (guide.termIdPool?.length || 0) > 0;

  index[guide.courseId] = {
    courseCode: guide.courseCode || '',
    courseName: guide.courseName || '',
    totalCards,
    highPriorityCount: highPriority,
    hasTermId,
    unitCount: units.length,
    tools,
    toolbarTools: Array.isArray(guide.tools) ? guide.tools : [],
  };

  writeGuideIndex(index);
}

/**
 * Remove a guide entry from the index.
 */
export function removeFromGuideIndex(courseId) {
  const index = readGuideIndex();
  delete index[courseId];
  writeGuideIndex(index);
}
