import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, BookOpen, Lightbulb, Link2, AlertTriangle, ChevronRight } from 'lucide-react';

export default function LessonView({ unit, lessonProgress, onComplete, onExit }) {
  const lessons = unit.lessons || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [checkpointAnswer, setCheckpointAnswer] = useState(null); // index chosen
  const [checkpointRevealed, setCheckpointRevealed] = useState(false);
  const [completedSections, setCompletedSections] = useState(
    () => new Set(lessonProgress || [])
  );

  const section = lessons[currentIdx];
  const isLastSection = currentIdx === lessons.length - 1;
  const allComplete = completedSections.size === lessons.length;

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCheckpointAnswer(null);
    setCheckpointRevealed(false);
  }, [currentIdx]);

  function handleCheckpointSelect(idx) {
    if (checkpointRevealed) return;
    setCheckpointAnswer(idx);
    setCheckpointRevealed(true);
    // Mark section complete
    setCompletedSections(prev => {
      const next = new Set(prev);
      next.add(section.id);
      return next;
    });
  }

  function goNext() {
    if (isLastSection) return;
    setCurrentIdx(i => i + 1);
  }

  function goPrev() {
    if (currentIdx === 0) return;
    setCurrentIdx(i => i - 1);
  }

  function handleFinish() {
    onComplete(Array.from(completedSections));
  }

  // Completion screen
  if (allComplete && isLastSection && checkpointRevealed) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="bg-bg-secondary rounded-xl border border-border p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Lesson Complete!</h2>
            <p className="text-sm text-text-muted mt-1">{unit.name}</p>
            <p className="text-xs text-text-muted mt-2">
              You covered {lessons.length} sections. Ready to practice?
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={handleFinish}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continue Studying
            </button>
            <button
              onClick={onExit}
              className="px-5 py-2.5 border border-border text-text-secondary hover:text-text-primary text-sm font-medium rounded-lg transition-colors"
            >
              Back to Course
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!section) return null;

  const isCorrect = checkpointAnswer === section.checkpoint?.correctIndex;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs text-text-muted">{unit.name}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>{currentIdx + 1} of {lessons.length}</span>
          <span>{completedSections.size} completed</span>
        </div>
        <div className="flex gap-1">
          {lessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i === currentIdx
                  ? 'bg-accent'
                  : completedSections.has(l.id)
                  ? 'bg-success/60'
                  : 'bg-bg-tertiary'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Section content */}
      <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
        {/* Section title */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-num text-accent font-semibold">Section {currentIdx + 1}</span>
            {completedSections.has(section.id) && (
              <CheckCircle2 className="w-3 h-3 text-success" />
            )}
          </div>
          <h2 className="text-lg font-bold text-text-primary leading-snug">{section.title}</h2>
        </div>

        {/* Main content */}
        <div className="px-5 pb-4">
          <div className="text-sm text-text-secondary leading-relaxed space-y-3 max-w-prose">
            {section.content.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* Example block */}
        {section.example && (
          <div className="mx-5 mb-4 rounded-lg bg-accent/8 border border-accent/15 p-4">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1.5">Example</p>
                <p className="text-sm text-text-secondary leading-relaxed">{section.example}</p>
              </div>
            </div>
          </div>
        )}

        {/* Connections */}
        {section.connections && (
          <div className="mx-5 mb-4 rounded-lg bg-bg-tertiary/50 border border-border p-4">
            <div className="flex items-start gap-2.5">
              <Link2 className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Connections</p>
                <p className="text-sm text-text-secondary leading-relaxed">{section.connections}</p>
              </div>
            </div>
          </div>
        )}

        {/* Key Distinctions */}
        {section.keyDistinctions?.length > 0 && (
          <div className="mx-5 mb-4 rounded-lg bg-warning/8 border border-warning/15 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-warning uppercase tracking-wider mb-1.5">Don't Confuse</p>
                <div className="space-y-1.5">
                  {section.keyDistinctions.map((d, i) => (
                    <p key={i} className="text-sm text-text-secondary leading-relaxed">{d}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkpoint */}
        {section.checkpoint && (
          <div className="mx-5 mb-5 rounded-lg bg-bg-tertiary border border-border p-4 space-y-3">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Checkpoint</p>
            <p className="text-sm font-medium text-text-primary">{section.checkpoint.question}</p>
            <div className="space-y-1.5">
              {section.checkpoint.choices.map((choice, i) => {
                let style = 'border-border hover:border-accent/30 hover:bg-bg-hover';
                if (checkpointRevealed) {
                  if (i === section.checkpoint.correctIndex) {
                    style = 'border-success/40 bg-success/10';
                  } else if (i === checkpointAnswer) {
                    style = 'border-danger/40 bg-danger/10';
                  } else {
                    style = 'border-border opacity-50';
                  }
                } else if (checkpointAnswer === i) {
                  style = 'border-accent bg-accent-muted';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleCheckpointSelect(i)}
                    disabled={checkpointRevealed}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${style}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-num shrink-0 text-text-muted">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-text-primary">{choice}</span>
                      {checkpointRevealed && i === section.checkpoint.correctIndex && (
                        <CheckCircle2 className="w-4 h-4 text-success ml-auto shrink-0" />
                      )}
                      {checkpointRevealed && i === checkpointAnswer && i !== section.checkpoint.correctIndex && (
                        <XCircle className="w-4 h-4 text-danger ml-auto shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {checkpointRevealed && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${isCorrect ? 'bg-success/10' : 'bg-danger/10'}`}>
                {isCorrect
                  ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                }
                <p className="text-sm text-text-secondary">{section.checkpoint.explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        {isLastSection ? (
          <button
            onClick={handleFinish}
            disabled={!checkpointRevealed}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Finish Lesson <CheckCircle2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
