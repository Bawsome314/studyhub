import { useTheme } from '../contexts/ThemeContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Palette, User, Download, Upload, FileJson, BookOpen, Cloud, Copy, Check, HardDrive, GraduationCap, Plus, Pencil, Trash2, RotateCcw, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCourses } from '../hooks/useCourses';
import sampleGuide from '../data/sampleGuide.json';
import AuthSection from '../components/AuthSection';
import { putGuide, deleteGuide as deleteGuideIDB, getStorageEstimate } from '../lib/indexedDB';
import { updateGuideIndex, removeFromGuideIndex, readGuideIndex } from '../lib/guideIndex';

const TEMPLATE_JSON = `{
  "courseId": "COURSE_ID_HERE",
  "courseName": "Full Course Name",
  "courseCode": "CODE",
  "tools": ["finance"],
  "units": [
    {
      "id": "unit-1",
      "name": "Unit 1: Unit Name",
      "cards": [
        {
          "id": "c1-1",
          "term": "Term",
          "definition": "Detailed definition.",
          "question": "Scenario-based question testing this concept?",
          "choices": ["A", "B", "C", "D"],
          "correctIndex": 0,
          "explanation": "Why this answer is correct."
        }
      ],
      "matchPairs": [
        { "id": "m1-1", "term": "Term", "definition": "Short definition for match card" }
      ]
    }
  ],
  "extraQuestions": [
    { "id": "eq-1", "question": "Cross-unit question?", "choices": ["A","B","C","D"], "correctIndex": 0, "explanation": "Why." }
  ],
  "mockPool": [
    { "id": "mk-1", "question": "Hard OA-caliber scenario question?", "choices": ["A","B","C","D"], "correctIndex": 0, "explanation": "Why." }
  ],
  "trueFalsePool": [
    { "id": "tf-1", "statement": "A statement that is true or false.", "correct": true, "explanation": "Why this is true/false." }
  ],
  "fillInBlankPool": [
    { "id": "fb-1", "sentence": "The _____ is the process of recording transactions.", "answer": "journal entry", "distractors": ["ledger","trial balance","worksheet"] }
  ]
}`;

function buildClaudePrompt(courses) {
  const courseList = courses.map(c => `- ${c.code} ${c.name} (id: "${c.id}")`).join('\n');

  return `Generate a comprehensive study guide JSON for a WGU course. I'll tell you which course — pick one from this list or I'll specify:

${courseList}

**Output ONLY valid JSON** matching this exact schema:

${TEMPLATE_JSON}

**Schema details:**

**Per unit:**
- \`cards\`: Each card has a term, detailed definition, AND a built-in scenario question with 4 choices. Every card IS a question. Each unit should have enough cards to cover every key term, concept, model, framework, law, and theory in that unit. No concept that could appear on the OA should be left out. Some units will have 10 cards, some might have 25 — whatever it takes to be thorough.
- \`matchPairs\` (8-12 per unit): Term-definition pairs with SHORT definitions (max 40 chars) that fit match game tiles

**Course-level pools:**
- \`mockPool\` (100-120): **This is the most important pool.** Hardest OA-caliber questions — longer scenarios, closer distractors, multi-step reasoning. Should be big enough to take the Practice OA (40 questions) 2-3 times without significant overlap. This is the priority.
- \`extraQuestions\` (30-40): Cross-unit supplemental questions for Rapid Fire and drills
- \`trueFalsePool\` (20-30): Statements with \`correct\` boolean + \`explanation\`. Mix true and false ~50/50
- \`fillInBlankPool\` (20-30): Sentences with a blank (use _____ for the blank), \`answer\` (the correct term), and 3 \`distractors\`

**Optional top-level fields:**
- \`tools\`: An optional array declaring which floating toolbar tools the course needs. Valid values: \`"finance"\` (TVM calculator), \`"graph"\` (Desmos graphing calculator), \`"accounting"\` (T-account template). Include only the tools relevant to the course content.

**Requirements:**
- The guide should be comprehensive enough to pass the OA using no other study materials. If a concept could appear on the exam, it needs to be in here. Every definition should be detailed enough that someone could learn the concept from it alone without a textbook.
- courseId must match the "id" field from the list above (lowercase, e.g. "d196")
- IDs: units = "unit-1"..., cards = "c1-1"..., matchPairs = "m1-1"..., extraQuestions = "eq-1"..., mockPool = "mk-1"..., trueFalsePool = "tf-1"..., fillInBlankPool = "fb-1"...
- Distribute correctIndex evenly across 0-3 positions
- Target WGU OA exam difficulty level
- Make the mockPool deep enough for 2-3 unique Practice OA sessions

**Question quality:** Write realistic exam questions. Answer choices should look like they would on a real WGU proctored OA. Don't attach explanations or definitions to the correct answer that aren't also present on the wrong answers. The correct answer should not be identifiable by its format, length, or level of detail alone. Some questions will have short term-only choices, some will have longer descriptions — vary it naturally. Just make sure a test-taking student couldn't game the answers without knowing the material.

Which course should I generate?`;
}

