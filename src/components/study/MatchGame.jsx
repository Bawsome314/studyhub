import { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Trophy, Clock, Copy, Check } from 'lucide-react';
import { shuffle } from '../../hooks/useStudyGuide';
import { formatDateTime } from '../../utils/studyHelpers';

export default function MatchGame({ cards, matchPairs = [], courseCode, courseName, onExit }) {
  const GRID_SIZE = 8; // 8 pairs = 16 tiles
  const [gameCards, setGameCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [mismatch, setMismatch] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    startGame();
  }, []);

  // Timer
  useEffect(() => {
    if (!startTime || gameOver) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameOver]);

  function startGame() {
    const source = matchPairs.length >= GRID_SIZE ? matchPairs : cards;
    const subset = shuffle(source).slice(0, GRID_SIZE);
    const tiles = shuffle([
      ...subset.map(c => ({ id: `term-${c.id}`, pairId: c.id, text: c.term, type: 'term' })),
      ...subset.map(c => ({ id: `def-${c.id}`, pairId: c.id, text: c.definition, type: 'definition' })),
    ]);
    setGameCards(tiles);
    setSelected([]);
    setMatched(new Set());
    setMismatch(false);
    setAttempts(0);
    setStartTime(Date.now());
    setElapsed(0);
    setGameOver(false);
  }

  function handleSelect(tile) {
    if (mismatch) return;
    if (matched.has(tile.pairId)) return;
    if (selected.find(s => s.id === tile.id)) return;
    if (selected.length >= 2) return;

    const newSelected = [...selected, tile];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setAttempts(a => a + 1);
      const [a, b] = newSelected;

      if (a.pairId === b.pairId && a.type !== b.type) {
        // Match!
        const newMatched = new Set(matched);
        newMatched.add(a.pairId);
        setMatched(newMatched);
        setSelected([]);

        if (newMatched.size === GRID_SIZE) {
          setGameOver(true);
        }
      } else {
        // Mismatch
        setMismatch(true);
        setTimeout(() => {
          setSelected([]);
          setMismatch(false);
        }, 800);
      }
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  if (gameOver) {
    const accuracy = attempts > 0 ? Math.round((GRID_SIZE / attempts) * 100) : 0;
    return (
      <div className="space-y-6 text-center py-6">
        <Trophy className="w-12 h-12 text-success mx-auto" />
        <h3 className="text-xl font-bold text-text-primary">All Matched!</h3>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-accent">{GRID_SIZE}</p>
            <p className="text-xs text-text-muted">Pairs</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-text-primary">{attempts}</p>
            <p className="text-xs text-text-muted">Attempts</p>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3">
            <p className="text-2xl font-bold font-num text-text-primary">{formatTime(elapsed)}</p>
            <p className="text-xs text-text-muted">Time</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary">Accuracy: <span className="font-num font-semibold">{accuracy}%</span></p>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              const lines = [
                `${courseCode} ${courseName} — Match`,
                `Date: ${formatDateTime()}`,
                `${GRID_SIZE} pairs matched in ${formatTime(elapsed)}`,
                `Attempts: ${attempts} · Accuracy: ${accuracy}%`,
              ];
              try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Results'}
          </button>
          <button onClick={startGame} className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg transition-colors border border-border">
            <RotateCcw className="w-4 h-4" /> Play Again
          </button>
          <button onClick={onExit} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back to Menu
          </button>
        </div>
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
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="font-num">{matched.size}/{GRID_SIZE} pairs</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> <span className="font-num">{formatTime(elapsed)}</span></span>
          <span className="font-num">{attempts} attempts</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${(matched.size / GRID_SIZE) * 100}%` }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2">
        {gameCards.map(tile => {
          const isMatched = matched.has(tile.pairId);
          const isSelected = selected.find(s => s.id === tile.id);
          const isMismatchTile = mismatch && isSelected;

          let tileStyle = 'bg-bg-tertiary border-border hover:border-accent/30 cursor-pointer';
          if (isMatched) {
            tileStyle = 'bg-success/10 border-success/30 cursor-default opacity-60';
          } else if (isMismatchTile) {
            tileStyle = 'bg-danger/10 border-danger/30 cursor-default';
          } else if (isSelected) {
            tileStyle = 'bg-accent-muted border-accent cursor-default';
          }

          return (
            <button
              key={tile.id}
              onClick={() => handleSelect(tile)}
              disabled={isMatched}
              className={`p-3 rounded-lg border text-xs leading-snug min-h-[70px] flex items-center justify-center text-center transition-all ${tileStyle}`}
            >
              <span className={`${isMatched ? 'text-text-muted' : 'text-text-primary'}`}>
                {tile.type === 'term' ? (
                  <span className="font-semibold">{tile.text}</span>
                ) : (
                  <span className="text-text-secondary">{tile.text.length > 60 ? tile.text.slice(0, 60) + '...' : tile.text}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-text-muted text-center">Match terms with their definitions. Click two tiles to check for a pair.</p>
    </div>
  );
}
