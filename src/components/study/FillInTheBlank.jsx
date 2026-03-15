import { useState, useRef } from 'react';
import { ArrowLeft, Check, X, SkipForward, RotateCcw, Copy } from 'lucide-react';
import { shuffle } from '../../hooks/useStudyGuide';
import { formatDateTime } from '../../utils/studyHelpers';

export default function FillInTheBlank({ cards, fillInBlankPool = [], courseCode, courseName, onExit, onRecordMiss, onRecordCorrect }) {
  // Build deck from pool or cards
  const buildDeck = () => {
    if (fillInBlankPool.length > 0) {
      return shuffle(fillInBlankPool).map(item => ({
        id: item.id,
        prompt: item.sentence,
        answer: item.answer,
        distractors: item.distractors || [],
      }));
    }
    return shuffle(cards).map(c => ({
      id: c.id,
      prompt: c.definition,
      answer: c.term,
      unitName: c.unitName,
    }));
  };
  const [deck, setDeck] = useState(buildDeck);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [missed, setMissed] = useState([]);
  const inputRef = useRef(null);

  const item = deck[currentIndex];
  const total = deck.length;

  function checkAnswer() {
    if (!answer.trim()) return;
    setRevealed(true);
    const isCorrect = answer.trim().toLowerCase() === item.answer.toLowerCase();
    setStats(prev => ({
      ...prev,
      [isCorrect ? 'correct' : 'incorrect']: prev[isCorrect ? 'correct' : 'incorrect'] + 1,
    }));
    if (isCorrect) {
      onRecordCorrect?.(item.id);
    } else {
      onRecordMiss?.(item.id, item.answer, item.unitName);
      setMissed(prev => [...prev, { prompt: item.prompt, yourAnswer: answer.trim(), correct: item.answer }]);
    }
  }

  function skip() {
    setRevealed(true);
    setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
  }

  function next() {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setRevealed(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setDone(true);
    }
  }

  function restart() {
    setDeck(buildDeck());
    setCurrentIndex(0);
    setAnswer('');
    setRevealed(false);
    setStats({ correct: 0, incorrect: 0, skipped: 0 });
    setDone(false);
    setCopied(false);
    setMissed([]);
  }

  if (done) {
    const attempted = stats.correct + stats.incorrect;
    const pct = attempted > 0 ? Math.round((stats.correct / attempted) * 100) : 0;
    return (
      <div className="space-y-6 text-center py-6">
        <h3 className="text-xl font-bold text-text-primary">Fill in the Blank Complete</h3>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          <div className="bg-success/10 rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-success">{stats.correct}</p>
            <p className="text-xs text-text-muted">Correct</p>
          </div>
          <div className="bg-danger/10 rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-danger">{stats.incorrect}</p>
            <p className="text-xs text-text-muted">Incorrect</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-text-muted">{stats.skipped}</p>
            <p className="text-xs text-text-muted">Skipped</p>
          </div>
        </div>
        {attempted > 0 && (
          <p className="text-sm text-text-secondary">
            Accuracy: <span className="font-num font-semibold text-text-primary">{pct}%</span>
          </p>
        )}
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              const lines = [
                `${courseCode} ${courseName} — Fill in the Blank`,
                `Date: ${formatDateTime()}`,
                `Score: ${stats.correct}/${stats.correct + stats.incorrect} correct, ${stats.skipped} skipped`,
              ];
              if (missed.length > 0) {
                lines.push('', 'Missed:');
                for (const m of missed) {
                  lines.push(`  Prompt: ${m.prompt}`);
                  lines.push(`    You typed: ${m.yourAnswer}`);
                  lines.push(`    Correct: ${m.correct}`);
                }
              }
              try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Results'}
          </button>
          <button onClick={restart} className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg transition-colors border border-border">
            <RotateCcw className="w-4 h-4" /> Play Again
          </button>
          <button onClick={onExit} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const isCorrect = revealed && answer.trim().toLowerCase() === item.answer.toLowerCase();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs text-text-muted font-num">{currentIndex + 1} / {total}</span>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <span className="text-success font-num">{stats.correct} correct</span>
        <span className="text-danger font-num">{stats.incorrect} wrong</span>
        <span className="text-text-muted font-num">{stats.skipped} skipped</span>
      </div>

      {/* Unit label */}
      {item.unitName && (
        <span className="text-xs text-accent font-medium">{item.unitName}</span>
      )}

      {/* Definition prompt */}
      <div className="bg-bg-tertiary rounded-xl border border-border p-6">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-3">
          {item.distractors?.length > 0 ? 'Fill in the blank' : 'What term matches this definition?'}
        </p>
        <p className="text-base text-text-primary leading-relaxed">{item.prompt}</p>
      </div>

      {/* Answer input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !revealed) checkAnswer();
              if (e.key === 'Enter' && revealed) next();
            }}
            disabled={revealed}
            placeholder="Type the term..."
            className="flex-1 bg-bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-60"
            autoFocus
          />
          {!revealed ? (
            <>
              <button
                onClick={checkAnswer}
                disabled={!answer.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={skip}
                className="px-3 py-2 text-text-muted hover:text-text-primary transition-colors"
                title="Skip"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={next}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          )}
        </div>

        {/* Feedback */}
        {revealed && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isCorrect ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
            {isCorrect ? (
              <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-danger mt-0.5 shrink-0" />
            )}
            <div>
              {isCorrect ? (
                <p className="text-success font-medium">Correct!</p>
              ) : (
                <>
                  <p className="text-danger font-medium">
                    The answer is: <span className="text-text-primary">{item.answer}</span>
                  </p>
                  {answer.trim() && (
                    <p className="text-text-muted text-xs mt-1">You answered: {answer}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
