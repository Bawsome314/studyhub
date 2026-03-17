import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Clock, AlertCircle } from 'lucide-react';
import ResultsSummary from './ResultsSummary';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

export default function QuizEngine({
  courseCode,
  courseName,
  type, // 'Pre-Test' | 'Mini OA' | 'Practice OA'
  questions,
  timerMinutes, // null = no timer
  onExit,
  onSaveResult,
  onRecordMiss,
  onRecordCorrect,
  deferReveal = false, // true = don't show answers until end (Practice OA)
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerMinutes ? timerMinutes * 60 : null);
  const savedRef = useRef(false);
  const recordedRef = useRef(false);

  // Timer
  useEffect(() => {
    if (timeLeft === null || finished) return;
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, finished]);

  const q = questions[currentIndex];
  const answered = answers[q?.id] !== undefined;
  const showReveal = !deferReveal && answered;
  const canAdvance = showReveal || (deferReveal && answered);

  useKeyboardShortcuts({
    '1': () => { if (!showReveal) selectAnswer(0); },
    '2': () => { if (!showReveal && q?.choices?.length > 1) selectAnswer(1); },
    '3': () => { if (!showReveal && q?.choices?.length > 2) selectAnswer(2); },
    '4': () => { if (!showReveal && q?.choices?.length > 3) selectAnswer(3); },
    'Enter': () => { if (canAdvance) nextQuestion(); },
  });

  const finishQuiz = useCallback(() => {
    setFinished(true);
  }, []);

  function selectAnswer(choiceIndex) {
    if (answers[q.id] !== undefined && !deferReveal) return;
    if (deferReveal && answers[q.id] !== undefined) {
      // In deferred mode, allow changing answer
      setAnswers(prev => ({ ...prev, [q.id]: choiceIndex }));
      setSelectedChoice(choiceIndex);
      return;
    }
    setSelectedChoice(choiceIndex);
    setAnswers(prev => ({ ...prev, [q.id]: choiceIndex }));
    if (!deferReveal) {
      setShowExplanation(true);
    }
  }

  function nextQuestion() {
    setSelectedChoice(null);
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Restore previous answer for this question if exists
      const nextQ = questions[currentIndex + 1];
      if (answers[nextQ.id] !== undefined) {
        setSelectedChoice(answers[nextQ.id]);
      }
    } else {
      finishQuiz();
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      setShowExplanation(false);
      setCurrentIndex(currentIndex - 1);
      const prevQ = questions[currentIndex - 1];
      setSelectedChoice(answers[prevQ.id] ?? null);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Build results
  if (finished) {
    let score = 0;
    const unitMap = {};
    const missed = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctIndex;
      if (isCorrect) score++;

      const unitKey = question.unitName || 'General';
      if (!unitMap[unitKey]) unitMap[unitKey] = { name: unitKey, correct: 0, total: 0 };
      unitMap[unitKey].total++;
      if (isCorrect) unitMap[unitKey].correct++;

      if (!isCorrect) {
        missed.push({
          question: question.question,
          yourAnswer: userAnswer !== undefined ? question.choices[userAnswer] : '(no answer)',
          correctAnswer: question.choices[question.correctIndex],
          explanation: question.explanation,
        });
      }
    }

    // Save result once
    if (onSaveResult && !savedRef.current) {
      savedRef.current = true;
      onSaveResult({ type, score, total: questions.length });
    }

    // Record misses/corrects once
    if (!recordedRef.current) {
      recordedRef.current = true;
      for (const question of questions) {
        const ua = answers[question.id];
        if (ua === question.correctIndex) {
          onRecordCorrect?.(question.id);
        } else {
          onRecordMiss?.(question.id, question.question, question.unitName);
        }
      }
    }

    const reviewQuestions = questions.map(q => ({
      question: q.question,
      choices: q.choices,
      correctIndex: q.correctIndex,
      userAnswer: answers[q.id],
      explanation: q.explanation,
      unitName: q.unitName || 'General',
    }));

    return (
      <ResultsSummary
        courseCode={courseCode}
        courseName={courseName}
        type={type}
        score={score}
        total={questions.length}
        unitBreakdown={Object.values(unitMap)}
        missed={missed}
        reviewQuestions={reviewQuestions}
        onRestart={() => {
          setCurrentIndex(0);
          setAnswers({});
          setSelectedChoice(null);
          setShowExplanation(false);
          setFinished(false);
          setTimeLeft(timerMinutes ? timerMinutes * 60 : null);
          savedRef.current = false;
          recordedRef.current = false;
        }}
        onExit={onExit}
      />
    );
  }

  const isCorrect = answered && answers[q.id] === q.correctIndex;

  return (
    <div className="space-y-4">
      {/* Progress bar + timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span className="font-num">{Object.keys(answers).length}/{questions.length} answered</span>
          </div>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-1.5 text-sm font-num ${timeLeft < 60 ? 'text-danger' : timeLeft < 300 ? 'text-warning' : 'text-text-secondary'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Unit label */}
      {q.unitName && (
        <span className="text-xs text-accent font-medium">{q.unitName}</span>
      )}

      {/* Question */}
      <p className="text-text-primary text-base leading-relaxed">{q.question}</p>

      {/* Choices */}
      <div className="space-y-2">
        {q.choices.map((choice, i) => {
          let style = 'border-border bg-bg-tertiary hover:bg-bg-hover hover:border-accent/30';
          if (showReveal) {
            if (i === q.correctIndex) {
              style = 'border-success bg-success/10';
            } else if (i === answers[q.id] && !isCorrect) {
              style = 'border-danger bg-danger/10';
            } else {
              style = 'border-border bg-bg-tertiary opacity-50';
            }
          } else if (deferReveal && answers[q.id] === i) {
            style = 'border-accent bg-accent-muted';
          } else if (selectedChoice === i) {
            style = 'border-accent bg-accent-muted';
          }

          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              disabled={showReveal}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${style} ${!showReveal ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="font-num text-text-muted mr-3">{String.fromCharCode(65 + i)}.</span>
              <span className="text-text-primary">{choice}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation (non-deferred only) */}
      {showReveal && q.explanation && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${isCorrect ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
          <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isCorrect ? 'text-success' : 'text-danger'}`} />
          <p className="text-text-secondary">{q.explanation}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {deferReveal && currentIndex > 0 ? (
          <button
            onClick={prevQuestion}
            className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            Previous
          </button>
        ) : (
          <div />
        )}

        {(showReveal || (deferReveal && answered)) && (
          <button
            onClick={nextQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {currentIndex < questions.length - 1 ? 'Next' : 'Finish'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {deferReveal && !answered && (
          <button
            onClick={nextQuestion}
            className="px-4 py-2 text-text-muted text-xs hover:text-text-primary transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
