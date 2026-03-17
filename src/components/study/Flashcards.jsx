import { useState, useMemo } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight, XCircle, HelpCircle, CheckCircle2, ArrowLeft, SlidersHorizontal, Clock, Flame } from 'lucide-react';
import { useCardProgress, shuffle, getDueCards } from '../../hooks/useStudyGuide';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

const RATINGS = [
  { id: 'dont-know', label: "Don't Know", icon: XCircle, color: 'bg-danger hover:bg-danger/80', textColor: 'text-white' },
  { id: 'shaky', label: 'Shaky', icon: HelpCircle, color: 'bg-warning hover:bg-warning/80', textColor: 'text-white' },
  { id: 'got-it', label: 'Got It', icon: CheckCircle2, color: 'bg-success hover:bg-success/80', textColor: 'text-white' },
];

const SORT_OPTIONS = [
  { id: 'unit', label: 'By Unit' },
  { id: 'shuffle', label: 'Shuffle' },
  { id: 'weakest', label: 'Weakest First' },
  { id: 'unrated', label: 'Unrated First' },
  { id: 'priority', label: 'High Priority' },
];

export default function Flashcards({ courseId, cards, onExit }) {
  const { progress, rateCard } = useCardProgress(courseId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filterUnit, setFilterUnit] = useState('all');
  const [sortMode, setSortMode] = useState('unit');
  const [shuffleKey, setShuffleKey] = useState(0); // force reshuffle
  const [reviewDue, setReviewDue] = useState(false);

  const units = [...new Set(cards.map(c => c.unitName))];
  const dueCards = useMemo(() => getDueCards(cards, progress), [cards, progress]);
  const dueCount = dueCards.length;
  const unitFiltered = filterUnit === 'all' ? cards : cards.filter(c => c.unitName === filterUnit);
  const baseFiltered = reviewDue ? unitFiltered.filter(c => dueCards.some(d => d.id === c.id)) : unitFiltered;

  const filtered = useMemo(() => {
    let sorted = [...baseFiltered];
    if (sortMode === 'shuffle') {
      sorted = shuffle(sorted);
    } else if (sortMode === 'weakest') {
      const order = { 'dont-know': 0, undefined: 1, 'shaky': 2, 'got-it': 3 };
      sorted.sort((a, b) => {
        const ra = progress[a.id]?.rating;
        const rb = progress[b.id]?.rating;
        return (order[ra] ?? 1) - (order[rb] ?? 1);
      });
    } else if (sortMode === 'unrated') {
      sorted.sort((a, b) => {
        const aRated = progress[a.id] ? 1 : 0;
        const bRated = progress[b.id] ? 1 : 0;
        return aRated - bRated;
      });
    } else if (sortMode === 'priority') {
      const order = { high: 0, normal: 1, low: 2 };
      sorted.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
    }
    // 'unit' = default order (as-is from data)
    return sorted;
  }, [baseFiltered, sortMode, progress, shuffleKey]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted text-sm">No cards in this unit.</p>
        <button onClick={onExit} className="mt-4 text-accent text-sm hover:underline">Back to Menu</button>
      </div>
    );
  }

  const card = filtered[currentIndex % filtered.length];
  const cardProgress = progress[card.id];

  const stats = {
    total: filtered.length,
    'got-it': filtered.filter(c => progress[c.id]?.rating === 'got-it').length,
    shaky: filtered.filter(c => progress[c.id]?.rating === 'shaky').length,
    'dont-know': filtered.filter(c => progress[c.id]?.rating === 'dont-know').length,
  };
  stats.unseen = stats.total - stats['got-it'] - stats.shaky - stats['dont-know'];

  function handleRate(rating) {
    rateCard(card.id, rating);
    setFlipped(false);
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  }

  function prev() {
    setFlipped(false);
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : filtered.length - 1);
  }

  function next() {
    setFlipped(false);
    setCurrentIndex(currentIndex < filtered.length - 1 ? currentIndex + 1 : 0);
  }

  useKeyboardShortcuts({
    'Space': () => setFlipped(f => !f),
    'ArrowLeft': () => prev(),
    'ArrowRight': () => next(),
    '1': () => { if (flipped) handleRate('dont-know'); },
    '2': () => { if (flipped) handleRate('shaky'); },
    '3': () => { if (flipped) handleRate('got-it'); },
  });

  function handleSort(mode) {
    setSortMode(mode);
    setCurrentIndex(0);
    setFlipped(false);
    if (mode === 'shuffle') setShuffleKey(k => k + 1);
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> <span className="font-num">{stats['got-it']}</span></span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> <span className="font-num">{stats.shaky}</span></span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> <span className="font-num">{stats['dont-know']}</span></span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-text-muted/40" /> <span className="font-num">{stats.unseen}</span></span>
        </div>
      </div>

      {/* Review Due toggle + Sort options */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setReviewDue(r => !r); setCurrentIndex(0); setFlipped(false); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            reviewDue
              ? 'bg-accent text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'
          }`}
        >
          <Clock className="w-3 h-3" />
          Due ({dueCount})
        </button>
        <span className="w-px h-4 bg-border shrink-0" />
        <SlidersHorizontal className="w-3.5 h-3.5 text-text-muted shrink-0" />
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => handleSort(opt.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              sortMode === opt.id
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Unit filter */}
      {units.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => { setFilterUnit('all'); setCurrentIndex(0); setFlipped(false); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterUnit === 'all' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'}`}
          >
            All ({cards.length})
          </button>
          {units.map(unit => {
            const count = cards.filter(c => c.unitName === unit).length;
            return (
              <button
                key={unit}
                onClick={() => { setFilterUnit(unit); setCurrentIndex(0); setFlipped(false); }}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterUnit === unit ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'}`}
              >
                {unit} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Card counter */}
      <p className="text-xs text-text-muted text-center font-num">
        {currentIndex + 1} / {filtered.length}
      </p>

      {/* Card */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="relative min-h-[240px] bg-bg-tertiary rounded-xl border border-border p-6 flex items-center justify-center cursor-pointer select-none hover:border-accent/30 transition-colors"
      >
        <div className="text-center max-w-lg">
          {!flipped ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <p className="text-xs text-text-muted uppercase tracking-wider">Term</p>
                {card.priority === 'high' && <Flame className="w-3 h-3 text-warning" title="High priority" />}
              </div>
              <p className="text-lg font-semibold text-text-primary">{card.term}</p>
              {cardProgress && (
                <span className={`inline-block mt-3 text-xs px-2 py-0.5 rounded-full ${
                  cardProgress.rating === 'got-it' ? 'bg-success/15 text-success' :
                  cardProgress.rating === 'shaky' ? 'bg-warning/15 text-warning' :
                  'bg-danger/15 text-danger'
                }`}>
                  {cardProgress.rating === 'got-it' ? 'Got It' : cardProgress.rating === 'shaky' ? 'Shaky' : "Don't Know"}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">Definition</p>
              <p className="text-base text-text-primary leading-relaxed">{card.definition}</p>
            </>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <RotateCcw className="w-4 h-4 text-text-muted/50" />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Rating buttons - show when flipped */}
        <div className={`flex gap-2 transition-opacity ${flipped ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          {RATINGS.map(({ id, label, icon: Icon, color, textColor }) => (
            <button
              key={id}
              onClick={(e) => { e.stopPropagation(); handleRate(id); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${color} ${textColor}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button onClick={next} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-text-muted text-center">Click card to flip. Rate after flipping to track progress.</p>
    </div>
  );
}
