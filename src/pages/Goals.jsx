import { useState, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCourses } from '../hooks/useCourses';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  Trophy,
} from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function Goals() {
  const [goals, setGoals] = useLocalStorage('studyhub-goals', []);
  const { courses } = useCourses();
  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState(todayKey);
  const [courseId, setCourseId] = useState('');

  // Group goals by date
  const goalsByDate = useMemo(() => {
    const map = {};
    for (const g of goals) {
      if (!map[g.targetDate]) map[g.targetDate] = [];
      map[g.targetDate].push(g);
    }
    return map;
  }, [goals]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // Monday = 0

    const days = [];
    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      days.push({ date: d, key: toDateKey(d), inMonth: false });
    }
    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(viewYear, viewMonth, i);
      days.push({ date: d, key: toDateKey(d), inMonth: true });
    }
    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(viewYear, viewMonth + 1, i);
        days.push({ date: d, key: toDateKey(d), inMonth: false });
      }
    }
    return days;
  }, [viewYear, viewMonth]);

  const selectedGoals = goalsByDate[selectedDate] || [];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function openAddForm(date) {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setTargetDate(date || selectedDate);
    setCourseId('');
    setShowForm(true);
  }

  function openEditForm(goal) {
    setEditingId(goal.id);
    setTitle(goal.title);
    setDescription(goal.description || '');
    setTargetDate(goal.targetDate);
    setCourseId(goal.courseId || '');
    setShowForm(true);
  }

  function saveGoal() {
    if (!title.trim()) return;
    if (editingId) {
      setGoals(prev => prev.map(g => g.id === editingId
        ? { ...g, title: title.trim(), description: description.trim(), targetDate, courseId: courseId || null }
        : g
      ));
    } else {
      setGoals(prev => [...prev, {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        targetDate,
        courseId: courseId || null,
        completed: false,
        createdAt: Date.now(),
      }]);
    }
    setShowForm(false);
    setSelectedDate(targetDate);
  }

  function toggleComplete(id) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  }

  function deleteGoal(id) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function getCourseName(id) {
    const c = courses.find(c => c.id === id);
    return c ? `${c.code} ${c.name}` : null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Goals</h1>
        <p className="text-sm text-text-secondary mt-1">Set targets and track what you need to get done.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar */}
        <div className="bg-bg-secondary rounded-xl border border-border p-4 lg:p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-text-primary">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-text-muted uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ key, date, inMonth }) => {
              const dayGoals = goalsByDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              const hasIncomplete = dayGoals.some(g => !g.completed);
              const hasComplete = dayGoals.some(g => g.completed);
              const isPast = key < todayKey;
              const hasOverdue = isPast && hasIncomplete;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`relative p-1 min-h-[48px] lg:min-h-[72px] flex flex-col items-center rounded-lg transition-colors ${
                    isSelected ? 'bg-accent/15 ring-1 ring-accent' :
                    isToday ? 'bg-accent/5' :
                    'hover:bg-bg-hover'
                  } ${!inMonth ? 'opacity-30' : ''}`}
                >
                  <span className={`text-xs font-num ${
                    isToday ? 'font-bold text-accent' :
                    inMonth ? 'text-text-primary' : 'text-text-muted'
                  }`}>
                    {date.getDate()}
                  </span>
                  {dayGoals.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
                      {hasIncomplete && !hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      {hasComplete && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {formatDisplayDate(selectedDate)}
            </h3>
            <button
              onClick={() => openAddForm(selectedDate)}
              className="flex items-center gap-1 px-2.5 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Goal
            </button>
          </div>

          {selectedGoals.length === 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border p-6 text-center">
              <CalendarDays className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
              <p className="text-xs text-text-muted">No goals for this day.</p>
            </div>
          )}

          {selectedGoals.map(goal => {
            const isPast = goal.targetDate < todayKey;
            const isOverdue = isPast && !goal.completed;
            const linkedCourse = goal.courseId ? getCourseName(goal.courseId) : null;
            return (
              <div
                key={goal.id}
                className={`bg-bg-secondary rounded-xl border p-3 transition-colors ${
                  isOverdue ? 'border-danger/40' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleComplete(goal.id)}
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      goal.completed
                        ? 'bg-success border-success text-white'
                        : isOverdue
                          ? 'border-danger/50 hover:border-danger'
                          : 'border-border hover:border-accent'
                    }`}
                  >
                    {goal.completed && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      goal.completed ? 'line-through text-text-muted' : isOverdue ? 'text-danger' : 'text-text-primary'
                    }`}>
                      {goal.title}
                    </p>
                    {goal.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{goal.description}</p>
                    )}
                    {linkedCourse && (
                      <p className="text-[10px] text-accent mt-0.5">{linkedCourse}</p>
                    )}
                    {isOverdue && (
                      <p className="text-[10px] text-danger font-medium mt-0.5">Overdue</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditForm(goal)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmAction({ type: 'delete-goal', id: goal.id })} className="p-1 text-text-muted hover:text-danger transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Goals */}
      <UpcomingGoals goals={goals} todayKey={todayKey} getCourseName={getCourseName} toggleComplete={toggleComplete} openEditForm={openEditForm} requestDelete={id => setConfirmAction({ type: 'delete-goal', id })} />

      {/* Completed Goals */}
      <CompletedGoals goals={goals} getCourseName={getCourseName} toggleComplete={toggleComplete} requestDelete={id => setConfirmAction({ type: 'delete-goal', id })} />

      <ConfirmDialog
        open={!!confirmAction}
        title="Delete goal?"
        message="This can't be undone."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { deleteGoal(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-bg-secondary rounded-2xl border border-border p-5 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{editingId ? 'Edit Goal' : 'New Goal'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Pass C214 OA"
                autoFocus
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional details..."
                rows={2}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Target Date *</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent font-num"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Link to Course</label>
                <select
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
                Cancel
              </button>
              <button
                onClick={saveGoal}
                disabled={!title.trim()}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingId ? 'Save Changes' : 'Add Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UpcomingGoals({ goals, todayKey, getCourseName, toggleComplete, openEditForm, requestDelete }) {
  const upcoming = useMemo(() =>
    goals
      .filter(g => !g.completed && g.targetDate >= todayKey)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .slice(0, 10),
    [goals, todayKey]
  );

  const overdue = useMemo(() =>
    goals
      .filter(g => !g.completed && g.targetDate < todayKey)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
    [goals, todayKey]
  );

  if (upcoming.length === 0 && overdue.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Upcoming Goals</h2>
      </div>
      <div className="bg-bg-secondary rounded-xl border border-border divide-y divide-border overflow-hidden">
        {overdue.map(goal => {
          const linkedCourse = goal.courseId ? getCourseName(goal.courseId) : null;
          return (
            <div key={goal.id} className="flex items-center gap-3 px-4 py-2.5 group">
              <button
                onClick={() => toggleComplete(goal.id)}
                className="shrink-0 w-5 h-5 rounded border-2 border-danger/50 hover:border-danger flex items-center justify-center transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-danger truncate">{goal.title}</p>
                {goal.description && <p className="text-xs text-text-muted truncate">{goal.description}</p>}
              </div>
              {linkedCourse && <span className="text-[10px] text-accent shrink-0">{linkedCourse}</span>}
              <span className="text-[10px] font-num text-danger shrink-0">Overdue</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEditForm(goal)} className="p-1 text-text-muted hover:text-text-primary"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => requestDelete(goal.id)} className="p-1 text-text-muted hover:text-danger"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
        {upcoming.map(goal => {
          const linkedCourse = goal.courseId ? getCourseName(goal.courseId) : null;
          const d = parseDate(goal.targetDate);
          const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <div key={goal.id} className="flex items-center gap-3 px-4 py-2.5 group">
              <button
                onClick={() => toggleComplete(goal.id)}
                className="shrink-0 w-5 h-5 rounded border-2 border-border hover:border-accent flex items-center justify-center transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{goal.title}</p>
                {goal.description && <p className="text-xs text-text-muted truncate">{goal.description}</p>}
              </div>
              {linkedCourse && <span className="text-[10px] text-accent shrink-0">{linkedCourse}</span>}
              <span className="text-[10px] font-num text-text-muted shrink-0">{dateLabel}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEditForm(goal)} className="p-1 text-text-muted hover:text-text-primary"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => requestDelete(goal.id)} className="p-1 text-text-muted hover:text-danger"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletedGoals({ goals, getCourseName, toggleComplete, requestDelete }) {
  const [expanded, setExpanded] = useState(false);

  const completed = useMemo(() =>
    goals
      .filter(g => g.completed)
      .sort((a, b) => b.targetDate.localeCompare(a.targetDate))
      .slice(0, 20),
    [goals]
  );

  if (completed.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 group"
      >
        <Trophy className="w-4 h-4 text-success" />
        <h2 className="text-sm font-semibold text-text-primary">Completed</h2>
        <span className="text-xs text-text-muted font-num">({completed.length})</span>
        <ChevronRight className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="bg-bg-secondary rounded-xl border border-border divide-y divide-border overflow-hidden">
          {completed.map(goal => {
            const linkedCourse = goal.courseId ? getCourseName(goal.courseId) : null;
            const d = parseDate(goal.targetDate);
            const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={goal.id} className="flex items-center gap-3 px-4 py-2.5 group">
                <button
                  onClick={() => toggleComplete(goal.id)}
                  className="shrink-0 w-5 h-5 rounded border-2 bg-success border-success text-white flex items-center justify-center transition-colors"
                >
                  <Check className="w-3 h-3" />
                </button>
                <p className="text-sm text-text-muted line-through flex-1 min-w-0 truncate">{goal.title}</p>
                {linkedCourse && <span className="text-[10px] text-accent shrink-0">{linkedCourse}</span>}
                <span className="text-[10px] font-num text-text-muted shrink-0">{dateLabel}</span>
                <button onClick={() => requestDelete(goal.id)} className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDisplayDate(key) {
  const d = parseDate(key);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
