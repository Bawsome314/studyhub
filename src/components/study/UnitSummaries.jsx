import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useCardProgress } from '../../hooks/useStudyGuide';

export default function UnitSummaries({ courseId, guide, onExit }) {
  const { progress } = useCardProgress(courseId);
  const [openUnit, setOpenUnit] = useState(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs text-text-muted">{guide.units.length} units, {guide.units.reduce((s, u) => s + u.cards.length, 0)} cards</span>
      </div>

      {/* Units */}
      <div className="space-y-2">
        {guide.units.map((unit, idx) => {
          const isOpen = openUnit === idx;
          const mastered = unit.cards.filter(c => progress[c.id]?.rating === 'got-it').length;
          const shaky = unit.cards.filter(c => progress[c.id]?.rating === 'shaky').length;
          const weak = unit.cards.filter(c => progress[c.id]?.rating === 'dont-know').length;
          const unseen = unit.cards.length - mastered - shaky - weak;

          return (
            <div key={idx} className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setOpenUnit(isOpen ? null : idx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover transition-colors"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{unit.name}</p>
                  <div className="flex items-center gap-3 text-[10px] mt-0.5">
                    <span className="text-text-muted">{unit.cards.length} cards</span>
                    {mastered > 0 && <span className="text-success">{mastered} mastered</span>}
                    {shaky > 0 && <span className="text-warning">{shaky} shaky</span>}
                    {weak > 0 && <span className="text-danger">{weak} weak</span>}
                    {unseen > 0 && <span className="text-text-muted">{unseen} new</span>}
                  </div>
                </div>
                <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: unit.cards.length > 0 ? `${(mastered / unit.cards.length) * 100}%` : '0%' }}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border/50">
                  {unit.cards.map(card => {
                    const p = progress[card.id];
                    const badge = p?.rating === 'got-it' ? 'bg-success/15 text-success' :
                                  p?.rating === 'shaky' ? 'bg-warning/15 text-warning' :
                                  p?.rating === 'dont-know' ? 'bg-danger/15 text-danger' : null;
                    return (
                      <div key={card.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-text-primary">{card.term}</p>
                          {badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badge}`}>
                              {p.rating === 'got-it' ? 'Got it' : p.rating === 'shaky' ? 'Shaky' : 'Weak'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{card.definition}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
