import { useState } from 'react';
import { Copy, Check, RotateCcw, Trophy } from 'lucide-react';
import { formatDateTime } from '../../utils/studyHelpers';

export default function ResultsSummary({ courseCode, courseName, type, score, total, unitBreakdown, missed, onRestart, onExit }) {
  const [copied, setCopied] = useState(false);
  const pct = Math.round((score / total) * 100);

  function formatForClipboard() {
    const lines = [
      `${courseCode} ${courseName} — ${type}`,
      `Date: ${formatDateTime()}`,
      `Score: ${score}/${total} (${pct}%)`,
      '',
      'Breakdown by Unit:',
    ];

    for (const unit of unitBreakdown) {
      lines.push(`  ${unit.name}: ${unit.correct}/${unit.total} (${unit.total > 0 ? Math.round((unit.correct / unit.total) * 100) : 0}%)`);
    }

    if (missed.length > 0) {
      lines.push('', 'Missed Questions:');
      for (const m of missed) {
        lines.push(`  Q: ${m.question}`);
        lines.push(`    Your answer: ${m.yourAnswer}`);
        lines.push(`    Correct: ${m.correctAnswer}`);
        if (m.explanation) lines.push(`    Explanation: ${m.explanation}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatForClipboard());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = formatForClipboard();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const grade = pct >= 90 ? 'Excellent!' : pct >= 80 ? 'Great job!' : pct >= 70 ? 'Good effort!' : pct >= 60 ? 'Getting there!' : 'Keep studying!';
  const gradeColor = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="text-center py-6">
        <Trophy className={`w-12 h-12 mx-auto mb-3 ${gradeColor}`} />
        <p className={`text-lg font-semibold ${gradeColor}`}>{grade}</p>
        <p className="text-4xl font-bold font-num text-text-primary mt-2">{pct}%</p>
        <p className="text-sm text-text-secondary mt-1">
          {score} of {total} correct
        </p>
      </div>

      {/* Unit breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Breakdown by Unit</h3>
        <div className="space-y-2">
          {unitBreakdown.map((unit, i) => {
            const unitPct = unit.total > 0 ? Math.round((unit.correct / unit.total) * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary flex-1 truncate">{unit.name}</span>
                <span className="text-xs font-num text-text-muted w-16 text-right">{unit.correct}/{unit.total}</span>
                <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${unitPct >= 80 ? 'bg-success' : unitPct >= 60 ? 'bg-warning' : 'bg-danger'}`}
                    style={{ width: `${unitPct}%` }}
                  />
                </div>
                <span className="text-xs font-num text-text-muted w-10 text-right">{unitPct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missed questions */}
      {missed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Missed Questions ({missed.length})
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {missed.map((m, i) => (
              <div key={i} className="bg-bg-tertiary rounded-lg p-3 text-sm">
                <p className="text-text-primary mb-2">{m.question}</p>
                <p className="text-danger text-xs">Your answer: {m.yourAnswer}</p>
                <p className="text-success text-xs">Correct: {m.correctAnswer}</p>
                {m.explanation && (
                  <p className="text-text-muted text-xs mt-1 italic">{m.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg transition-colors border border-border"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
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
