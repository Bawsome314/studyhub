import { useState, useMemo, useRef } from 'react';
import { ArrowLeft, RotateCcw, Copy, Check } from 'lucide-react';
import { shuffle, pickRandom } from '../../hooks/useStudyGuide';
import { formatDateTime } from '../../utils/studyHelpers';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

export default function TripleThreat({ cards, extraQuestions = [], courseCode, courseName, onExit, onRecordMiss, onRecordCorrect }) {
  // Use extraQuestions MCQ mode when available, otherwise card-based
  const usePool = extraQuestions.length > 0;
  const [deck] = useState(() => usePool ? shuffle(extraQuestions) : shuffle(cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [missed, setMissed] = useState([]);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const item = deck[currentIndex];
  const total = deck.length;

  // Card-based mode: alternate term/def
  const showTerm = !usePool && currentIndex % 2 === 0;

  const choices = useMemo(() => {
    if (!item) return [];

    if (usePool) {
      // MCQ from extraQuestions pool — pick 3 choices (correct + 2 wrong)
      const correctChoice = item.choices[item.correctIndex];
      const wrongChoices = item.choices.filter((_, i) => i !== item.correctIndex);
      const picked = shuffle(wrongChoices).slice(0, 2);
      return shuffle([
        { text: correctChoice, correct: true },
        ...picked.map(t => ({ text: t, correct: false })),
      ]);
    }

    const others = cards.filter(c => c.id !== item.id);
    const distractors = pickRandom(others, Math.min(2, others.length));

    if (showTerm) {
      return shuffle([
        { text: item.definition, correct: true },
        ...distractors.map(d => ({ text: d.definition, correct: false })),
      ]);
    } else {
      return shuffle([
        { text: item.term, correct: true },
        ...distractors.map(d => ({ text: d.term, correct: false })),
      ]);
    }
  }, [currentIndex, item]);

  useKeyboardShortcuts({
    '1': () => { if (selected === null && !done && choices.length > 0) selectChoice(0); },
    '2': () => { if (selected === null && !done && choices.length > 1) selectChoice(1); },
    '3': () => { if (selected === null && !done && choices.length > 2) selectChoice(2); },
    'Enter': () => { if (selected !== null && !done) next(); },
  });

  function selectChoice(index) {
    if (selected !== null) return;
    setSelected(index);
    const isCorrect = choices[index].correct;
    setStats(prev => ({
      ...prev,
      [isCorrect ? 'correct' : 'incorrect']: prev[isCorrect ? 'correct' : 'incorrect'] + 1,
    }));
    if (isCorrect) {
      onRecordCorrect?.(item.id);
    } else {
      onRecordMiss?.(item.id, usePool ? item.question : item.term, item.unitName);
      setMissed(prev => [...prev, {
        prompt: usePool ? item.question : (showTerm ? item.term : item.definition),
        yourAnswer: choices[index].text,
        correctAnswer: usePool ? item.choices[item.correctIndex] : (showTerm ? item.definition : item.term),
      }]);
    }
  }

  function next() {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setSelected(null);
    setStats({ correct: 0, incorrect: 0 });
    setMissed([]);
    setDone(false);
  }

  async function handleCopy() {
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    const lines = [
      `${courseCode} ${courseName} — Triple Threat`,
      `Date: ${formatDateTime()}`,
      `Score: ${stats.correct}/${total} (${pct}%)`,
    ];
    if (missed.length > 0) {
      lines.push('', 'Missed:');
      for (const m of missed) {
        lines.push(`  Q: ${m.prompt}`);
        lines.push(`    Your answer: ${m.yourAnswer}`);
        lines.push(`    Correct: ${m.correctAnswer}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (done) {
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    return (
      <div className="space-y-6 text-center py-6">
        <h3 className="text-xl font-bold text-text-primary">Triple Threat Complete</h3>
        <p className="text-4xl font-bold font-num text-text-primary">{pct}%</p>
        <p className="text-sm text-text-secondary">{stats.correct} of {total} correct</p>
        <div className="flex justify-center gap-3">
          <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Results'}
          </button>
          <button onClick={restart} className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg transition-colors border border-border">
            <RotateCcw className="w-4 h-4" /> Again
          </button>
          <button onClick={onExit} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back
          </button>
        </div>
        {missed.length > 0 && (
          <div className="text-left max-w-md mx-auto mt-4">
            <p className="text-xs font-semibold text-text-primary mb-2">Missed ({missed.length})</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {missed.map((m, i) => (
                <div key={i} className="bg-bg-tertiary rounded-lg p-3 text-xs">
                  <p className="text-text-primary font-medium">{m.prompt}</p>
                  <p className="text-danger mt-1">You: {m.yourAnswer}</p>
                  <p className="text-success">Answer: {m.correctAnswer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="font-num">{currentIndex + 1}/{total}</span>
          <span className="text-success font-num">{stats.correct}</span>
          <span className="text-danger font-num">{stats.incorrect}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / total) * 100}%` }} />
      </div>

      {/* Unit */}
      {item.unitName && <span className="text-xs text-accent font-medium">{item.unitName}</span>}

      {/* Prompt */}
      <div className="bg-bg-tertiary rounded-xl border border-border p-6 text-center">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-3">
          {usePool ? 'Pick the correct answer' : showTerm ? 'Pick the correct definition' : 'Pick the correct term'}
        </p>
        <p className="text-lg font-semibold text-text-primary">
          {usePool ? item.question : showTerm ? item.term : item.definition}
        </p>
      </div>

      {/* 3 Choices */}
      <div className="space-y-2">
        {choices.map((choice, i) => {
          let style = 'border-border bg-bg-secondary hover:bg-bg-hover hover:border-accent/30 cursor-pointer';
          if (selected !== null) {
            if (choice.correct) {
              style = 'border-success bg-success/10 cursor-default';
            } else if (i === selected && !choice.correct) {
              style = 'border-danger bg-danger/10 cursor-default';
            } else {
              style = 'border-border bg-bg-secondary opacity-40 cursor-default';
            }
          }

          return (
            <button
              key={i}
              onClick={() => selectChoice(i)}
              disabled={selected !== null}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${style}`}
            >
              <span className="text-text-primary">{choice.text}</span>
            </button>
          );
        })}
      </div>

      {/* Next */}
      {selected !== null && (
        <button
          onClick={next}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors ml-auto"
        >
          {currentIndex < total - 1 ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  );
}
