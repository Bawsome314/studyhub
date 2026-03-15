import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Link2,
  Settings,
  Target,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  CloudOff,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCourses } from '../hooks/useCourses';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { timeAgo, getCourseReadiness, readinessTextColor } from '../utils/studyHelpers';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/term-plan', icon: CalendarDays, label: 'Term Plan' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/resources', icon: Link2, label: 'Resources' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function StatusDot({ status }) {
  const colors = {
    passed: 'bg-success',
    'in-progress': 'bg-warning',
    'not-started': 'bg-text-muted/40',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors['not-started']}`} />;
}

const ABBREVIATIONS = {
  'Introduction': 'Intro.',
  'Fundamentals': 'Fund.',
  'Management': 'Mgmt.',
  'Information': 'Info.',
  'Organizations': 'Orgs.',
  'Interconnecting': 'Intercon.',
  'Technologies': 'Tech.',
  'Organizational': 'Org.',
  'Quantitative': 'Quant.',
  'Communication': 'Comm.',
  'Probability': 'Prob.',
  'Operations': 'Ops.',
  'Principles': 'Princ.',
  'Financial': 'Fin.',
  'Managerial': 'Mgrl.',
  'Innovation': 'Innov.',
  'Essentials': 'Ess.',
  'Environment': 'Env.',
  'Applications': 'Apps.',
  'Presentations': 'Pres.',
  'Spreadsheets': 'Sheets',
  'Connecting with Others': '',
  'Innovative': 'Innov.',
  'Employment': 'Empl.',
  'Enterprise': 'Ent.',
  'Emotional': 'Emot.',
  'Intelligence': 'Intel.',
  'Customer Contact': 'Cust.',
  'Integrated': 'Integ.',
};

function abbreviateName(name) {
  if (name.length <= 20) return name;
  let result = name;
  for (const [word, abbr] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(word, 'g'), abbr);
  }
  if (result.length > 24) {
    return result.slice(0, 21) + '...';
  }
  return result;
}

export default function Sidebar() {
  const [oaOpen, setOaOpen] = useState(true);
  const [paOpen, setPaOpen] = useState(true);
  const [courseProgress] = useLocalStorage('studyhub-course-progress', {});
  const location = useLocation();
  const { user } = useAuth();
  const { syncStatus, lastSynced, manualSync } = useSync();
  const { courses, totalCUs } = useCourses();
  const [lastStudied] = useLocalStorage('studyhub-last-studied', {});
  const [profile] = useLocalStorage('studyhub-profile', {});

  const oaCourses = courses.filter(c => c.type === 'OA');
  const paCourses = courses.filter(c => c.type === 'PA');

  const passedCUs = courses
    .filter(c => courseProgress[c.id]?.status === 'passed')
    .reduce((sum, c) => sum + c.cus, 0);

  const progressPct = totalCUs > 0 ? Math.round((passedCUs / totalCUs) * 100) : 0;

  function getCourseStatus(courseId) {
    return courseProgress[courseId]?.status || 'not-started';
  }

  function getReadiness(courseId) {
    return getCourseReadiness(courseId);
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar border-r border-border flex flex-col z-40 hidden lg:flex">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text-primary leading-tight">StudyHub</h1>
          <p className="text-xs text-text-muted">{profile.program || 'WGU Finance'}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="px-3 mb-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent-muted text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="h-px bg-border mx-3" />

      {/* Course lists */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {/* OA Courses */}
        <button
          onClick={() => setOaOpen(!oaOpen)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
        >
          {oaOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <BookOpen className="w-3 h-3" />
          OA Courses
          <span className="ml-auto font-num text-[10px]">
            {oaCourses.filter(c => getCourseStatus(c.id) === 'passed').length}/{oaCourses.length}
          </span>
        </button>
        {oaOpen && (
          <div className="space-y-0.5 ml-1">
            {oaCourses.map(course => {
              const status = getCourseStatus(course.id);
              const readiness = getReadiness(course.id);
              const isActive = location.pathname === `/course/${course.id}`;
              return (
                <NavLink
                  key={course.id}
                  to={`/course/${course.id}`}
                  title={`${course.code} ${course.name}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isActive
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <StatusDot status={status} />
                  <span className="truncate flex-1">{course.code} {abbreviateName(course.name)}</span>
                  {lastStudied[course.id] && (
                    <span className="font-num text-[9px] text-text-muted/60">{timeAgo(lastStudied[course.id])}</span>
                  )}
                  {readiness > 0 && (
                    <span className={`font-num text-[10px] ${readinessTextColor(readiness)}`}>{readiness}%</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}

        {/* PA Courses */}
        <button
          onClick={() => setPaOpen(!paOpen)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors mt-2"
        >
          {paOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <ClipboardCheck className="w-3 h-3" />
          PA Courses
          <span className="ml-auto font-num text-[10px]">
            {paCourses.filter(c => getCourseStatus(c.id) === 'passed').length}/{paCourses.length}
          </span>
        </button>
        {paOpen && (
          <div className="space-y-0.5 ml-1">
            {paCourses.map(course => {
              const status = getCourseStatus(course.id);
              const isActive = location.pathname === `/course/${course.id}`;
              return (
                <NavLink
                  key={course.id}
                  to={`/course/${course.id}`}
                  title={`${course.code} ${course.name}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isActive
                      ? 'bg-accent-muted text-accent'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <StatusDot status={status} />
                  <span className="truncate flex-1">{course.code} {abbreviateName(course.name)}</span>
                  {lastStudied[course.id] && (
                    <span className="font-num text-[9px] text-text-muted/60">{timeAgo(lastStudied[course.id])}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      {/* Term progress */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-text-muted">Term Progress</span>
          <span className="font-num text-text-secondary">{passedCUs}/{totalCUs} CUs</span>
        </div>
        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-text-muted mt-1 font-num">{progressPct}% complete</p>

        {/* Sync status */}
        {user && (
          <button
            onClick={manualSync}
            className="flex items-center gap-1.5 mt-3 text-[10px] text-text-muted hover:text-text-secondary transition-colors w-full"
            title={lastSynced ? `Last synced: ${lastSynced.toLocaleTimeString()}` : 'Click to sync'}
          >
            {syncStatus === 'syncing' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : syncStatus === 'error' ? (
              <CloudOff className="w-3 h-3 text-danger" />
            ) : (
              <Cloud className="w-3 h-3 text-success" />
            )}
            <span>
              {syncStatus === 'syncing' ? 'Syncing...' :
               syncStatus === 'error' ? 'Sync error' :
               lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : 'Connected'}
            </span>
          </button>
        )}
        {!user && (
          <NavLink
            to="/settings"
            className="flex items-center gap-1.5 mt-3 text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            <CloudOff className="w-3 h-3" />
            <span>Sign in to sync</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
}
