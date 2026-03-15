export function timeAgo(timestamp) {
  if (!timestamp) return null;
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function getBestPracticeOa(courseId) {
  try {
    const raw = localStorage.getItem(`studyhub-quiz-history-${courseId}`);
    if (!raw) return null;
    const history = JSON.parse(raw);
    const oaResults = history.filter(h => h.type === 'Practice OA' && h.total > 0);
    if (oaResults.length === 0) return null;
    const best = oaResults.reduce((b, r) => {
      const pct = (r.score / r.total) * 100;
      const bPct = (b.score / b.total) * 100;
      return pct > bPct ? r : b;
    });
    return {
      pct: Math.round((best.score / best.total) * 100),
      date: best.timestamp,
    };
  } catch {
    return null;
  }
}

export function formatShortDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

export function getBestPreTest(courseId) {
  try {
    const raw = localStorage.getItem(`studyhub-quiz-history-${courseId}`);
    if (!raw) return null;
    const history = JSON.parse(raw);
    const results = history.filter(h => h.type === 'Pre-Test' && h.total > 0);
    if (results.length === 0) return null;
    const best = results.reduce((b, r) => {
      const pct = (r.score / r.total) * 100;
      const bPct = (b.score / b.total) * 100;
      return pct > bPct ? r : b;
    });
    return { pct: Math.round((best.score / best.total) * 100), date: best.timestamp };
  } catch {
    return null;
  }
}

export function getCourseReadiness(courseId) {
  try {
    // 1. Flashcard confidence (40%): % of cards rated "got-it"
    const indexRaw = localStorage.getItem('studyhub-guide-index');
    const index = indexRaw ? JSON.parse(indexRaw) : {};
    const meta = index[courseId];
    if (!meta) return 0;

    const totalCards = meta.totalCards || 0;
    if (totalCards === 0) return 0;

    const progressRaw = localStorage.getItem(`studyhub-cards-${courseId}`);
    const cardProgress = progressRaw ? JSON.parse(progressRaw) : {};
    const gotItCount = Object.values(cardProgress).filter(p => p.rating === 'got-it').length;
    const flashcardContribution = (gotItCount / totalCards) * 100 * 0.4;

    // 2. Practice OA best score (50%)
    const bestOa = getBestPracticeOa(courseId);
    const oaContribution = bestOa ? bestOa.pct * 0.5 : 0;

    // 3. Pre-test score (10%, conditional: only if >= 70%)
    const bestPre = getBestPreTest(courseId);
    const preTestContribution = bestPre && bestPre.pct >= 70 ? bestPre.pct * 0.1 : 0;

    return Math.round(flashcardContribution + oaContribution + preTestContribution);
  } catch {
    return 0;
  }
}

export function readinessColor(pct) {
  if (pct >= 70) return 'bg-success';
  if (pct >= 30) return 'bg-warning';
  return 'bg-danger';
}

export function readinessTextColor(pct) {
  if (pct >= 70) return 'text-success';
  if (pct >= 30) return 'text-warning';
  return 'text-danger';
}
