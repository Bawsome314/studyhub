import { useState, useMemo } from 'react';
import { ArrowLeft, Zap, AlertTriangle, RotateCcw } from 'lucide-react';
import { shuffle } from '../../hooks/useStudyGuide';

export default function WeakSpotsView({ allCards, progress, weakSpots, onExit }) {
  const [drilling, setDrilling] = useState(false);
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [drillDone, setDrillDone] = useState(false);

  // Combine shaky/dont-know flashcards with missed questions
  const combined = useMemo(() => {
    const shakyCards = allCards
      .filter(c => progress[c.id] && (progress[c.id].rating === 'dont-know' || progress[c.id].rating === 'shaky'))
      .map(c => ({
        id: c.id,
        text: c.term,
        definition: c.definition,
        unitName: c.unitName,
        badge: progress[c.id].rating === 'dont-know' ? "Don't Know" : 'Shaky',
        badgeColor: progress[c.id].rating === 'dont-know' ? 'text-danger bg-danger/10' : 'text-warning bg-warning/10',
        missCount: 0,
        sortOrder: progress[c.id].rating === 'dont-know' ? 100 : 50,
      }));

    const shakyIds = new Set(shakyCards.map(c => c.id));
    const missedOnly = weakSpots
      .filter(w => !shakyIds.has(w.id))
      .map(w => ({
        ...w,
        badge: `${w.missCount}x missed`,
        badgeColor: 'text-danger bg-danger/10',
        sortOrder: w.missCount,
      }));

    // Also add shaky cards that ALSO have miss counts — merge the miss info
    const mergedShaky = shakyCards.map(sc => {
      const missed = weakSpots.find(w => w.id === sc.id);
      if (missed) {
        return {
          ...sc,
          missCount: missed.missCount,
          badge: `${missed.missCount}x · ${sc.badge}`,
          sortOrder: missed.missCount + (sc.sortOrder),
        };
      }
      return sc;
    });

    return [...mergedShaky, ...missedOnly].sort((a, b) => b.sortOrder - a.sortOrder);
  }, [allCards, progress, weakSpots]);

  // Get drillable cards (cards that exist in allCards and are weak)
  const drillableCards = useMemo(() => {
    const weakIds = new Set(combined.map(c => c.id));
    return allCards.filter(c => weakIds.has(c.id));
  }, [combined, allCards]);

  function buildChoices(card) {
    const wrong = shuffle(allCards.filter(c => c.id !== card.id)).slice(0, 3);
    return shuffle([card, ...wrong]).map(c => ({ id: c.id, term: c.term }));
  }

  function startDrill() {
    if (drillableCards.length < 4) return;
    const shuffled = shuffle(drillableCards);
    setDeck(shuffled);
    setCurrentIndex(0);
    setSelected(null);
    setStats({ correct: 0, total: 0 });
    setDrillDone(false);
    setDrilling(true);
    setChoices(buildChoices(shuffled[0]));
  }

  function handleSelect(choiceIndex) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    const card = deck[currentIndex];
    const isCorrect = choices[choiceIndex].id === card.id;
    setStats(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));

    setTimeout(() => {
      if (currentIndex < deck.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setSelected(null);
        setChoices(buildChoices(deck[nextIdx]));
      } else {
        setDrillDone(true);
      }
    }, 600);
  }

  // Drill complete screen
  if (drilling && drillDone) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="space-y-6 text-center py-6">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto" />
        <h3 className="text-xl font-bold text-text-primary">Weak Spots Drill Complete</h3>
        <p className="text-4xl font-bold font-num text-text-primary">{pct}%</p>
        <p className="text-sm text-text-secondary">{stats.correct} of {stats.total} correct</p>
        <div className="flex justify-center gap-3">
          <button onClick={startDrill} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> Drill Again
          </button>
          <button onClick={() => setDrilling(false)} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary border border-border rounded-lg transition-colors">
            Back to List
          </button>
          <button onClick={onExit} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Drill active screen
  if (drilling && deck.length > 0) {
    const card = deck[currentIndex];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setDrilling(false)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
            <span>Weak Spots Drill</span>
            <span className="font-num">{currentIndex + 1}/{deck.length}</span>
          </div>
        </div>

        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-danger rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }} />
        </div>

        <div className="bg-bg-tertiary rounded-xl border border-border p-6 min-h-[120px] flex items-center justify-center">
          <div className="text-center max-w-lg">
            <p className="text-xs text-danger mb-2 uppercase tracking-wider">What term matches this definition?</p>
            <p className="text-base text-text-primary leading-relaxed">{card.definition}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {choices.map((choice, i) => {
            const isCorrect = choice.id === card.id;
            let btnClass = 'bg-bg-secondary border-border hover:border-accent/30 hover:bg-bg-hover cursor-pointer';
            if (selected !== null) {
              if (isCorrect) btnClass = 'bg-success/15 border-success text-success';
              else if (i === selected) btnClass = 'bg-danger/15 border-danger text-danger';
              else btnClass = 'bg-bg-secondary border-border opacity-50';
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`p-3 rounded-xl border text-sm font-medium text-left transition-all ${btnClass}`}
              >
                <span className={selected !== null && (isCorrect || i === selected) ? '' : 'text-text-primary'}>
                  {choice.term}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Main weak spots list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger" />
          <span className="text-sm font-semibold text-text-primary">Weak Spots</span>
          <span className="text-xs font-num text-danger">{combined.length}</span>
        </div>
      </div>

      {/* Drill button */}
      {drillableCards.length >= 4 && (
        <button
          onClick={startDrill}
          className="w-full flex items-center justify-center gap-2 py-3 bg-danger/10 border border-danger/20 rounded-xl text-sm font-semibold text-danger hover:bg-danger/15 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Drill Weak Spots ({drillableCards.length} cards)
        </button>
      )}

      {combined.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No weak spots identified yet.</p>
          <p className="text-xs text-text-muted mt-1">Study more to surface areas that need work.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {combined.map(item => (
            <div key={item.id} className="flex items-start gap-3 bg-bg-secondary rounded-lg border border-border px-4 py-2.5">
              <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 mt-0.5 ${item.badgeColor}`}>
                {item.badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{item.text}</p>
                {item.definition && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.definition}</p>
                )}
                {item.unitName && (
                  <p className="text-[10px] text-accent mt-0.5">{item.unitName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
