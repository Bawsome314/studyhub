import { useState } from 'react';
import { ArrowLeft, Zap, RotateCcw, Copy, Check } from 'lucide-react';
import { useCardProgress, shuffle } from '../../hooks/useStudyGuide';
import { formatDateTime } from '../../utils/studyHelpers';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

const PRESETS = [10, 25, 50];

export default function RapidFire({ courseId, cards, courseCode, courseName, onExit, onRecordMiss, onRecordCorrect }) {
  const { progress, rateCard, getWeightedCards } = useCardProgress(courseId);
  const [roundSize, setRoundSize] = useState(null);
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const [selected, setSelected] = useState(null); // index of chosen answer
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const [endless, setEndless] = useState(false);
  const [copied, setCopied] = useState(false);
  const [missed, setMissed] = useState([]);

  useKeyboardShortcuts({
    '1': () => { if (selected === null && roundSize !== null && !sessionDone && choices.length > 0) handleSelect(0); },
    '2': () => { if (selected === null && roundSize !== null && !sessionDone && choices.length > 1) handleSelect(1); },
    '3': () => { if (selected === null && roundSize !== null && !sessionDone && choices.length > 2) handleSelect(2); },
    '4': () => { if (selected === null && roundSize !== null && !sessionDone && choices.length > 3) handleSelect(3); },
  });

  function buildChoices(card, allCards) {
    const wrong = shuffle(allCards.filter(c => c.id !== card.id)).slice(0, 3);
    const options = shuffle([card, ...wrong]);
    return options.map(c => ({ id: c.id, term: c.term }));
  }

  function startRound(size, isEndless = false) {
    const weighted = getWeightedCards(cards);
    const seen = new Set();
    const unique = [];
    const limit = isEndless ? cards.length : Math.min(size, cards.length);
    for (const card of weighted) {
      if (!seen.has(card.id) && unique.length < limit) {
        seen.add(card.id);
        unique.push(card);
      }
    }
    setDeck(unique);
    setCurrentIndex(0);
    setSelected(null);
    setSessionStats({ total: 0, correct: 0 });
    setSessionDone(false);
    setCopied(false);
    setMissed([]);
    setRoundSize(size);
    setEndless(isEndless);
    if (unique.length > 0) {
      setChoices(buildChoices(unique[0], cards));
    }
  }

  function handleSelect(choiceIndex) {
    if (selected !== null) return; // already answered
    setSelected(choiceIndex);
    const card = deck[currentIndex];
    const isCorrect = choices[choiceIndex].id === card.id;

    // Update card progress based on answer
    rateCard(card.id, isCorrect ? 'got-it' : 'dont-know');
    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));

    // Record miss/correct for weak spot tracking
    if (isCorrect) {
      onRecordCorrect?.(card.id);
    } else {
      onRecordMiss?.(card.id, card.term, card.unitName);
      setMissed(prev => [...prev, { term: card.term, definition: card.definition, chosen: choices[choiceIndex].term }]);
    }

    // Auto-advance after brief delay
    setTimeout(() => {
      if (endless && currentIndex >= deck.length - 1) {
        const weighted = getWeightedCards(cards);
        const seen2 = new Set();
        const unique2 = [];
        for (const c of weighted) {
          if (!seen2.has(c.id) && unique2.length < cards.length) {
            seen2.add(c.id);
            unique2.push(c);
          }
        }
        setDeck(unique2);
        setCurrentIndex(0);
        setSelected(null);
        setChoices(buildChoices(unique2[0], cards));
      } else if (currentIndex < deck.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setSelected(null);
        setChoices(buildChoices(deck[nextIdx], cards));
      } else {
        setSessionDone(true);
      }
    }, 600);
  }

  // Size selector
  if (roundSize === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="text-center py-4">
          <Zap className="w-10 h-10 text-accent mx-auto mb-3" />
          <h3 className="text-lg font-bold text-text-primary mb-1">Rapid Fire</h3>
          <p className="text-sm text-text-muted">Quick drill with instant feedback</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider text-center">How many questions?</p>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            {PRESETS.map(n => (
              <button
                key={n}
                onClick={() => startRound(n)}
                disabled={cards.length < 4}
                className="py-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover hover:border-accent/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <p className="text-2xl font-bold font-num text-text-primary">{n}</p>
                <p className="text-xs text-text-muted">questions</p>
              </button>
            ))}
            <button
              onClick={() => startRound(cards.length, true)}
              disabled={cards.length < 4}
              className="py-4 rounded-xl border border-accent/30 bg-accent-muted hover:bg-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <p className="text-2xl font-bold font-num text-accent">∞</p>
              <p className="text-xs text-accent/70">Endless</p>
            </button>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-2">{cards.length} cards available</p>
        </div>
      </div>
    );
  }

  if (deck.length === 0 || cards.length < 4) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted text-sm">Need at least 4 cards for Rapid Fire.</p>
        <button onClick={onExit} className="mt-4 text-accent text-sm hover:underline">Back to Menu</button>
      </div>
    );
  }

  if (sessionDone) {
    const pct = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;

    async function handleCopy() {
      const lines = [
        `${courseCode} ${courseName} — Rapid Fire`,
        `Date: ${formatDateTime()}`,
        `Score: ${sessionStats.correct}/${sessionStats.total} (${pct}%)`,
      ];
      if (missed.length > 0) {
        lines.push('', 'Missed:');
        for (const m of missed) {
          lines.push(`  Term: ${m.term}`);
          lines.push(`    You picked: ${m.chosen}`);
          lines.push(`    Definition: ${m.definition}`);
        }
      }
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }

    return (
      <div className="space-y-6 text-center py-6">
        <Zap className="w-12 h-12 text-accent mx-auto" />
        <h3 className="text-xl font-bold text-text-primary">Round Complete!</h3>
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-success">{sessionStats.correct}</p>
            <p className="text-xs text-text-muted">Correct</p>
          </div>
          <div className="bg-danger/10 rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-danger">{sessionStats.total - sessionStats.correct}</p>
            <p className="text-xs text-text-muted">Wrong</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          Score: <span className="font-num font-semibold text-text-primary">{pct}%</span>
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Results'}
          </button>
          <button
            onClick={() => startRound(roundSize, endless)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg transition-colors border border-border"
          >
            <RotateCcw className="w-4 h-4" />
            Next Round
          </button>
          <button
            onClick={() => setRoundSize(null)}
            className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary border border-border rounded-lg transition-colors"
          >
            Change Size
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const card = deck[currentIndex];

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-sm text-text-secondary">
            {endless ? 'Endless' : `${roundSize} questions`}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Question {currentIndex + 1}{!endless ? ` of ${deck.length}` : ''}</span>
          <span className="font-num">
            <span className="text-success">{sessionStats.correct}</span>
            {' / '}
            <span className="text-danger">{sessionStats.total - sessionStats.correct}</span>
          </span>
        </div>
        {!endless && (
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Definition prompt */}
      <div className="bg-bg-tertiary rounded-xl border border-border p-6 min-h-[120px] flex items-center justify-center">
        <div className="text-center max-w-lg">
          <p className="text-xs text-accent mb-2 uppercase tracking-wider">What term matches this definition?</p>
          <p className="text-base text-text-primary leading-relaxed">{card.definition}</p>
        </div>
      </div>

      {/* Answer choices */}
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice, i) => {
          const isCorrect = choice.id === card.id;
          let btnClass = 'bg-bg-secondary border-border hover:border-accent/30 hover:bg-bg-hover cursor-pointer';
          if (selected !== null) {
            if (isCorrect) {
              btnClass = 'bg-success/15 border-success text-success';
            } else if (i === selected) {
              btnClass = 'bg-danger/15 border-danger text-danger';
            } else {
              btnClass = 'bg-bg-secondary border-border opacity-50';
            }
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

      <p className="text-xs text-text-muted text-center">Pick the correct term. Weak cards appear more often.</p>
    </div>
  );
}
