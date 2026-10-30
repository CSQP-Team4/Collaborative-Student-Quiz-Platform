import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import quizService from '../services/quizService';
import useAntiCheat from '../hooks/useAntiCheat';

export default function QuizAttemptPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflictAttemptId, setConflictAttemptId] = useState(null);

  const [attempt, setAttempt] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const isAttemptActive = Boolean(attempt && attempt.status === 'in_progress' && !submissionResult);

  // Anti-Cheat Engine (CSQP-23 / SAD 3.9)
  const { violationCount, isFlagged, lastViolation } = useAntiCheat({
    attemptId: attempt?.id,
    enabled: isAttemptActive,
  });

  // Start or check attempt on mount
  useEffect(() => {
    let isMounted = true;

    async function initAttempt() {
      try {
        setLoading(true);
        setError(null);
        setConflictAttemptId(null);
        const data = await quizService.startAttempt(quizId);
        if (isMounted) {
          setAttempt(data.attempt);
          initTimer(data.attempt);
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.response?.status === 409) {
          // CSQP-24: Single active attempt concurrency lock
          setConflictAttemptId(err.response?.data?.activeAttemptId || true);
          setError('An active session already exists for this quiz. Parallel attempts are blocked.');
        } else {
          setError(err.response?.data?.message || 'Failed to start quiz attempt.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (quizId) {
      initAttempt();
    }

    return () => {
      isMounted = false;
    };
  }, [quizId]);

  const initTimer = (attemptData) => {
    if (!attemptData?.endsAt) return;
    const ends = new Date(attemptData.endsAt).getTime();
    const now = Date.now();
    const remainingSecs = Math.max(0, Math.floor((ends - now) / 1000));
    setTimeLeft(remainingSecs);
  };

  // Timer countdown
  useEffect(() => {
    if (!isAttemptActive || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isAttemptActive, timeLeft]);

  // CSQP-33 (WCAG 2.2.1 / 4.1.3): announce time milestones to screen-reader users.
  const timeAnnouncement = useMemo(() => {
    const milestones = { 300: '5 minutes remaining.', 60: '1 minute remaining.', 10: '10 seconds remaining.' };
    return milestones[timeLeft] || '';
  }, [timeLeft]);

  const formattedTime = useMemo(() => {
    if (timeLeft === null) return '--:--';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const handleResume = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await quizService.startAttempt(quizId, { resume: true });
      setAttempt(data.attempt);
      initTimer(data.attempt);
      setConflictAttemptId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume existing attempt.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionId, option) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSubmit = async () => {
    if (!attempt?.id || submitting || submissionResult) return;

    try {
      setSubmitting(true);
      const responses = Object.entries(selectedAnswers).map(([question, selectedOption]) => ({
        question,
        selectedOption,
      }));

      const res = await quizService.submitAttempt(attempt.id, responses);
      setSubmissionResult(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="quiz-page" role="status">
        <p className="page-status">Loading quiz attempt…</p>
      </div>
    );
  }

  // Conflict state (CSQP-24)
  if (conflictAttemptId) {
    return (
      <div className="quiz-page">
        <div className="quiz-card conflict-card">
          <h1 className="text-danger">Active Attempt in Progress</h1>
          <p className="alert-message">{error}</p>
          <p className="text-muted">
            The anti-cheat concurrency lock blocks opening multiple tabs or starting parallel
            sessions. You may resume your active attempt.
          </p>
          <div className="quiz-actions">
            <button className="btn btn-primary" onClick={handleResume}>
              Resume Active Attempt
            </button>
            <Link to="/student" className="btn btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div className="quiz-page">
        <div className="quiz-card">
          <h1>Quiz Error</h1>
          <p className="error-message">{error}</p>
          <Link to="/student" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Submission results
  if (submissionResult) {
    const { score, totalQuestions, percentage, isFlaggedForReview } = submissionResult;
    return (
      <div className="quiz-page">
        <div className="quiz-card results-card">
          <h1>Quiz Completed</h1>
          <p className="results-subtitle">Your responses have been graded.</p>

          <div className="score-summary">
            <div className="score-metric">
              <span className="metric-label">Score</span>
              <span className="metric-value">
                {score} / {totalQuestions}
              </span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Percentage</span>
              <span className="metric-value">{percentage}%</span>
            </div>
          </div>

          {isFlaggedForReview && (
            <div className="flagged-banner" role="alert">
              <strong>Notice:</strong> Your attempt was flagged for review due to recorded
              telemetry violations during the session.
            </div>
          )}

          <div className="quiz-actions">
            <Link to="/student" className="btn btn-primary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const questions = attempt?.questions || [];
  const currentQuestion = questions[currentIdx];

  return (
    <div className="quiz-page anti-cheat-locked" style={{ userSelect: 'none' }}>
      <header className="quiz-header">
        <div className="quiz-header-left">
          <span className="brand">CSQP QUIZ</span>
          <h1>{attempt?.quizTitle || 'Quiz'}</h1>
        </div>
        <div className="quiz-header-right">
          {/* CSQP-33: role="timer" so screen readers can find the countdown; it is
              not read out every second, only the milestones announced below. */}
          <div
            className={`timer-badge ${timeLeft !== null && timeLeft < 120 ? 'timer-warning' : ''}`}
            role="timer"
            aria-label={`Time remaining ${formattedTime}`}
          >
            <span aria-hidden="true">⏱ </span>
            {formattedTime}
          </div>
          <p className="sr-only" aria-live="assertive">
            {timeAnnouncement}
          </p>
        </div>
      </header>

      {/* Anti-Cheat Warning Banners (CSQP-23) */}
      {isFlagged ? (
        <div className="anti-cheat-banner alert-flagged" role="alert">
          <span aria-hidden="true">⚠️ </span>
          <strong>Security Notice:</strong> Multiple violations detected (violation count:{' '}
          {violationCount}). This attempt has been flagged for instructor review.
        </div>
      ) : violationCount > 0 ? (
        <div className="anti-cheat-banner alert-warning" role="alert">
          <span aria-hidden="true">⚠️ </span>
          <strong>Anti-Cheat Warning:</strong> Tab switching and clipboard operations are
          monitored ({violationCount}/3 violations).
        </div>
      ) : null}

      <main className="quiz-body">
        {currentQuestion && (
          <div className="question-card">
            <div className="question-meta">
              <span>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className="question-badge">{currentQuestion.difficulty || 'Medium'}</span>
            </div>

            <h2 className="question-text" id="question-text">
              {currentQuestion.text}
            </h2>

            <div className="options-list" role="radiogroup" aria-labelledby="question-text">
              {currentQuestion.options?.map((opt, idx) => {
                const isSelected = selectedAnswers[currentQuestion.question] === opt;
                return (
                  <label
                    key={idx}
                    className={`option-item ${isSelected ? 'option-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.question}`}
                      checked={isSelected}
                      onChange={() => handleOptionSelect(currentQuestion.question, opt)}
                    />
                    <span className="option-text">{opt}</span>
                  </label>
                );
              })}
            </div>

            <div className="question-nav">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
              >
                Previous
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentIdx((i) => i + 1)}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-submit"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting…' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
