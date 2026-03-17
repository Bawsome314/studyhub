import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Global',
    shortcuts: [
      { key: '/', desc: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Flashcards',
    shortcuts: [
      { key: 'Space', desc: 'Flip card' },
      { key: '\u2190 / \u2192', desc: 'Previous / Next card' },
      { key: '1', desc: "Don\u2019t know" },
      { key: '2', desc: 'Shaky' },
      { key: '3', desc: 'Got it' },
    ],
  },
  {
    title: 'Quiz / Practice OA',
    shortcuts: [
      { key: '1\u20134', desc: 'Select answer' },
      { key: 'Enter', desc: 'Next question' },
    ],
  },
  {
    title: 'Rapid Fire',
    shortcuts: [
      { key: '1\u20134', desc: 'Select answer' },
    ],
  },
  {
    title: 'True / False',
    shortcuts: [
      { key: 'T', desc: 'True' },
      { key: 'F', desc: 'False' },
      { key: 'Enter', desc: 'Next question' },
    ],
  },
  {
    title: 'Triple Threat',
    shortcuts: [
      { key: '1\u20133', desc: 'Select answer' },
      { key: 'Enter', desc: 'Next question' },
    ],
  },
];

export default function KeyboardShortcuts({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === '?' || e.key === '/') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-bg-secondary rounded-2xl border border-border p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-text-secondary">{s.desc}</span>
                    <kbd className="shrink-0 inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-bg-primary border border-border text-[11px] font-num font-medium text-text-primary">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
