import { useTheme } from '../contexts/ThemeContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Palette, User, Download, Upload, FileJson, BookOpen, Cloud, Copy, Check, HardDrive, GraduationCap, Plus, Pencil, Trash2, X, ChevronDown, Search, Users, Loader2, Share2 } from 'lucide-react';
import { getGuide } from '../lib/indexedDB';
import { checkCommunityGuide } from '../lib/communityGuides';
import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { useCourses, WGU_FINANCE_COURSES } from '../hooks/useCourses';
import AuthSection from '../components/AuthSection';
import { putGuide, deleteGuide as deleteGuideIDB, getStorageEstimate } from '../lib/indexedDB';
import { updateGuideIndex, removeFromGuideIndex, readGuideIndex } from '../lib/guideIndex';
import buildClaudePrompt from '../lib/buildClaudePrompt';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { shareCommunityGuide, fetchAllCommunityGuides, fetchCommunityGuide } from '../lib/communityGuides';

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
  const { courses, totalCUs, addCourse, updateCourse, removeCourse, loadPreset, clearAll } = useCourses();
  const [coursesExpanded, setCoursesExpanded] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ code: '', name: '', cus: 3, type: 'OA', category: 'Business Core' });
  const [shareOnImport, setShareOnImport] = useState(false);
  const { user } = useAuth();
  const canShare = isSupabaseConfigured() && !!user;

  // Study guides loaded from lightweight index (needed early for community check + course icons)
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

  const guideLoadedSet = useMemo(() => new Set(loadedGuides.map(g => g.courseId)), [loadedGuides]);

  // Community guides: auto-find available guides for user's courses
  const [communityAvailable, setCommunityAvailable] = useState([]);
  const [communityChecked, setCommunityChecked] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communitySearchResults, setCommunitySearchResults] = useState([]);
  const [communitySearching, setCommunitySearching] = useState(false);

  // Auto-check on mount: which of user's courses have community guides but no local guide
  useEffect(() => {
    if (!isSupabaseConfigured() || courses.length === 0 || communityChecked) return;
    const missingCodes = courses
      .filter(c => !guideLoadedSet.has(c.id))
      .map(c => c.code.toUpperCase());
    if (missingCodes.length === 0) { setCommunityChecked(true); return; }
    fetchAllCommunityGuides().then(all => {
      const missingSet = new Set(missingCodes);
      setCommunityAvailable(all.filter(g => missingSet.has(g.course_code)));
      setCommunityChecked(true);
    }).catch(() => setCommunityChecked(true));
  }, [courses, guideLoadedSet, communityChecked]);

  // Search community guides
  useEffect(() => {
    if (!communitySearch.trim() || !isSupabaseConfigured()) {
      setCommunitySearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      setCommunitySearching(true);
      fetchAllCommunityGuides().then(all => {
        const q = communitySearch.toLowerCase();
        setCommunitySearchResults(all.filter(g =>
          g.course_code.toLowerCase().includes(q) || g.course_name.toLowerCase().includes(q)
        ));
        setCommunitySearching(false);
      }).catch(() => setCommunitySearching(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [communitySearch]);

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
        if (shareOnImport && canShare) {
          const existing = await checkCommunityGuide(guide.courseCode || guide.courseId);
          if (existing) {
            setImportStatus(`Study guide imported! A community guide for ${guide.courseCode || guide.courseId} already exists (by ${existing.uploader_name}). Use Data Management to share/replace.`);
          } else {
            const { error: shareErr } = await shareCommunityGuide(guide, user.id, profile.name || 'Anonymous');
            setImportStatus(shareErr
              ? `Guide imported but sharing failed: ${shareErr}`
              : `Study guide for ${guide.courseId} imported and shared with community!`);
          }
        } else {
          setImportStatus(`Study guide for ${guide.courseId} imported successfully!`);
        }
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {themes.filter(t => t.row === 'light').map(t => <ThemeButton key={t.id} t={t} />)}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider">Dark</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="text-xs text-text-muted block mb-1">Program CUs</label>
                <input type="number" min="1" max="999" value={profile.programCUs || ''} onChange={e => setProfile(p => ({ ...p, programCUs: parseInt(e.target.value) || '' }))}
                  placeholder={String(totalCUs)}
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-num placeholder:text-text-muted focus:outline-none focus:border-accent" />
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
              {courses.length > 0
                ? <><span className="font-num font-semibold text-text-primary">{courses.length}</span> courses &middot; <span className="font-num font-semibold text-text-primary">{totalCUs}</span> CUs</>
                : 'No courses added yet'
              }
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
                  onClick={() => loadPreset(WGU_FINANCE_COURSES)}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Load WGU BS Finance
                </button>
                {courses.length > 0 && (
                  <button
                    onClick={() => setConfirmAction({ type: 'clear-courses' })}
                    className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-muted hover:text-danger hover:border-danger/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              {/* Course search */}
              {courses.length > 6 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Filter courses..."
                    value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)}
                    className="w-full bg-bg-tertiary border border-border rounded-lg pl-8 pr-3 py-1.5 text-[16px] sm:text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Course list grouped by category */}
              {(() => {
                const q = courseSearch.toLowerCase().trim();
                const filtered = q
                  ? courses.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
                  : courses;
                const categories = [...new Set(filtered.map(c => c.category))];
                return categories.map(cat => (
                  <div key={cat}>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{cat}</p>
                    <div className="space-y-0.5">
                      {filtered.filter(c => c.category === cat).map(c => (
                        <div key={c.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover">
                          <span className="text-xs font-mono text-accent w-10 shrink-0">{c.code}</span>
                          {guideLoadedSet.has(c.id)
                            ? <BookOpen className="w-3 h-3 text-success shrink-0" title="Study guide loaded" />
                            : <BookOpen className="w-3 h-3 text-text-muted/20 shrink-0" title="No study guide" />
                          }
                          <span className="text-xs text-text-primary flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-text-muted font-num shrink-0">{c.cus} CU</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                            c.type === 'OA' ? 'bg-blue-500/10 text-blue-400' : c.type === 'Capstone' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'
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
          <p className="text-[11px] text-text-muted">Generate a study guide with Claude or upload a JSON file.</p>

          {/* Action buttons row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const prompt = buildClaudePrompt();
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
          </div>

          {/* Share toggle */}
          {isSupabaseConfigured() && (
            <label className={`flex items-center gap-2 text-xs ${canShare ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
              <input
                type="checkbox"
                checked={shareOnImport}
                onChange={e => canShare && setShareOnImport(e.target.checked)}
                disabled={!canShare}
                className="rounded border-border accent-accent"
              />
              <span className="text-text-secondary">Share with community</span>
              {!canShare && <span className="text-text-muted">(sign in to share)</span>}
            </label>
          )}

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
                  if (shareOnImport && canShare) {
                    const existing = await checkCommunityGuide(guide.courseCode || guide.courseId);
                    if (existing) {
                      setImportStatus(`Guide imported! A community guide for ${guide.courseCode || guide.courseId} already exists (by ${existing.uploader_name}). Use Data Management to share/replace.`);
                    } else {
                      const { error: shareErr } = await shareCommunityGuide(guide, user.id, profile.name || 'Anonymous');
                      setImportStatus(shareErr
                        ? `Guide imported but sharing failed: ${shareErr}`
                        : `Study guide for ${guide.courseId} imported and shared!`);
                    }
                  } else {
                    setImportStatus(`Study guide for ${guide.courseId} imported!`);
                  }
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

      {/* ═══ Section 5 — Community Guides ═══ */}
      {isSupabaseConfigured() && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Community Guides</h2>
          </div>
          <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
            {/* Available for your courses */}
            {communityAvailable.length > 0 && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Available for your courses</p>
                <div className="space-y-1.5">
                  {communityAvailable.map(g => (
                    <CommunityGuideRow key={g.course_code} g={g} importing={importing} onLoad={async () => {
                      setImporting(true);
                      setImportStatus('');
                      try {
                        const full = await fetchCommunityGuide(g.course_code);
                        if (full?.guide_json) {
                          await putGuide(full.guide_json);
                          updateGuideIndex(full.guide_json);
                          setCommunityAvailable(prev => prev.filter(x => x.course_code !== g.course_code));
                          setImportStatus(`Loaded ${g.course_code} from community!`);
                        }
                      } catch { setImportStatus('Failed to load community guide.'); }
                      setImporting(false);
                    }} />
                  ))}
                </div>
              </div>
            )}
            {communityChecked && communityAvailable.length === 0 && !communitySearch.trim() && (
              <p className="text-xs text-text-muted">No community guides available for your courses right now.</p>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search all community guides..."
                value={communitySearch}
                onChange={e => setCommunitySearch(e.target.value)}
                className="w-full bg-bg-tertiary border border-border rounded-lg pl-8 pr-3 py-2 text-[16px] sm:text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            {/* Search results */}
            {communitySearching && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
              </div>
            )}
            {communitySearch.trim() && !communitySearching && communitySearchResults.length === 0 && (
              <p className="text-xs text-text-muted text-center py-2">No community guides found for "{communitySearch}"</p>
            )}
            {communitySearchResults.length > 0 && (
              <div className="space-y-1.5">
                {communitySearchResults.map(g => (
                  <CommunityGuideRow key={g.course_code} g={g} importing={importing} onLoad={async () => {
                    setImporting(true);
                    setImportStatus('');
                    try {
                      const full = await fetchCommunityGuide(g.course_code);
                      if (full?.guide_json) {
                        await putGuide(full.guide_json);
                        updateGuideIndex(full.guide_json);
                        setImportStatus(`Loaded ${g.course_code} from community!`);
                      }
                    } catch { setImportStatus('Failed to load community guide.'); }
                    setImporting(false);
                  }} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ Section 6 — Data Management (full width) ═══ */}
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
                    {canShare && (
                      <button
                        onClick={async () => {
                          // Check if already shared
                          const existing = await checkCommunityGuide(g.code);
                          if (existing) {
                            setConfirmAction({ type: 'share-guide', courseId: g.courseId, code: g.code, existingUploader: existing.uploader_name });
                          } else {
                            setConfirmAction({ type: 'share-guide', courseId: g.courseId, code: g.code, existingUploader: null });
                          }
                        }}
                        className="text-[10px] text-text-muted hover:text-accent transition-colors shrink-0 flex items-center gap-1"
                      >
                        <Share2 className="w-2.5 h-2.5" /> Share
                      </button>
                    )}
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
                  <option value="Capstone">Capstone</option>
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
                  const finalForm = courseForm.type === 'Capstone'
                    ? { ...courseForm, category: 'Capstone' }
                    : courseForm;
                  if (editingCourse) {
                    updateCourse(editingCourse, finalForm);
                  } else {
                    addCourse(finalForm);
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
        open={confirmAction?.type === 'clear-courses'}
        title="Clear all courses?"
        message="This will remove all courses from your list. Saved progress, notes, and study guides will not be deleted."
        confirmLabel="Clear All"
        confirmColor="bg-danger"
        onConfirm={() => { clearAll(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction?.type === 'share-guide'}
        title={confirmAction?.existingUploader
          ? `Replace community guide for ${confirmAction?.code}?`
          : `Share ${confirmAction?.code} with the community?`
        }
        message={confirmAction?.existingUploader
          ? `A community guide for ${confirmAction?.code} already exists (shared by ${confirmAction?.existingUploader}). Sharing yours will replace it.`
          : 'Other students will be able to browse and load this guide. Your study progress stays private.'
        }
        confirmLabel={confirmAction?.existingUploader ? 'Replace' : 'Share'}
        confirmColor="bg-accent"
        onConfirm={async () => {
          const action = confirmAction;
          setConfirmAction(null);
          setImporting(true);
          setImportStatus('');
          try {
            const guide = await getGuide(action.courseId);
            if (!guide) { setImportStatus('Guide not found.'); setImporting(false); return; }
            const { error: shareErr } = await shareCommunityGuide(guide, user.id, profile.name || 'Anonymous');
            setImportStatus(shareErr
              ? `Sharing failed: ${shareErr}`
              : `${action.code} shared with the community!`);
          } catch {
            setImportStatus('Failed to share guide.');
          }
          setImporting(false);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function CommunityGuideRow({ g, importing, onLoad }) {
  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-hover">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent font-semibold">{g.course_code}</span>
          <span className="text-xs text-text-primary truncate">{g.course_name}</span>
        </div>
        <p className="text-[10px] text-text-muted">
          {g.card_count} cards · {g.unit_count} units · by {g.uploader_name}
        </p>
      </div>
      <button
        onClick={onLoad}
        disabled={importing}
        className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-[10px] font-medium rounded-lg transition-colors shrink-0"
      >
        Load
      </button>
    </div>
  );
}
