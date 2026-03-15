import { useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import ConfirmDialog from '../ConfirmDialog';
import {
  Plus,
  Trash2,
  X,
  GripVertical,
  Circle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';

const STATUSES = [
  { id: 'to-do', label: 'To Do', icon: Circle, color: 'text-text-muted/50', bg: 'bg-bg-tertiary' },
  { id: 'working', label: 'Working', icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
];

const STATUS_CYCLE = ['to-do', 'working', 'done'];

function getStatus(id) {
  return STATUSES.find(s => s.id === id) || STATUSES[0];
}

export default function TaskChecklist({ courseId }) {
  const [sections, setSections] = useLocalStorage(`studyhub-tasks-${courseId}`, []);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  // --- Section CRUD ---
  function addSection(e) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setSections(prev => [
      ...prev,
      { id: Date.now(), name: newSectionName.trim(), tasks: [] },
    ]);
    setNewSectionName('');
    setShowAddSection(false);
  }

  function deleteSection(sectionId) {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }

  function renameSection(sectionId, name) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name } : s));
  }

  // --- Task CRUD ---
  function addTask(sectionId, e) {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        tasks: [...s.tasks, { id: Date.now(), text: newTaskText.trim(), status: 'to-do' }],
      };
    }));
    setNewTaskText('');
    setAddingTaskTo(null);
  }

  function deleteTask(sectionId, taskId) {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) };
    }));
  }

  function cycleTaskStatus(sectionId, taskId) {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        tasks: s.tasks.map(t => {
          if (t.id !== taskId) return t;
          const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(t.status) + 1) % STATUS_CYCLE.length];
          return { ...t, status: next };
        }),
      };
    }));
  }

  function toggleCollapse(sectionId) {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  // --- Stats ---
  const allTasks = sections.flatMap(s => s.tasks);
  const doneCount = allTasks.filter(t => t.status === 'done').length;
  const workingCount = allTasks.filter(t => t.status === 'working').length;
  const totalCount = allTasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {totalCount > 0 ? (
            <>
              <span className="text-text-muted">
                <span className="font-num text-text-primary font-semibold">{doneCount}</span>/{totalCount} done
              </span>
              {workingCount > 0 && (
                <span className="text-warning font-num">{workingCount} in progress</span>
              )}
            </>
          ) : (
            <span className="text-text-muted">No tasks yet</span>
          )}
        </div>
        <button
          onClick={() => setShowAddSection(!showAddSection)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
        >
          {showAddSection ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showAddSection ? 'Cancel' : 'Add Section'}
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1 font-num">{pct}% complete</p>
        </div>
      )}

      {/* Add section form */}
      {showAddSection && (
        <form onSubmit={addSection} className="flex gap-2">
          <input
            type="text"
            placeholder="Section name (e.g., Task 1: Company Overview)"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newSectionName.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </form>
      )}

      {/* Empty state */}
      {sections.length === 0 && !showAddSection && (
        <div className="text-center py-8">
          <ClipboardCheck className="w-8 h-8 text-text-muted/50 mx-auto mb-2" />
          <p className="text-xs text-text-muted">
            Add rubric sections and task items to track your PA progress.
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            Click status icons to cycle: To Do &rarr; Working &rarr; Done
          </p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {sections.map(section => {
          const isCollapsed = collapsed[section.id];
          const sectionDone = section.tasks.filter(t => t.status === 'done').length;
          const sectionTotal = section.tasks.length;
          const sectionPct = sectionTotal > 0 ? Math.round((sectionDone / sectionTotal) * 100) : 0;
          const allDone = sectionTotal > 0 && sectionDone === sectionTotal;

          return (
            <div key={section.id} className="bg-bg-tertiary rounded-lg border border-border overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-bg-hover transition-colors">
                <button
                  onClick={() => toggleCollapse(section.id)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {allDone && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}

                <input
                  type="text"
                  value={section.name}
                  onChange={e => renameSection(section.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm font-semibold text-text-primary focus:outline-none"
                />

                {sectionTotal > 0 && (
                  <span className="text-[10px] font-num text-text-muted shrink-0">
                    {sectionDone}/{sectionTotal}
                  </span>
                )}

                <button
                  onClick={() => {
                    setAddingTaskTo(addingTaskTo === section.id ? null : section.id);
                    setNewTaskText('');
                  }}
                  className="p-1 text-text-muted hover:text-accent transition-colors shrink-0"
                  title="Add task"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setConfirmAction({ type: 'delete-section', id: section.id })}
                  className="p-1 text-text-muted hover:text-danger transition-colors shrink-0"
                  title="Delete section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Section progress bar */}
              {!isCollapsed && sectionTotal > 0 && (
                <div className="px-3 pb-1">
                  <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all duration-300"
                      style={{ width: `${sectionPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tasks */}
              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {section.tasks.map(task => {
                    const status = getStatus(task.status);
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-2.5 px-3 py-2 group hover:bg-bg-hover transition-colors ${task.status === 'done' ? 'opacity-60' : ''}`}
                      >
                        <GripVertical className="w-3 h-3 text-text-muted/30 shrink-0" />
                        <button
                          onClick={() => cycleTaskStatus(section.id, task.id)}
                          className={`shrink-0 transition-transform hover:scale-110 ${status.color}`}
                          title={`Status: ${status.label}. Click to change.`}
                        >
                          <StatusIcon className="w-4.5 h-4.5" />
                        </button>
                        <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                          {task.text}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                        <button
                          onClick={() => deleteTask(section.id, task.id)}
                          className="p-0.5 text-text-muted hover:text-danger transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add task form inline */}
                  {addingTaskTo === section.id && (
                    <form onSubmit={e => addTask(section.id, e)} className="flex items-center gap-2 px-3 py-2">
                      <div className="w-3" />
                      <Circle className="w-4.5 h-4.5 text-text-muted/30 shrink-0" />
                      <input
                        type="text"
                        placeholder="Task description..."
                        value={newTaskText}
                        onChange={e => setNewTaskText(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!newTaskText.trim()}
                        className="text-xs text-accent hover:text-accent-hover disabled:opacity-40 font-medium transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingTaskTo(null); setNewTaskText(''); }}
                        className="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}

                  {/* Empty section hint */}
                  {section.tasks.length === 0 && addingTaskTo !== section.id && (
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-text-muted">No tasks. Click + to add items from the rubric.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title="Delete section?"
        message="This will remove the section and all its tasks. This can't be undone."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { deleteSection(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Legend */}
      {totalCount > 0 && (
        <div className="flex gap-4 text-[10px] text-text-muted pt-1">
          <span className="flex items-center gap-1"><Circle className="w-3 h-3 text-text-muted/50" /> To Do</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-warning" /> Working</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Done</span>
        </div>
      )}
    </div>
  );
}