export default function Settings() {
  const { theme, setTheme, themes } = useTheme();
  const [profile, setProfile] = useLocalStorage('studyhub-profile', {
    name: '',
    program: 'BS Finance',
    termStart: '',
    termEnd: '',
  });
  const [importStatus, setImportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [jsonPaste, setJsonPaste] = useState('');
  const fileInputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { courses, totalCUs, addCourse, updateCourse, removeCourse, resetToDefaults, isCustom } = useCourses();
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ code: '', name: '', cus: 3, type: 'OA', category: 'Business Core' });

  function handleExport() {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('studyhub-')) {
          data[key] = JSON.parse(localStorage.getItem(key));
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportStatus('Failed to export data. Storage may be unavailable.');
    }
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.entries(data).forEach(([key, value]) => {
          if (key.startsWith('studyhub-')) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
        setImportStatus('Data imported successfully. Reload the page to see changes.');
      } catch {
        setImportStatus('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  function handleStudyGuideImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportStatus('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const guide = JSON.parse(ev.target.result);
        if (!guide.courseId || !guide.units) {
          setImportStatus('Invalid study guide format. Needs courseId and units.');
          setImporting(false);
          return;
        }
        await putGuide(guide);
        updateGuideIndex(guide);
        setImportStatus(`Study guide for ${guide.courseId} imported successfully!`);
      } catch {
        setImportStatus('Invalid JSON file.');
      }
      setImporting(false);
    };
    reader.readAsText(file);
  }

  // Storage estimate
  const [storageEstimate, setStorageEstimate] = useState(null);
  useEffect(() => {
    getStorageEstimate().then(est => setStorageEstimate(est));
  }, [importStatus]);

  // Study guides loaded from lightweight index
  const loadedGuides = useMemo(() => {
    try {
      const index = readGuideIndex();
      return Object.entries(index).map(([courseId, meta]) => ({
        courseId,
        code: meta.courseCode || courseId,
        name: meta.courseName || courseId,
        units: meta.unitCount || 0,
        cards: meta.totalCards || 0,
      }));
    } catch { return []; }
  }, [importStatus]);

  async function deleteStudyGuide(courseId) {
    try {
      await deleteGuideIDB(courseId);
      removeFromGuideIndex(courseId);
      setImportStatus(`Deleted study guide for ${courseId}.`);
    } catch {
      setImportStatus('Failed to delete study guide.');
    }
  }

  function resetCourseProgress(courseId) {
    try {
      localStorage.removeItem(`studyhub-cards-${courseId}`);
      localStorage.removeItem(`studyhub-quiz-history-${courseId}`);
      localStorage.removeItem(`studyhub-missed-${courseId}`);
      setImportStatus(`Progress reset for ${courseId}.`);
    } catch {
      setImportStatus('Failed to reset progress. Storage may be unavailable.');
    }
  }

  function ThemeButton({ t }) {
    const isActive = theme === t.id;
    return (
      <button
        key={t.id}
        onClick={() => setTheme(t.id)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${
          isActive
            ? 'border-accent bg-accent-muted ring-1 ring-accent/30'
            : 'border-border hover:border-accent/30'
        }`}
      >
        {/* Preview swatch: bg + accent stripe */}
        <div className="w-6 h-6 rounded shrink-0 overflow-hidden ring-1 ring-black/10" style={{ backgroundColor: t.bg }}>
          <div className="w-full h-1.5 mt-auto" style={{ backgroundColor: t.accent, marginTop: '18px' }} />
        </div>
        <span className="text-[11px] font-medium text-text-primary leading-tight">{t.name}</span>
      </button>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      {/* ═══ Section 1 — Theme (full width) ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Theme</h2>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <div>
            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Light</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {themes.filter(t => t.row === 'light').map(t => <ThemeButton key={t.id} t={t} />)}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Dark</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {themes.filter(t => t.row === 'dark').map(t => <ThemeButton key={t.id} t={t} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Section 2 — Profile & Cloud Sync (side by side) ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
          </div>
          <div className="bg-bg-secondary rounded-xl border border-border p-4 space-y-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Name</label>
              <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Program</label>
              <input type="text" value={profile.program} onChange={e => setProfile(p => ({ ...p, program: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Term Start</label>
                <input type="date" value={profile.termStart} onChange={e => setProfile(p => ({ ...p, termStart: e.target.value }))}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Term End</label>
                <input type="date" value={profile.termEnd} onChange={e => setProfile(p => ({ ...p, termEnd: e.target.value }))}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cloud className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Cloud Sync</h2>
          </div>
          <AuthSection />
        </section>
      </div>

      {/* ═══ Section 3 — Courses (collapsible) ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Courses</h2>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setCoursesExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-hover transition-colors"
          >
            <span className="text-xs text-text-secondary">
              <span className="font-num font-semibold text-text-primary">{courses.length}</span> courses &middot; <span className="font-num font-semibold text-text-primary">{totalCUs}</span> CUs
              {isCustom && <span className="ml-2 text-[10px] text-accent">(customized)</span>}
            </span>
            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${coursesExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Expandable content */}
          {coursesExpanded && (
            <div className="px-5 pb-5 space-y-4 border-t border-border pt-4 accordion-enter">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setCourseForm({ code: '', name: '', cus: 3, type: 'OA', category: 'Business Core' });
                    setEditingCourse(null);
                    setCourseFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'reset-courses' })}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
                </button>
              </div>

              {/* Course list grouped by category */}
              {(() => {
                const categories = [...new Set(courses.map(c => c.category))];
                return categories.map(cat => (
                  <div key={cat}>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{cat}</p>
                    <div className="space-y-0.5">
                      {courses.filter(c => c.category === cat).map(c => (
                        <div key={c.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover">
                          <span className="text-xs font-mono text-accent w-10 shrink-0">{c.code}</span>
                          <span className="text-xs text-text-primary flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-text-muted font-num shrink-0">{c.cus} CU</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                            c.type === 'OA' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                          }`}>{c.type}</span>
                          <button
                            onClick={() => {
                              setCourseForm({ code: c.code, name: c.name, cus: c.cus, type: c.type, category: c.category });
                              setEditingCourse(c.id);
                              setCourseFormOpen(true);
                            }}
                            className="p-1 text-text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'delete-course', id: c.id, code: c.code })}
                            className="p-1 text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </section>

      {/* ═══ Section 4 — Study Guide Import (full width) ═══ */}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Study Guide Import</h2>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <p className="text-[11px] text-text-muted">Generate a study guide with Claude, upload a JSON file, or load the built-in sample.</p>

          {/* Action buttons row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const prompt = buildClaudePrompt(courses);
                navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Claude Prompt'}
            </button>
            <label className="flex items-center gap-2 px-3 py-2 bg-accent-muted border border-accent/30 rounded-lg text-xs text-accent hover:bg-accent/20 transition-colors cursor-pointer">
              <FileJson className="w-3.5 h-3.5" /> Upload JSON
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleStudyGuideImport} className="hidden" />
            </label>
            <button
              disabled={importing}
              onClick={async () => {
                setImporting(true);
                setImportStatus('');
                try {
                  await putGuide(sampleGuide);
                  updateGuideIndex(sampleGuide);
                  setImportStatus(`Sample guide loaded for ${sampleGuide.courseCode}!`);
                } catch {
                  setImportStatus('Failed to load sample guide. Storage may be unavailable.');
                }
                setImporting(false);
              }}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40"
            >
              <BookOpen className="w-3.5 h-3.5" /> Load Sample
            </button>
          </div>

          {/* Paste JSON */}
          <div>
            <p className="text-[11px] text-text-muted mb-1">Or paste JSON directly:</p>
            <textarea value={jsonPaste} onChange={e => setJsonPaste(e.target.value)}
              placeholder='{"courseId": "d196", "units": [...]}'
              rows={3}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-y" />
            <button
              onClick={async () => {
                setImporting(true);
                setImportStatus('');
                try {
                  const guide = JSON.parse(jsonPaste);
                  if (!guide.courseId || !guide.units) { setImportStatus('Invalid format.'); setImporting(false); return; }
                  await putGuide(guide);
                  updateGuideIndex(guide);
                  setImportStatus(`Study guide for ${guide.courseId} imported!`);
                  setJsonPaste('');
                } catch { setImportStatus('Invalid JSON.'); }
                setImporting(false);
              }}
              disabled={!jsonPaste.trim() || importing}
              className="mt-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Import
            </button>
          </div>

          {/* Loading / status */}
          {importing && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Importing study guide — this may take a moment for large files...
            </div>
          )}
          {!importing && importStatus && <p className="text-xs text-success">{importStatus}</p>}
        </div>
      </section>

      {/* ═══ Section 5 — Data Management (full width) ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileJson className="w-4 h-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">Data Management</h2>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-primary hover:bg-bg-hover transition-colors">
              <Download className="w-3.5 h-3.5" /> Export All Data
            </button>
            <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-primary hover:bg-bg-hover transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Import Data
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          {/* Storage estimate */}
          {storageEstimate && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <HardDrive className="w-3.5 h-3.5" />
              <span>
                Storage: {(storageEstimate.usage / (1024 * 1024)).toFixed(1)} MB used of {(storageEstimate.quota / (1024 * 1024)).toFixed(0)} MB
              </span>
            </div>
          )}

          {/* Loaded study guides */}
          {loadedGuides.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Loaded Study Guides</p>
              <div className="space-y-1">
                {loadedGuides.map(g => (
                  <div key={g.courseId} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover">
                    <span className="text-xs text-text-primary flex-1 truncate">{g.code} — {g.units} units, {g.cards} cards</span>
                    <button onClick={() => setConfirmAction({ type: 'reset-progress', id: g.courseId })} className="text-[10px] text-text-muted hover:text-warning transition-colors shrink-0">Reset Progress</button>
                    <button onClick={() => setConfirmAction({ type: 'delete-guide', id: g.courseId })} className="text-[10px] text-text-muted hover:text-danger transition-colors shrink-0">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Course add/edit modal */}
      {courseFormOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={() => { setCourseFormOpen(false); setEditingCourse(null); }}>
          <div className="bg-bg-secondary rounded-2xl border border-border p-5 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{editingCourse ? 'Edit Course' : 'Add Course'}</h3>
              <button onClick={() => { setCourseFormOpen(false); setEditingCourse(null); }} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Code</label>
                <input type="text" value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="C214"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1">CUs</label>
                <input type="number" min="1" max="12" value={courseForm.cus} onChange={e => setCourseForm(f => ({ ...f, cus: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary font-num focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Name</label>
              <input type="text" value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="Financial Accounting"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Type</label>
                <select value={courseForm.type} onChange={e => setCourseForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="OA">OA (Objective Assessment)</option>
                  <option value="PA">PA (Performance Assessment)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Category</label>
                <select value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option>General Education</option>
                  <option>Business Core</option>
                  <option>Finance Major</option>
                  <option>Capstone</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => { setCourseFormOpen(false); setEditingCourse(null); }}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!courseForm.code.trim() || !courseForm.name.trim()) return;
                  if (editingCourse) {
                    updateCourse(editingCourse, courseForm);
                  } else {
                    addCourse(courseForm);
                  }
                  setCourseFormOpen(false);
                  setEditingCourse(null);
                }}
                disabled={!courseForm.code.trim() || !courseForm.name.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingCourse ? 'Save Changes' : 'Add Course'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={confirmAction?.type === 'delete-guide'}
        title="Delete study guide?"
        message="This will permanently remove the study guide and all its content. This can't be undone."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { deleteStudyGuide(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'reset-progress'}
        title="Reset course progress?"
        message="This will clear all card ratings, quiz history, and missed questions for this course."
        confirmLabel="Reset"
        confirmColor="bg-warning"
        onConfirm={() => { resetCourseProgress(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'delete-course'}
        title={`Delete ${confirmAction?.code || 'course'}?`}
        message="This will remove the course from your list. Any saved progress, notes, and links for this course will be kept in case you re-add it later."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { removeCourse(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'reset-courses'}
        title="Reset to default courses?"
        message="This will remove any custom courses you added and restore the original WGU Finance course list. Saved progress data will not be deleted."
        confirmLabel="Reset"
        confirmColor="bg-warning"
        onConfirm={() => { resetToDefaults(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
