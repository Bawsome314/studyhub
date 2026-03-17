import { useState, useEffect, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getGuide } from '../lib/indexedDB';

export function useStudyGuide(courseId) {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGuide(null);

    if (!courseId) {
      setLoading(false);
      return;
    }

    getGuide(courseId).then(result => {
      if (!cancelled) {
        setGuide(result || null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setGuide(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [courseId]);

  // Derived data - memoized so it only recomputes when guide changes
  const derived = useMemo(() => {
    const allCards = guide
      ? guide.units.flatMap(u => u.cards.map(c => ({ ...c, unitId: u.id, unitName: u.name })))
      : [];

    const allQuestions = guide
      ? guide.units.flatMap(u => [
          ...(u.cards || []).filter(c => c.question).map(c => ({ ...c, unitId: u.id, unitName: u.name })),
          ...(u.questions || []).map(q => ({ ...q, unitId: u.id, unitName: u.name })),
        ])
      : [];

    const allMatchPairs = guide
      ? guide.units.flatMap(u => (u.matchPairs || []).map(p => ({ ...p, unitId: u.id, unitName: u.name })))
      : [];

    const extraQuestions = guide?.extraQuestions || [];
    const mockPool = guide?.mockPool || [];
    const termIdPool = guide?.termIdPool || [];
    const trueFalsePool = guide?.trueFalsePool || [];
    const fillInBlankPool = guide?.fillInBlankPool || [];

    return { allCards, allQuestions, allMatchPairs, extraQuestions, mockPool, termIdPool, trueFalsePool, fillInBlankPool };
  }, [guide]);

  return {
    guide, loading,
    ...derived,
  };
}

export function useCardProgress(courseId) {
  const [progress, setProgress] = useLocalStorage(`studyhub-cards-${courseId}`, {});

  function rateCard(cardId, rating) {
    setProgress(prev => ({
      ...prev,
      [cardId]: {
        rating, // 'dont-know' | 'shaky' | 'got-it'
        lastSeen: Date.now(),
        timesReviewed: (prev[cardId]?.timesReviewed || 0) + 1,
      },
    }));
  }

  function getWeightedCards(cards) {
    // Weight: dont-know=5, shaky=3, got-it=1, unseen=4
    // Priority multiplier: high=1.5, normal=1, low=0.6
    const weights = { 'dont-know': 5, shaky: 3, 'got-it': 1 };
    const priorityMult = { high: 1.5, normal: 1, low: 0.6 };
    const weighted = [];
    for (const card of cards) {
      const p = progress[card.id];
      const baseWeight = p ? weights[p.rating] || 4 : 4;
      const mult = priorityMult[card.priority] || 1;
      const weight = Math.max(1, Math.round(baseWeight * mult));
      for (let i = 0; i < weight; i++) weighted.push(card);
    }
    return shuffle(weighted);
  }

  return { progress, rateCard, getWeightedCards, getDueCards: (cards) => getDueCards(cards, progress) };
}

const HOUR = 3600000;
const DAY = 24 * HOUR;

export function getDueCards(cards, progress) {
  const now = Date.now();

  function isDue(card) {
    const p = progress[card.id];
    if (!p) return true; // never seen
    if (p.rating === 'dont-know') return true; // immediately
    if (p.rating === 'shaky') return now - p.lastSeen >= 1 * DAY;
    if (p.rating === 'got-it') {
      const interval = (p.timesReviewed || 0) >= 3 ? 7 * DAY : 3 * DAY;
      return now - p.lastSeen >= interval;
    }
    return true;
  }

  const due = cards.filter(isDue);

  // Sort: unseen first, then dont-know, then shaky, then got-it
  const priority = { undefined: 0, 'dont-know': 1, shaky: 2, 'got-it': 3 };
  due.sort((a, b) => {
    const ra = progress[a.id]?.rating;
    const rb = progress[b.id]?.rating;
    return (priority[ra] ?? 0) - (priority[rb] ?? 0);
  });

  return due;
}

export function useQuizHistory(courseId) {
  const [history, setHistory] = useLocalStorage(`studyhub-quiz-history-${courseId}`, []);

  function saveResult(result) {
    setHistory(prev => [...prev, { ...result, timestamp: Date.now() }]);
  }

  return { history, saveResult };
}

export function useMissedQuestions(courseId) {
  const [data, setData] = useLocalStorage(`studyhub-missed-${courseId}`, {});

  function recordMiss(id, text, unitName) {
    if (!id) return;
    setData(prev => ({
      ...prev,
      [id]: {
        text: text || prev[id]?.text || '',
        unitName: unitName || prev[id]?.unitName || '',
        missCount: (prev[id]?.missCount || 0) + 1,
        correctStreak: 0,
      },
    }));
  }

  function recordCorrect(id) {
    if (!id) return;
    setData(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          correctStreak: (prev[id].correctStreak || 0) + 1,
        },
      };
    });
  }

  // Weak spots: missed 2+ times and not consistently correct since
  const weakSpots = Object.entries(data)
    .filter(([, v]) => v.missCount >= 2 && (v.correctStreak || 0) < 3)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.missCount - a.missCount);

  return { missedData: data, recordMiss, recordCorrect, weakSpots };
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandom(array, count) {
  return shuffle(array).slice(0, count);
}

// Shuffle answer choices within each question so correct answer position is randomized
export function shuffleChoices(questions) {
  return questions.map(q => {
    const indices = q.choices.map((_, i) => i);
    const shuffled = shuffle(indices);
    return {
      ...q,
      choices: shuffled.map(i => q.choices[i]),
      correctIndex: shuffled.indexOf(q.correctIndex),
    };
  });
}
