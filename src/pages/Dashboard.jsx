import { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  BookCheck,
  Brain,
  Target,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Flame,
  ClipboardList,
  Zap,
  Check,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCourses } from '../hooks/useCourses';
import { timeAgo, getBestPracticeOa, getCourseReadiness } from '../utils/studyHelpers';

function StatCard({ icon: Icon, label, value, color, fading }) {
  return (
    <div
      className="bg-bg-secondary rounded-xl border border-border p-4 flex items-center gap-4 transition-all duration-500 card-shadow card-hover"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-text-muted text-[11px] tracking-wide">{label}</p>
        <p className="text-xl font-bold font-num text-text-primary leading-tight">{value}</p>
      </div>
    </div>
  );
}

function computeCyclingStats(courseProgress, courses) {
  let totalCardsStudied = 0;
  let mockScores = [];
  let preTestCount = 0;
  let totalRapidFireRounds = 0;

  for (const course of courses) {
    const cardProgressRaw = localStorage.getItem(`studyhub-cards-${course.id}`);
    if (cardProgressRaw) {
      try {
        const cardProgress = JSON.parse(cardProgressRaw);
        const cardIds = Object.keys(cardProgress);
        totalCardsStudied += cardIds.length;
        const totalReviews = cardIds.reduce(
          (sum, id) => sum + (cardProgress[id]?.timesReviewed || 0), 0
        );
        totalRapidFireRounds += Math.floor(totalReviews / 10);
      } catch {}
    }
    const historyRaw = localStorage.getItem(`studyhub-quiz-history-${course.id}`);
    if (historyRaw) {
      try {
        const history = JSON.parse(historyRaw);
        for (const entry of history) {
          if (entry.type === 'Mock Exam' && entry.total > 0)
            mockScores.push(Math.round((entry.score / entry.total) * 100));
          if (entry.type === 'Pre-Test') preTestCount++;
        }
      } catch {}
    }
  }
  const mockAvg = mockScores.length > 0
    ? Math.round(mockScores.reduce((a, b) => a + b, 0) / mockScores.length)
    : null;
  const oaReadyCount = courses.filter(
    c => c.type === 'OA' && (courseProgress[c.id]?.readiness || 0) >= 80
  ).length;
  return { totalCardsStudied, mockAvg, oaReadyCount, preTestCount, totalRapidFireRounds };
}

const CYCLING_PAIRS = [
  s => [
    { icon: Brain, label: 'Cards Studied', value: s.totalCardsStudied.toLocaleString(), color: 'bg-warning/80' },
    { icon: Target, label: 'Mock Average', value: s.mockAvg !== null ? `${s.mockAvg}%` : '--', color: 'bg-danger/80' },
  ],
  s => [
    { icon: ShieldCheck, label: 'OA Ready', value: s.oaReadyCount, color: 'bg-emerald-500/80' },
    { icon: Flame, label: 'Study Streak', value: `${s.streak} day${s.streak !== 1 ? 's' : ''}`, color: 'bg-orange-500/80' },
  ],
  s => [
    { icon: ClipboardList, label: 'Pre-Tests Taken', value: s.preTestCount, color: 'bg-blue-500/80' },
    { icon: Zap, label: 'Rapid Fire Rounds', value: s.totalRapidFireRounds, color: 'bg-purple-500/80' },
  ],
];

const MODE_LABELS = {
  flashcards: 'Flashcards',
  'rapid-fire': 'Rapid Fire',
  'pre-test': 'Pre-Test',
  'mini-oa': 'Mini OA',
  'practice-oa': 'Practice OA',
  'fill-blank': 'Fill in the Blank',
  'triple-threat': 'Triple Threat',
  'true-false': 'True / False',
  'match-game': 'Match',
  'unit-summaries': 'Unit Summaries',
  'weak-spots': 'Weak Spots',
};

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="text-right shrink-0 hidden sm:block">
      <p className="text-sm font-medium text-text-primary font-num">{time}</p>
      <p className="text-xs text-text-muted">{date}</p>
    </div>
  );
}

