import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '../hooks/useCourses';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { CheckCircle2, Circle, Clock, ChevronRight, Search, GraduationCap, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { timeAgo, getBestPracticeOa, getCourseReadiness, readinessColor } from '../utils/studyHelpers';

const STATUS_CYCLE = ['not-started', 'in-progress', 'passed'];
const CATEGORIES = ['General Education', 'Business Core', 'Finance Major', 'Capstone', 'Other'];

function StatusIcon({ status }) {
  if (status === 'passed') return <CheckCircle2 className="w-5 h-5 text-success" />;
  if (status === 'in-progress') return <Clock className="w-5 h-5 text-warning" />;
  return <Circle className="w-5 h-5 text-text-muted/40" />;
}

export default function TermPlan() {
  const [courseProgress, setCourseProgress] = useLocalStorage('studyhub-course-progress', {});
  const { courses, totalCUs } = useCourses();
  const [profile] = useLocalStorage('studyhub-profile', {});
  const [search, setSearch] = useState('');
  const [lastStudied] = useLocalStorage('studyhub-last-studied', {});
  const displayCUs = profile.programCUs || totalCUs;
  const navigate = useNavigate();

  const [celebrating, setCelebrating] = useState(null);

  function cycleStatus(courseId) {
    const current = courseProgress[courseId]?.status || 'not-started';
    const nextIndex = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    const next = STATUS_CYCLE[nextIndex];
    setCourseProgress(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], status: next },
    }));
    if (next === 'passed') {
      setCelebrating(courseId);
      setTimeout(() => setCelebrating(null), 1500);
    }
  }

  const categories = [...new Set([...courses.map(c => c.category), ...CATEGORIES])].filter(
    cat => courses.some(c => c.category === cat)
  );
  const passedCUs = courses
    .filter(c => courseProgress[c.id]?.status === 'passed')
    .reduce((sum, c) => sum + c.cus, 0);
  const passedCount = courses.filter(c => courseProgress[c.id]?.status === 'passed').length;

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Term Plan</h1>
          <p className="text-sm text-text-secondary">Track your degree progress</p>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-10 text-center">
          <GraduationCap className="w-12 h-12 text-text-muted/20 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-text-primary mb-1">No courses yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            Add your courses in Settings to start tracking your degree progress. You can add them manually or load a preset program.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Term Plan</h1>
          <p className="text-sm text-text-secondary">
            Track your degree progress - click status icons to cycle through states
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-text-muted">
            <span className="font-num text-text-primary font-semibold">{passedCount}</span>/{courses.length} courses
          </span>
          <span className="text-text-muted">
            <span className="font-num text-text-primary font-semibold">{passedCUs}</span>/{displayCUs} CUs
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search courses by code or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><Circle className="w-3 h-3 text-text-muted/40" /> Not Started</span>
        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-warning" /> In Progress</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-success" /> Passed</span>
      </div>

      {categories.map(category => {
        const allCategoryCourses = courses.filter(c => c.category === category);
        const categoryCourses = search.trim()
          ? allCategoryCourses.filter(c =>
              c.code.toLowerCase().includes(search.toLowerCase()) ||
              c.name.toLowerCase().includes(search.toLowerCase())
            )
          : allCategoryCourses;
        if (categoryCourses.length === 0) return null;
        const catPassed = categoryCourses.filter(c => courseProgress[c.id]?.status === 'passed').length;

        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">{category}</h2>
              <span className="text-xs text-text-muted font-num">{catPassed}/{categoryCourses.length}</span>
            </div>
            <div className="bg-bg-secondary rounded-xl border border-border divide-y divide-border overflow-hidden">
              {categoryCourses.map(course => {
                const status = courseProgress[course.id]?.status || 'not-started';
                const studied = lastStudied[course.id];
                const bestOa = getBestPracticeOa(course.id);
                const readiness = getCourseReadiness(course.id);
                return (
                  <div
                    key={course.id}
                    onClick={() => navigate(`/course/${course.id}`)}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-all group cursor-pointer relative overflow-hidden ${
                      celebrating === course.id ? 'bg-success/10' : ''
                    }`}
                  >
                    {celebrating === course.id && (
                      <div className="absolute inset-0 pointer-events-none celebrate-burst" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); cycleStatus(course.id); }}
                      className="shrink-0 hover:scale-110 transition-transform"
                      title="Click to change status"
                    >
                      <StatusIcon status={status} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold font-num text-accent">{course.code}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                          {course.type}
                        </span>
                        {studied && <span className="text-[10px] font-num text-text-muted">{timeAgo(studied)}</span>}
                      </div>
                      <p className="text-sm text-text-primary truncate">{course.name}</p>
                    </div>
                    {/* Readiness bar */}
                    {readiness > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full progress-fill ${readinessColor(readiness)}`} style={{ width: `${readiness}%` }} />
                        </div>
                        <span className="text-[10px] font-num text-text-muted w-7 text-right">{readiness}%</span>
                      </div>
                    )}
                    {bestOa && <span className="text-[10px] font-num text-success shrink-0">OA: {bestOa.pct}%</span>}
                    <span className="text-xs font-num text-text-muted shrink-0">{course.cus} CU</span>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
