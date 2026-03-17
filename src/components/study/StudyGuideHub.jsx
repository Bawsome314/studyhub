import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Layers,
  Zap,
  FileCheck,
  Puzzle,
  BookOpen,
  Trophy,
  Sparkles,
  TextCursorInput,
  ListChecks,
  ToggleRight,
  Clock,
  Target,
  AlertTriangle,
  Copy,
  Check,
  Users,
  Loader2,
} from 'lucide-react';
import { useStudyGuide, useCardProgress, useQuizHistory, useMissedQuestions, pickRandom, shuffleChoices, getDueCards } from '../../hooks/useStudyGuide';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { formatShortDate, getCourseReadiness, readinessColor, readinessTextColor } from '../../utils/studyHelpers';
import buildClaudePrompt from '../../lib/buildClaudePrompt';
import { useCommunityGuide } from '../../hooks/useCommunityGuide';
import QuizEngine from './QuizEngine';
import Flashcards from './Flashcards';
import RapidFire from './RapidFire';
import MatchGame from './MatchGame';
import FillInTheBlank from './FillInTheBlank';
import TripleThreat from './TripleThreat';
import TrueFalse from './TrueFalse';
import UnitSummaries from './UnitSummaries';
import WeakSpotsView from './WeakSpotsView';

export default function StudyGuideHub({ courseId, courseCode, courseName }) {
  const {
    guide, loading, allCards, allQuestions, allMatchPairs,
    extraQuestions, mockPool, trueFalsePool, fillInBlankPool,
  } = useStudyGuide(courseId);
  const { progress } = useCardProgress(courseId);
  const { history, saveResult } = useQuizHistory(courseId);
  const { missedData, recordMiss, recordCorrect, weakSpots } = useMissedQuestions(courseId);
  const [lastStudied, setLastStudied] = useLocalStorage('studyhub-last-studied', {});
  const [activeTool, setActiveTool] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const { communityGuide, installing: communityInstalling, loadGuide: loadCommunityGuide } = useCommunityGuide(!guide && !loading ? courseCode : null);

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border p-12 text-center">
        <div className="inline-block w-8 h-8 border-[3px] border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-text-primary">Loading study guide...</p>
        <p className="text-xs text-text-muted mt-1">This may take a moment on mobile</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="space-y-3">
        <div className="bg-bg-secondary rounded-xl border border-border p-8 text-center">
          <BookOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-sm font-medium text-text-primary mb-1">No study guide loaded</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
            Generate a study guide with Claude or import one from Settings.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                const prompt = buildClaudePrompt({ code: courseCode, name: courseName, id: courseId });
                navigator.clipboard.writeText(prompt);
                setSummaryCopied(true);
                setTimeout(() => setSummaryCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
            >
              {summaryCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {summaryCopied ? 'Copied!' : 'Generate Study Guide'}
            </button>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary hover:text-text-primary text-xs font-medium rounded-lg transition-colors"
            >
              Import in Settings
            </Link>
          </div>
        </div>

        {/* Community guide available */}
        {communityGuide && (
          <div className="bg-bg-secondary rounded-xl border border-accent/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Community guide available</p>
                  <p className="text-[11px] text-text-muted">
                    {communityGuide.card_count} cards · {communityGuide.unit_count} units · Shared by {communityGuide.uploader_name}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const loaded = await loadCommunityGuide();
                  if (loaded) window.location.reload();
                }}
                disabled={communityInstalling}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
              >
                {communityInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                {communityInstalling ? 'Loading...' : 'Load Guide'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Merge all available quiz questions: mockPool preferred for exams, extraQuestions for drills
  const examPool = mockPool.length > 0 ? mockPool : allQuestions;
  const drillPool = extraQuestions.length > 0 ? [...extraQuestions, ...allQuestions] : allQuestions;

  const cardCount = allCards.length;
  const questionCount = examPool.length;
  const matchPairCount = allMatchPairs.length > 0 ? allMatchPairs.length : cardCount;
  const tfCount = trueFalsePool.length > 0 ? trueFalsePool.length : cardCount;
  const fibCount = fillInBlankPool.length > 0 ? fillInBlankPool.length : cardCount;
  const masteredCards = allCards.filter(c => progress[c.id]?.rating === 'got-it').length;
  const dueCards = getDueCards(allCards, progress);
  const dueCount = dueCards.length;
  const readinessPct = getCourseReadiness(courseId);

  // Weak spots count: shaky/dont-know cards + missed questions
  const shakyCount = allCards.filter(c => progress[c.id] && (progress[c.id].rating === 'dont-know' || progress[c.id].rating === 'shaky')).length;
  const weakSpotsIds = new Set(weakSpots.map(w => w.id));
  const uniqueWeakCount = shakyCount + weakSpots.filter(w => {
    const p = progress[w.id];
    return !p || (p.rating !== 'dont-know' && p.rating !== 'shaky');
  }).length;
  const hasWeakSpots = uniqueWeakCount > 0;

  // Pre-test & exam history
  const preTestResults = history.filter(h => h.type === 'Pre-Test');
  const miniOaResults = history.filter(h => h.type === 'Mini OA');
  const practiceOaResults = history.filter(h => h.type === 'Practice OA');
  const hasTakenPreTest = preTestResults.length > 0;
  const lastPreTest = preTestResults[preTestResults.length - 1];
  const bestPracticeOa = practiceOaResults.length > 0
    ? practiceOaResults.reduce((best, r) => {
        const pct = r.total > 0 ? (r.score / r.total) * 100 : 0;
        const bestPct = best.total > 0 ? (best.score / best.total) * 100 : 0;
        return pct > bestPct ? r : best;
      })
    : null;

  function handleExit() {
    setActiveTool(null);
  }

  function startTool(toolId) {
    if (toolId === 'pre-test') {
      setQuizQuestions(shuffleChoices(pickRandom(examPool, Math.min(20, examPool.length))));
    } else if (toolId === 'mini-oa') {
      setQuizQuestions(shuffleChoices(pickRandom(drillPool, Math.min(15, drillPool.length))));
    } else if (toolId === 'practice-oa') {
      setQuizQuestions(shuffleChoices(pickRandom(examPool, Math.min(40, examPool.length))));
    }
    setActiveTool(toolId);
    setLastStudied(prev => ({ ...prev, [courseId]: Date.now() }));
    try {
      localStorage.setItem('studyhub-last-session', JSON.stringify({
        courseId, mode: toolId, timestamp: Date.now(),
      }));
    } catch {}
  }

  // === Active Tool Rendering ===
  if (activeTool === 'pre-test') {
    return (
      <QuizEngine
        courseCode={courseCode} courseName={courseName}
        type="Pre-Test" questions={quizQuestions}
        timerMinutes={null} onExit={handleExit} onSaveResult={saveResult}
        onRecordMiss={recordMiss} onRecordCorrect={recordCorrect}
      />
    );
  }
  if (activeTool === 'mini-oa') {
    return (
      <QuizEngine
        courseCode={courseCode} courseName={courseName}
        type="Mini OA" questions={quizQuestions}
        timerMinutes={null} onExit={handleExit} onSaveResult={saveResult}
        onRecordMiss={recordMiss} onRecordCorrect={recordCorrect}
      />
    );
  }
  if (activeTool === 'practice-oa') {
    return (
      <QuizEngine
        courseCode={courseCode} courseName={courseName}
        type="Practice OA" questions={quizQuestions}
        timerMinutes={60} deferReveal={true}
        onExit={handleExit} onSaveResult={saveResult}
        onRecordMiss={recordMiss} onRecordCorrect={recordCorrect}
      />
    );
  }
  if (activeTool === 'flashcards') {
    return <Flashcards courseId={courseId} cards={allCards} onExit={handleExit} />;
  }
  if (activeTool === 'rapid-fire') {
    return <RapidFire courseId={courseId} cards={allCards} courseCode={courseCode} courseName={courseName} onExit={handleExit} onRecordMiss={recordMiss} onRecordCorrect={recordCorrect} />;
  }
  if (activeTool === 'match-game') {
    return <MatchGame cards={allCards} matchPairs={allMatchPairs} courseCode={courseCode} courseName={courseName} onExit={handleExit} />;
  }
  if (activeTool === 'fill-blank') {
    return <FillInTheBlank cards={allCards} fillInBlankPool={fillInBlankPool} courseCode={courseCode} courseName={courseName} onExit={handleExit} onRecordMiss={recordMiss} onRecordCorrect={recordCorrect} />;
  }
  if (activeTool === 'triple-threat') {
    return <TripleThreat cards={allCards} extraQuestions={extraQuestions} courseCode={courseCode} courseName={courseName} onExit={handleExit} onRecordMiss={recordMiss} onRecordCorrect={recordCorrect} />;
  }
  if (activeTool === 'true-false') {
    return <TrueFalse cards={allCards} trueFalsePool={trueFalsePool} courseCode={courseCode} courseName={courseName} onExit={handleExit} onRecordMiss={recordMiss} onRecordCorrect={recordCorrect} />;
  }
  if (activeTool === 'unit-summaries') {
    return <UnitSummaries courseId={courseId} guide={guide} onExit={handleExit} />;
  }
  if (activeTool === 'weak-spots') {
    return <WeakSpotsView allCards={allCards} progress={progress} weakSpots={weakSpots} onExit={handleExit} />;
  }

  // === Hub Layout ===
  const preTestPct = lastPreTest ? Math.round((lastPreTest.score / lastPreTest.total) * 100) : null;
  const practiceOaQCount = Math.min(40, questionCount);
  const practiceOaBestPct = bestPracticeOa ? Math.round((bestPracticeOa.score / bestPracticeOa.total) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Readiness bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-text-muted">{guide.units.length} units · {cardCount} cards · {masteredCards} mastered</span>
            <span className={`font-num font-semibold ${readinessTextColor(readinessPct)}`}>
              {readinessPct >= 85 ? 'Ready' : readinessPct >= 40 ? 'In Progress' : 'Getting Started'}
            </span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${readinessColor(readinessPct)}`}
              style={{ width: `${readinessPct}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-bold font-num ${readinessTextColor(readinessPct)}`}>{readinessPct}%</span>
      </div>

      {/* ═══ TOP BANNER: Assessment ═══ */}
      <div className="bg-bg-secondary rounded-xl border border-border p-5">
        {!hasTakenPreTest ? (
          /* Pre-test CTA */
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                <ClipboardList className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Take the Pre-Test</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {Math.min(20, questionCount)} OA-caliber questions to identify weak spots before you start studying.
                </p>
              </div>
            </div>
            <button
              onClick={() => startTool('pre-test')}
              disabled={questionCount === 0}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
            >
              Start Pre-Test
            </button>
          </div>
        ) : (
          /* Post pre-test: show score + Mini OA */
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${preTestPct >= 80 ? 'bg-success/15' : preTestPct >= 60 ? 'bg-warning/15' : 'bg-danger/15'}`}>
                <Target className={`w-6 h-6 ${preTestPct >= 80 ? 'text-success' : preTestPct >= 60 ? 'text-warning' : 'text-danger'}`} />
              </div>
              <div>
                <p className="text-xs text-text-muted">Pre-Test Score</p>
                <p className="text-xl font-bold font-num text-text-primary">{preTestPct}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => startTool('pre-test')}
                className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors"
              >
                Retake Pre-Test
              </button>
              <button
                onClick={() => startTool('mini-oa')}
                disabled={questionCount === 0}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Mini OA ({Math.min(15, questionCount)}q)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MIDDLE: Two columns ═══ */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        {/* Left: Study — Flashcards, Unit Summaries, Weak Spots */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Study</h3>

          <BigToolCard
            icon={Layers} label="Flashcards" color="bg-purple-500/15 text-purple-400"
            desc="Review cards with confidence rating — track what you know and what needs work"
            meta={`${cardCount} cards · ${masteredCards} mastered`}
            badge={dueCount > 0 ? `${dueCount} due` : (cardCount > 0 ? 'All caught up' : null)}
            badgeColor={dueCount > 0 ? 'text-accent' : 'text-success'}
            disabled={cardCount === 0}
            onClick={() => startTool('flashcards')}
          />
          <BigToolCard
            icon={BookOpen} label="Unit Summaries" color="bg-sky-500/15 text-sky-400"
            desc="Browse every term and definition organized by unit"
            meta={`${guide.units.length} units · ${cardCount} terms`}
            disabled={cardCount === 0}
            onClick={() => startTool('unit-summaries')}
          />
          <button
            onClick={() => startTool('weak-spots')}
            disabled={!hasWeakSpots}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all flex-1 ${
              !hasWeakSpots
                ? 'opacity-50 cursor-not-allowed bg-bg-tertiary border-border'
                : 'bg-bg-secondary border-danger/20 hover:border-danger/40 hover:bg-bg-hover cursor-pointer'
            }`}
          >
            <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-danger/15">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary">Weak Spots</p>
              <p className="text-xs text-text-muted">
                {hasWeakSpots ? 'Review and drill concepts that need work' : 'Study more to identify weak areas'}
              </p>
            </div>
            {hasWeakSpots && <span className="text-xs font-num font-bold text-danger shrink-0">{uniqueWeakCount}</span>}
          </button>
        </div>

        {/* Right: Test Yourself — 2×2 grid + Rapid Fire */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Test Yourself</h3>

          <div className="grid grid-cols-2 gap-2">
            <ToolCard
              icon={TextCursorInput} label="Fill in Blank" color="bg-teal-500/15 text-teal-400"
              desc="Type the missing term"
              meta={`${fibCount}`}
              disabled={cardCount === 0}
              onClick={() => startTool('fill-blank')}
            />
            <ToolCard
              icon={ListChecks} label="Triple Threat" color="bg-amber-500/15 text-amber-400"
              desc="Pick from 3 choices"
              meta={`${cardCount}`}
              disabled={cardCount < 3}
              onClick={() => startTool('triple-threat')}
            />
            <ToolCard
              icon={ToggleRight} label="True / False" color="bg-rose-500/15 text-rose-400"
              desc="Spot the false claim"
              meta={`${tfCount}`}
              disabled={cardCount < 2}
              onClick={() => startTool('true-false')}
            />
            <ToolCard
              icon={Puzzle} label="Match" color="bg-pink-500/15 text-pink-400"
              desc="Pair terms to definitions"
              meta={`${Math.min(8, matchPairCount)}`}
              disabled={cardCount < 4}
              onClick={() => startTool('match-game')}
            />
          </div>

          {/* Rapid Fire — spans right column width */}
          <button
            onClick={() => startTool('rapid-fire')}
            disabled={cardCount < 4}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all flex-1 ${
              cardCount < 4
                ? 'opacity-30 cursor-not-allowed bg-bg-tertiary border-border'
                : 'bg-bg-secondary border-border hover:border-orange-400/30 hover:bg-bg-hover cursor-pointer'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Rapid Fire</p>
              <p className="text-[11px] text-text-muted">Quick drill, instant feedback</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-num text-text-muted shrink-0">
              <span className="px-1.5 py-0.5 bg-bg-tertiary rounded">10</span>
              <span className="px-1.5 py-0.5 bg-bg-tertiary rounded">25</span>
              <span className="px-1.5 py-0.5 bg-bg-tertiary rounded">50</span>
              <span className="px-1.5 py-0.5 bg-bg-tertiary rounded">∞</span>
            </div>
          </button>
        </div>
      </div>

      {/* ═══ BOTTOM: Practice OA ═══ */}
      <div className="bg-bg-secondary rounded-xl border-2 border-accent/20 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Practice OA</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Exam simulation — no answers revealed until the end. Timed, just like the real thing.
              </p>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted font-num">
                <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> {practiceOaQCount} questions</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 60 min</span>
                {practiceOaBestPct !== null && (
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> Best: {practiceOaBestPct}%{bestPracticeOa?.timestamp ? ` — ${formatShortDate(bestPracticeOa.timestamp)}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => startTool('practice-oa')}
            disabled={questionCount === 0}
            className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
          >
            Start Practice OA
          </button>
        </div>
      </div>

      {/* Recent results */}
      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-2">Recent Results</h3>
          <div className="space-y-1.5">
            {history.slice(-5).reverse().map((result, i) => (
              <div key={i} className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-2 border border-border">
                <div>
                  <span className="text-xs font-medium text-text-primary">{result.type}</span>
                  <span className="text-[10px] text-text-muted ml-2">
                    {new Date(result.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-sm font-num font-semibold text-text-primary">
                  {result.score}/{result.total} ({Math.round((result.score / result.total) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export study summary for Claude */}
      {(history.length > 0 || Object.keys(progress).length > 0) && (
        <div className="bg-bg-secondary rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Study Summary for Claude</p>
              <p className="text-xs text-text-muted mt-0.5">
                Copy your progress, weak spots, and difficulty areas so Claude can personalize your coaching
              </p>
            </div>
            <button
              onClick={() => {
                const summary = buildStudySummary({
                  courseCode, courseName, guide, allCards, progress,
                  history, weakSpots, missedData, readinessPct, dueCount,
                  masteredCards,
                });
                navigator.clipboard.writeText(summary);
                setSummaryCopied(true);
                setTimeout(() => setSummaryCopied(false), 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              {summaryCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {summaryCopied ? 'Copied!' : 'Copy Summary'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildStudySummary({ courseCode, courseName, guide, allCards, progress, history, weakSpots, missedData, readinessPct, dueCount, masteredCards }) {
  const lines = [];
  lines.push(`# Study Summary: ${courseCode} ${courseName}`);
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push('');

  // Overall stats
  const totalCards = allCards.length;
  const reviewed = allCards.filter(c => progress[c.id]).length;
  const dontKnow = allCards.filter(c => progress[c.id]?.rating === 'dont-know').length;
  const shaky = allCards.filter(c => progress[c.id]?.rating === 'shaky').length;
  const gotIt = allCards.filter(c => progress[c.id]?.rating === 'got-it').length;
  const unseen = totalCards - reviewed;

  lines.push('## Overall Progress');
  lines.push(`- Readiness: ${readinessPct}%`);
  lines.push(`- Cards: ${totalCards} total, ${masteredCards} mastered, ${dueCount} due for review`);
  lines.push(`- Confidence: ${gotIt} got-it, ${shaky} shaky, ${dontKnow} don't-know, ${unseen} unseen`);
  lines.push('');

  // Per-unit breakdown
  if (guide?.units) {
    lines.push('## Progress by Unit');
    for (const unit of guide.units) {
      const unitCards = unit.cards || [];
      const unitTotal = unitCards.length;
      if (unitTotal === 0) continue;
      const unitMastered = unitCards.filter(c => progress[c.id]?.rating === 'got-it').length;
      const unitShaky = unitCards.filter(c => progress[c.id]?.rating === 'shaky').length;
      const unitDontKnow = unitCards.filter(c => progress[c.id]?.rating === 'dont-know').length;
      const unitUnseen = unitTotal - unitCards.filter(c => progress[c.id]).length;
      const unitPct = unitTotal > 0 ? Math.round((unitMastered / unitTotal) * 100) : 0;
      lines.push(`- ${unit.name}: ${unitPct}% mastered (${unitMastered}/${unitTotal}) — ${unitShaky} shaky, ${unitDontKnow} don't-know, ${unitUnseen} unseen`);
    }
    lines.push('');
  }

  // Quiz history
  if (history.length > 0) {
    lines.push('## Quiz History (newest first)');
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    for (const r of sorted.slice(0, 15)) {
      const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
      const date = new Date(r.timestamp).toLocaleDateString();
      lines.push(`- ${r.type}: ${r.score}/${r.total} (${pct}%) — ${date}`);
    }
    if (sorted.length > 15) lines.push(`- ...and ${sorted.length - 15} more attempts`);

    // Score trends per type
    const types = [...new Set(history.map(h => h.type))];
    if (types.length > 0) {
      lines.push('');
      lines.push('## Score Trends');
      for (const type of types) {
        const attempts = history.filter(h => h.type === type).sort((a, b) => a.timestamp - b.timestamp);
        if (attempts.length >= 2) {
          const first = Math.round((attempts[0].score / attempts[0].total) * 100);
          const last = Math.round((attempts[attempts.length - 1].score / attempts[attempts.length - 1].total) * 100);
          const best = Math.max(...attempts.map(a => Math.round((a.score / a.total) * 100)));
          lines.push(`- ${type}: ${first}% → ${last}% (${attempts.length} attempts, best: ${best}%)`);
        } else if (attempts.length === 1) {
          const pct = Math.round((attempts[0].score / attempts[0].total) * 100);
          lines.push(`- ${type}: ${pct}% (1 attempt)`);
        }
      }
    }
    lines.push('');
  }

  // Weak spots & difficulty areas
  if (weakSpots.length > 0) {
    lines.push('## Weak Spots (frequently missed, not yet mastered)');
    for (const w of weakSpots.slice(0, 20)) {
      lines.push(`- "${w.text}" (${w.unitName}) — missed ${w.missCount}x, correct streak: ${w.correctStreak || 0}`);
    }
    if (weakSpots.length > 20) lines.push(`- ...and ${weakSpots.length - 20} more`);
    lines.push('');
  }

  // Shaky concepts
  const shakyConcepts = allCards
    .filter(c => progress[c.id]?.rating === 'shaky')
    .map(c => ({ term: c.term, unit: guide?.units?.find(u => u.cards?.some(uc => uc.id === c.id))?.name || 'Unknown' }));
  if (shakyConcepts.length > 0) {
    lines.push('## Shaky Concepts (partially understood)');
    for (const s of shakyConcepts.slice(0, 20)) {
      lines.push(`- ${s.term} (${s.unit})`);
    }
    if (shakyConcepts.length > 20) lines.push(`- ...and ${shakyConcepts.length - 20} more`);
    lines.push('');
  }

  // Don't-know concepts
  const dontKnowConcepts = allCards
    .filter(c => progress[c.id]?.rating === 'dont-know')
    .map(c => ({ term: c.term, unit: guide?.units?.find(u => u.cards?.some(uc => uc.id === c.id))?.name || 'Unknown' }));
  if (dontKnowConcepts.length > 0) {
    lines.push('## Don\'t Know Yet (needs focused study)');
    for (const d of dontKnowConcepts.slice(0, 20)) {
      lines.push(`- ${d.term} (${d.unit})`);
    }
    if (dontKnowConcepts.length > 20) lines.push(`- ...and ${dontKnowConcepts.length - 20} more`);
    lines.push('');
  }

  lines.push('---');
  lines.push('Use this summary to personalize your coaching. Focus on my weak spots and shaky concepts. Suggest study strategies based on my score trends and which units need the most work.');

  return lines.join('\n');
}

function BigToolCard({ icon: Icon, label, desc, meta, badge, badgeColor, color, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
        disabled
          ? 'opacity-30 cursor-not-allowed bg-bg-tertiary border-border'
          : 'bg-bg-secondary border-border hover:border-accent/30 hover:bg-bg-hover cursor-pointer'
      }`}
    >
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-text-primary">{label}</p>
          {badge && <span className={`text-[10px] font-semibold ${badgeColor || 'text-accent'}`}>{badge}</span>}
        </div>
        <p className="text-xs text-text-muted">{desc}</p>
      </div>
      {meta && <span className="text-[10px] text-text-muted font-num shrink-0">{meta}</span>}
    </button>
  );
}

function ToolCard({ icon: Icon, label, desc, meta, color, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
        disabled
          ? 'opacity-30 cursor-not-allowed bg-bg-tertiary border-border'
          : 'bg-bg-secondary border-border hover:border-accent/30 hover:bg-bg-hover cursor-pointer'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-sm font-semibold text-text-primary leading-tight">{label}</p>
      <p className="text-xs text-text-secondary leading-tight">{desc}</p>
      {meta && <span className="text-[10px] text-text-muted font-num mt-0.5">{meta}</span>}
    </button>
  );
}