export default function Dashboard() {
  const [courseProgress] = useLocalStorage('studyhub-course-progress', {});
  const [profile] = useLocalStorage('studyhub-profile', { name: 'Student' });
  const [pairIndex, setPairIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const { courses, totalCUs } = useCourses();
  const [lastStudied] = useLocalStorage('studyhub-last-studied', {});
  const displayCUs = profile.programCUs || totalCUs;

  const passedCourses = courses.filter(c => courseProgress[c.id]?.status === 'passed');
  const inProgressCourses = courses.filter(c => courseProgress[c.id]?.status === 'in-progress');
  const passedCUs = passedCourses.reduce((sum, c) => sum + c.cus, 0);

  const firstName = (profile.name || 'Student').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night grind' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour >= 21 ? 'Late night grind' : 'Good evening';

  const subtitle = useMemo(() => {
    // Check if user passed a course recently
    const recentPass = (() => {
      const now = Date.now();
      for (const course of passedCourses) {
        const ts = lastStudied[course.id];
        if (ts && now - ts < 48 * 60 * 60 * 1000) return course;
      }
      return null;
    })();
    if (recentPass) {
      const ago = Date.now() - lastStudied[recentPass.id];
      const label = ago < 24 * 60 * 60 * 1000 ? 'today' : 'yesterday';
      return `You passed ${recentPass.code} ${label} — nice work!`;
    }
    if (passedCourses.length > 0 && inProgressCourses.length > 0) {
      return `${passedCourses.length}/${courses.length} courses complete — ${inProgressCourses.length} in progress.`;
    }
    if (passedCourses.length > 0) {
      return `${passedCourses.length}/${courses.length} courses complete — keep pushing!`;
    }
    if (inProgressCourses.length > 0) {
      return `${inProgressCourses.length} course${inProgressCourses.length !== 1 ? 's' : ''} in progress. Let's go!`;
    }
    return "Let's get started on your degree.";
  }, [passedCourses, inProgressCourses, courses.length, lastStudied]);

  const streak = useMemo(() => {
    try {
      const raw = localStorage.getItem('studyhub-last-studied');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      const dates = Object.values(data)
        .filter(ts => typeof ts === 'number')
        .map(ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; });
      const unique = [...new Set(dates)].sort().reverse();
      if (unique.length === 0) return 0;
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
      if (unique[0] !== todayKey && unique[0] !== yKey) return 0;
      let count = 0;
      let check = new Date(today);
      if (unique[0] !== todayKey) check.setDate(check.getDate() - 1);
      for (let i = 0; i < 365; i++) {
        const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
        if (unique.includes(key)) { count++; check.setDate(check.getDate() - 1); }
        else break;
      }
      return count;
    } catch { return 0; }
  }, []);

  const rawStats = useMemo(() => computeCyclingStats(courseProgress, courses), [courseProgress, courses]);
  const stats = useMemo(() => ({ ...rawStats, streak }), [rawStats, streak]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPairIndex(prev => (prev + 1) % CYCLING_PAIRS.length);
        setFading(false);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentPair = CYCLING_PAIRS[pairIndex](stats);

  // Pick up where you left off
  const lastSession = useMemo(() => {
    try {
      const raw = localStorage.getItem('studyhub-last-session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session.courseId || !session.timestamp) return null;
      const course = courses.find(c => c.id === session.courseId);
      if (!course) return null;
      return { ...session, course };
    } catch { return null; }
  }, [courses]);

  // Top weak spots across all courses
  const topWeakSpots = useMemo(() => {
    const spots = [];
    for (const course of courses) {
      try {
        const raw = localStorage.getItem(`studyhub-missed-${course.id}`);
        if (!raw) continue;
        const data = JSON.parse(raw);
        for (const [id, v] of Object.entries(data)) {
          if (v.missCount >= 2 && (v.correctStreak || 0) < 3) {
            spots.push({ id, text: v.text, courseCode: course.code, courseId: course.id, missCount: v.missCount });
          }
        }
      } catch {}
    }
    return spots.sort((a, b) => b.missCount - a.missCount).slice(0, 5);
  }, [courses]);

  // Today's activity
  const todayActivity = useMemo(() => {
    const items = [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    for (const course of courses) {
      // Quiz history
      try {
        const raw = localStorage.getItem(`studyhub-quiz-history-${course.id}`);
        if (raw) {
          const history = JSON.parse(raw);
          for (const entry of history) {
            if (entry.timestamp >= ts) {
              const pct = entry.total > 0 ? Math.round((entry.score / entry.total) * 100) : 0;
              items.push({ text: `Scored ${pct}% on ${course.code} ${entry.type}`, time: entry.timestamp });
            }
          }
        }
      } catch {}
      // Card ratings today
      try {
        const raw = localStorage.getItem(`studyhub-cards-${course.id}`);
        if (raw) {
          const progress = JSON.parse(raw);
          let todayCount = 0;
          for (const p of Object.values(progress)) {
            if (p.lastSeen >= ts) todayCount++;
          }
          if (todayCount > 0) items.push({ text: `Rated ${todayCount} cards in ${course.code}`, time: ts });
        }
      } catch {}
    }
    return items.sort((a, b) => b.time - a.time).slice(0, 6);
  }, [courses]);

  return (
    <div className="space-y-6 stagger-in">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {greeting}, <span className="text-gradient">{firstName}</span>
          </h1>
          <p className="text-text-secondary text-sm mt-1">{subtitle}</p>
        </div>
        <LiveClock />
      </div>

      {/* Stats Grid */}
      <div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={BookCheck} label="Courses Passed" value={passedCourses.length} color="bg-success/80" />
          <StatCard icon={GraduationCap} label="CUs Earned" value={`${passedCUs}/${displayCUs}`} color="bg-accent/80" />
          <StatCard icon={currentPair[0].icon} label={currentPair[0].label} value={currentPair[0].value} color={currentPair[0].color} fading={fading} />
          <StatCard icon={currentPair[1].icon} label={currentPair[1].label} value={currentPair[1].value} color={currentPair[1].color} fading={fading} />
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          {CYCLING_PAIRS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFading(true); setTimeout(() => { setPairIndex(i); setFading(false); }, 400); }}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === pairIndex ? 'bg-accent w-3' : 'bg-text-muted/30'}`}
              aria-label={`Show stat pair ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Pick Up Where You Left Off */}
      {lastSession && (
        <Link
          to={`/course/${lastSession.courseId}`}
          className="flex items-center gap-4 bg-bg-secondary rounded-xl border border-border p-4 hover:border-accent/50 transition-all card-hover card-shadow"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 glow-pulse">
            <Play className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Pick up where you left off</p>
            <p className="text-sm font-semibold text-text-primary">
              {lastSession.course.code} {MODE_LABELS[lastSession.mode] || lastSession.mode}
            </p>
          </div>
          <span className="text-[10px] font-num text-text-muted shrink-0">{timeAgo(lastSession.timestamp)}</span>
          <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
        </Link>
      )}

      {/* Continue Studying */}
      {inProgressCourses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Continue Studying</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgressCourses.map(course => {
              const readiness = getCourseReadiness(course.id);
              const studied = lastStudied[course.id];
              const bestOa = course.type === 'OA' ? getBestPracticeOa(course.id) : null;
              return (
                <Link
                  key={course.id}
                  to={`/course/${course.id}`}
                  className="bg-bg-secondary rounded-xl border border-border p-4 hover:border-accent/50 transition-all group card-hover"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-accent font-semibold font-num">{course.code}</p>
                        {studied && <span className="text-[10px] text-text-muted font-num">{timeAgo(studied)}</span>}
                      </div>
                      <p className="text-sm font-medium text-text-primary mt-0.5">{course.name}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full progress-fill" style={{ width: `${readiness}%` }} />
                    </div>
                    <span className="text-[10px] font-num text-text-muted">{readiness}%</span>
                    {bestOa && <span className="text-[10px] font-num text-success shrink-0">OA: {bestOa.pct}%</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — compact banner */}
      {inProgressCourses.length === 0 && (
        <div className="flex items-center gap-3 bg-bg-secondary rounded-lg border border-border px-4 py-3">
          <BookCheck className="w-4 h-4 text-text-muted shrink-0" />
          <p className="text-sm text-text-secondary flex-1">No courses in progress</p>
          <Link to="/term-plan" className="text-xs text-accent hover:text-accent-hover font-medium transition-colors shrink-0">
            Open Term Plan
          </Link>
        </div>
      )}

      {/* This Week — full width, prominent */}
      <ThisWeekWidget courses={courses} />

      {/* Secondary row: Weak Spots + Today's Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Weak Spots */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-text-muted" />
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Top Weak Spots</h2>
          </div>
          {topWeakSpots.length === 0 ? (
            <div className="bg-bg-secondary rounded-lg border border-border p-3 opacity-50">
              <p className="text-[11px] text-text-muted text-center">No weak spots identified yet.</p>
            </div>
          ) : (
            <div className="bg-bg-secondary rounded-lg border border-border divide-y divide-border overflow-hidden">
              {topWeakSpots.map(spot => (
                <Link
                  key={`${spot.courseId}-${spot.id}`}
                  to={`/course/${spot.courseId}`}
                  className="flex items-center gap-3 px-3 py-1.5 hover:bg-bg-hover transition-colors"
                >
                  <span className="text-[10px] font-num text-danger font-semibold shrink-0">{spot.missCount}x</span>
                  <span className="text-[11px] text-text-secondary truncate flex-1">{spot.text}</span>
                  <span className="text-[10px] font-num text-accent shrink-0">{spot.courseCode}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Today's Activity */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-text-muted" />
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Today's Activity</h2>
          </div>
          {todayActivity.length === 0 ? (
            <div className="bg-bg-secondary rounded-lg border border-border p-3">
              <p className="text-[11px] text-text-muted text-center">No activity yet — time to study!</p>
            </div>
          ) : (
            <div className="bg-bg-secondary rounded-lg border border-border divide-y divide-border overflow-hidden">
              {todayActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                  <span className="text-[11px] text-text-secondary flex-1">{item.text}</span>
                  <span className="text-[10px] font-num text-text-muted shrink-0">
                    {new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ This Week — Rolling 7-day strip starting today ══ */
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function ThisWeekWidget({ courses }) {
  const [goals, setGoals] = useLocalStorage('studyhub-goals', []);
  const [selectedDay, setSelectedDay] = useState(null);

  const today = new Date();
  const todayKey = toKey(today);

  // Build rolling 7 days: today + next 6
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { date: d, key: toKey(d), label: DAY_LETTERS[d.getDay()], dayNum: d.getDate() };
    });
  }, []);

  const startKey = weekDays[0].key;
  const endKey = weekDays[6].key;

  const weekGoals = useMemo(() =>
    goals.filter(g => g.targetDate >= startKey && g.targetDate <= endKey),
    [goals, startKey, endKey]
  );

  const goalsByDate = useMemo(() => {
    const map = {};
    for (const g of weekGoals) {
      if (!map[g.targetDate]) map[g.targetDate] = [];
      map[g.targetDate].push(g);
    }
    return map;
  }, [weekGoals]);

  const activeDay = selectedDay || todayKey;
  const dayGoals = goalsByDate[activeDay] || [];

  function toggleComplete(id) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  }

  function getCourseName(id) {
    const c = courses.find(c => c.id === id);
    return c ? c.code : null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Next 7 Days</h2>
        </div>
        <Link to="/goals" className="text-xs text-accent hover:text-accent-hover transition-colors">All Goals</Link>
      </div>

      {/* Calendar strip */}
      <div className="bg-bg-secondary rounded-xl border border-border p-3">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => {
            const dayGs = goalsByDate[day.key] || [];
            const isToday = day.key === todayKey;
            const isActive = day.key === activeDay;
            const hasIncomplete = dayGs.some(g => !g.completed);
            const hasComplete = dayGs.some(g => g.completed);
            const isOverdue = day.key < todayKey && hasIncomplete;

            const firstGoal = dayGs[0];
            const extraCount = dayGs.length - 1;

            return (
              <button
                key={day.key}
                onClick={() => setSelectedDay(day.key)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg transition-colors min-h-[68px] ${
                  isActive ? 'bg-accent/15 ring-1 ring-accent' :
                  isToday ? 'bg-accent/5' :
                  'hover:bg-bg-hover'
                }`}
              >
                <span className="text-[10px] text-text-muted font-medium">{day.label}</span>
                <span className={`text-xs font-num font-semibold ${isToday ? 'text-accent' : 'text-text-primary'}`}>{day.dayNum}</span>
                {firstGoal ? (
                  <div className="mt-1 w-full px-0.5">
                    <p className={`text-[9px] leading-tight truncate text-center ${
                      firstGoal.completed ? 'text-text-muted line-through' :
                      isOverdue ? 'text-danger' : 'text-text-secondary'
                    }`}>{firstGoal.title}</p>
                    {extraCount > 0 && <p className="text-[8px] text-text-muted text-center">+{extraCount}</p>}
                  </div>
                ) : (
                  <div className="flex gap-0.5 mt-1 h-1.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Goals for selected day */}
        {dayGoals.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-2">
            {weekGoals.length === 0 ? (
              <>No upcoming goals. <Link to="/goals" className="text-accent">Set one</Link></>
            ) : 'No goals this day.'}
          </p>
        ) : (
          <div className="space-y-1">
            {dayGoals.map(goal => {
              const isOverdue = goal.targetDate < todayKey && !goal.completed;
              const courseCode = goal.courseId ? getCourseName(goal.courseId) : null;
              return (
                <div key={goal.id} className="flex items-center gap-2 py-1">
                  <button
                    onClick={() => toggleComplete(goal.id)}
                    className={`shrink-0 w-[16px] h-[16px] rounded border-2 flex items-center justify-center transition-colors ${
                      goal.completed ? 'bg-success border-success text-white' :
                      isOverdue ? 'border-danger/50' : 'border-border hover:border-accent'
                    }`}
                  >
                    {goal.completed && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className={`text-xs flex-1 min-w-0 truncate ${
                    goal.completed ? 'line-through text-text-muted' : isOverdue ? 'text-danger' : 'text-text-primary'
                  }`}>
                    {goal.title}
                  </span>
                  {courseCode && <span className="text-[10px] font-num text-accent shrink-0">{courseCode}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
