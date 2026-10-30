import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import analyticsService from '../services/analyticsService';
import DashboardLayout from './dashboards/DashboardLayout';

const pct = (rate) => `${Math.round(rate * 100)}%`;

function errorMessage(error) {
  if (error?.response?.status === 503) {
    return 'Analytics are temporarily unavailable. Please try again in a moment.';
  }
  return 'Could not load class analytics. Check your connection and try again.';
}

function QuizAnalytics({ quiz }) {
  const headingId = `quiz-${quiz.quizId}`;
  return (
    <section className="panel" aria-labelledby={headingId}>
      <h2 id={headingId}>{quiz.title}</h2>
      <p className="panel-sub">
        {quiz.subject} · {quiz.questionCount} questions
      </p>

      {quiz.participants === 0 ? (
        <p className="empty-state">No students have submitted this quiz yet.</p>
      ) : (
        <>
          <ul className="stat-row" aria-label={`${quiz.title} summary`}>
            <li className="stat">
              <span className="stat-value">{quiz.averageScore}%</span>
              <span className="stat-label">Class average</span>
            </li>
            <li className="stat">
              <span className="stat-value">{pct(quiz.participationRate)}</span>
              <span className="stat-label">
                Participation ({quiz.participants} of {quiz.totalStudents} students)
              </span>
            </li>
            <li className="stat">
              <span className="stat-value">
                {quiz.lowestScore}–{quiz.highestScore}%
              </span>
              <span className="stat-label">Score range</span>
            </li>
            <li className="stat">
              <span className="stat-value">{quiz.totalAttempts}</span>
              <span className="stat-label">Total attempts (incl. retakes)</span>
            </li>
          </ul>

          <h3>Most-missed questions</h3>
          {quiz.mostMissedQuestions.length === 0 ? (
            <p className="panel-sub">Every student answered every question correctly.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col" className="col-optional">
                      Topic
                    </th>
                    <th scope="col">Missed by</th>
                    <th scope="col">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {quiz.mostMissedQuestions.map((q) => (
                    <tr key={q.questionId}>
                      <td className="cell-wrap">{q.text}</td>
                      <td className="col-optional">{q.topic}</td>
                      <td>
                        {q.missed} of {q.attempted}
                      </td>
                      <td>{pct(q.correctRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// CSQP-28 / CSQP-F-041: class average, participation and most-missed questions per quiz.
export default function ClassAnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Starts in the loading state, so the first fetch needs no setState up front.
  const fetchSummary = useCallback(() => {
    analyticsService
      .getClassAnalytics()
      .then(setSummary)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchSummary, [fetchSummary]);

  function refresh() {
    setLoading(true);
    setError('');
    fetchSummary();
  }

  return (
    <DashboardLayout
      title="Class analytics"
      intro="Each student's latest attempt counts once per quiz. Updated after every submission."
    >
      <div className="page-actions">
        <Link to="/">← Back to dashboard</Link>
        {!loading && (
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            {error ? 'Try again' : 'Refresh'}
          </button>
        )}
      </div>

      {loading && (
        <p role="status" className="page-status">
          Loading class analytics…
        </p>
      )}

      {!loading && error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && summary?.quizzes.length === 0 && (
        <p className="empty-state">You haven&apos;t created any quizzes yet.</p>
      )}

      {!loading &&
        !error &&
        summary?.quizzes.map((quiz) => <QuizAnalytics key={quiz.quizId} quiz={quiz} />)}
    </DashboardLayout>
  );
}
