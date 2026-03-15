import { useState, useMemo } from 'react';
import { ArrowLeft, RotateCcw, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { shuffle, pickRandom } from '../../hooks/useStudyGuide';
import { formatDateTime } from '../../utils/studyHelpers';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

function generateStatements(cards) {
  const statements = [];
  const shuffled = shuffle(cards);

  for (const card of shuffled) {
    // 50% true, 50% false
    if (Math.random() > 0.5) {
      // True statement
      statements.push({
        id: card.id,
        statement: `"${card.term}" is defined as: ${card.definition}`,
        isTrue: true,
        term: card.term,
        definition: card.definition,
        unitName: card.unitName,
      });
    } else {
      // False statement - swap definition with another card's
      const others = cards.filter(c => c.id !== card.id);
      if (others.length === 0) {
        statements.push({
          id: card.id,
          statement: `"${card.term}" is defined as: ${card.definition}`,
          isTrue: true,
          term: card.term,
          definition: card.definition,
          unitName: card.unitName,
        });
      } else {
        const wrong = pickRandom(others, 1)[0];
        statements.push({
          id: card.id,
          statement: `"${card.term}" is defined as: ${wrong.definition}`,
          isTrue: false,
          term: card.term,
          definition: card.definition,
          wrongDefinition: wrong.definition,
          unitName: card.unitName,
        });
      }
    }
  }
  return statements;
}

export default function TrueFalse({ cards, trueFalsePool = [], courseCode, courseName, onExit, onRecordMiss, onRecordCorrect }) {
  const [statements] = useState(() => {
    if (trueFalsePool.length > 0) {
      // Use dedicated pool: { id, statement, correct, explanation }
      return shuffle(trueFalsePool).map(item => ({
        id: item.id,
        statement: item.statement,
        isTrue: item.correct,
        explanation: item.explanation || '',
        term: '',
        definition: '',
      }));
    }
    return generateStatements(cards);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(null); // true or false
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [missed, setMissed] = useState([]);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const stmt = statements[currentIndex];
  const total = statements.length;

  useKeyboardShortcuts({
    't': () => { if (answered === null && !done) answer(true); },
    'T': () => { if (answered === null && !done) answer(true); },
    'f': () => { if (answered === null && !done) answer(false); },
    'F': () => { if (answered === null && !done) answer(false); },
    'Enter': () => { if (answered !== null && !done) next(); },
  });

  function answer(userAnswer) {
    if (answered !== null) return;
    setAnswered(userAnswer);
    const isCorrect = userAnswer === stmt.isTrue;
    setStats(prev => ({
      ...prev,
      [isCorrect ? 'correct' : 'incorrect']: prev[isCorrect ? 'correct' : 'incorrect'] + 1,
    }));
    if (isCorrect) {
      onRecordCorrect?.(stmt.id);
    } else {
      onRecordMiss?.(stmt.id, stmt.statement, stmt.unitName);
      setMissed(prev => [...prev, {
        statement: stmt.statement,
        correctAnswer: stmt.isTrue ? 'True' : 'False',
        explanation: stmt.explanation
          ? stmt.explanation
          : stmt.isTrue
            ? `This is the correct definition of "${stmt.term}".`
            : `The correct definition of "${stmt.term}" is: ${stmt.definition}`,
      }]);
    }
  }

  function next() {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswered(null);
    } else {
      setDone(true);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setAnswered(null);
    setStats({ correct: 0, incorrect: 0 });
    setMissed([]);
    setDone(false);
  }

  async function handleCopy() {
    const pct = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    const lines = [
      `${courseCode} ${courseName} — True/False`,
      `Date: ${formatDateTime()}`,
      `Score: ${stats.correct}/${total} (${pct}%)`,
    ];
    if (missed.length > 0) {
      lines.push('', 'Missed:');
      for (const m of missed) {
        lines.push(`  Statement: ${m.statement}`);
        lines.push(`    Correct answer: ${m.correctAnswer}`);
        lines.push(`    ${m.explanation}`);
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
        <h3 className="text-xl font-bold text-text-primary">True/False Complete</h3>
        <p className="text-4xl font-bold font-num text-text-primary">{pct}%</p>
        <p className="text-sm text-text-secondary">{stats.correct} of {total} correct</p>
        <div className="flex justify-center gap-3 flex-wrap">
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
          <div className="text-left max-w-lg mx-auto mt-4">
            <p className="text-xs font-semibold text-text-primary mb-2">Missed ({missed.length})</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {missed.map((m, i) => (
                <div key={i} className="bg-bg-tertiary rounded-lg p-3 text-xs">
                  <p className="text-text-primary">{m.statement}</p>
                  <p className="text-success mt-1">Answer: {m.correctAnswer}</p>
                  <p className="text-text-muted mt-0.5">{m.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isCorrect = answered !== null && answered === stmt.isTrue;

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
      {stmt.unitName && <span className="text-xs text-accent font-medium">{stmt.unitName}</span>}

      {/* Statement */}
      <div className="bg-bg-tertiary rounded-xl border border-border p-6">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Is this statement true or false?</p>
        <p className="text-base text-text-primary leading-relaxed">{stmt.statement}</p>
      </div>

      {/* True / False buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(true)}
          disabled={answered !== null}
          className={`flex items-center justify-center gap-2 py-4 rounded-xl border text-sm font-semibold transition-all ${
            answered === null
              ? 'border-border bg-bg-secondary hover:bg-success/10 hover:border-success/30 cursor-pointer'
              : answered === true && isCorrect
              ? 'border-success bg-success/15 text-success'
              : answered === true && !isCorrect
              ? 'border-danger bg-danger/15 text-danger'
              : stmt.isTrue
              ? 'border-success bg-success/10 text-success'
              : 'border-border bg-bg-secondary opacity-40'
          }`}
        >
          <ThumbsUp className="w-5 h-5" />
          True
        </button>
        <button
          onClick={() => answer(false)}
          disabled={answered !== null}
          className={`flex items-center justify-center gap-2 py-4 rounded-xl border text-sm font-semibold transition-all ${
            answered === null
              ? 'border-border bg-bg-secondary hover:bg-danger/10 hover:border-danger/30 cursor-pointer'
              : answered === false && isCorrect
              ? 'border-success bg-success/15 text-success'
              : answered === false && !isCorrect
              ? 'border-danger bg-danger/15 text-danger'
              : !stmt.isTrue
              ? 'border-success bg-success/10 text-success'
              : 'border-border bg-bg-secondary opacity-40'
          }`}
        >
          <ThumbsDown className="w-5 h-5" />
          False
        </button>
      </div>

      {/* Feedback */}
      {answered !== null && (
        <div className={`p-3 rounded-lg text-sm ${isCorrect ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
          <p className={`font-medium ${isCorrect ? 'text-success' : 'text-danger'}`}>
            {isCorrect ? 'Correct!' : `Incorrect — the answer is ${stmt.isTrue ? 'True' : 'False'}`}
          </p>
          {!isCorrect && stmt.explanation && (
            <p className="text-text-secondary text-xs mt-1">{stmt.explanation}</p>
          )}
          {!isCorrect && !stmt.explanation && !stmt.isTrue && stmt.term && (
            <p className="text-text-secondary text-xs mt-1">
              The correct definition of "{stmt.term}" is: {stmt.definition}
            </p>
          )}
        </div>
      )}

      {/* Next */}
      {answered !== null && (
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
