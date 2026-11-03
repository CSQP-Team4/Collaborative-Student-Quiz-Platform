import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ExportButtons from '../components/ExportButtons';
import ScoreTrendChart from '../components/ScoreTrendChart';
import analyticsService from '../services/analyticsService';
import DashboardLayout from './dashboards/DashboardLayout';

const STATUS_LABEL = { strength: 'Strength', average: 'Getting there', weakness: 'Needs work' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function errorMessage(error) {
  if (error?.response?.status === 503) {
    return 'Analytics are temporarily unavailable. Please try again in a moment.';
  }
  return 'Could not load your progress. Check your connection and try again.';
}

// CSQP-27 / CSQP-F-040: quiz history, score trend and topic-wise strengths.
export default function StudentProgressPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Starts in the loading state, so the first fetch needs no setState up front.
  const fetchSummary = useCallback(() => {
    analyticsService
      .getMyPerformance()
      .then(setSummary)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchSummary, [fetchSummary]);

  function retry() {
    setLoading(true);
    setError('');
    fetchSummary();
  }

  return (
    <DashboardLayout
      title="My progress"
      intro="Your quiz history, score trend and topic strengths."
    >
      <div className="page-actions">
        <Link to="/student">← Back to dashboard</Link>
        {!loading && !error && summary && (
          <ExportButtons onExport={(format) => analyticsService.exportMyPerformance(format)} />
        )}
      </div>

      {loading && (
        <p role="status" className="page-status">
          Loading your progress…
        </p>
      )}

      {!loading && error && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && summary && summary.attemptsCompleted === 0 && (
        <p className="empty-state">
          You haven&apos;t completed any quizzes yet. Your progress will appear here after your
          first quiz.
        </p>
      )}

      {!loading && !error && summary?.attemptsCompleted > 0 && (
        <>
          <ul className="stat-row" aria-label="Summary">
            <li className="stat">
              <span className="stat-value">{summary.attemptsCompleted}</span>
              <span className="stat-label">Quizzes completed</span>
            </li>
            <li className="stat">
              <span className="stat-value">{summary.averageScore}%</span>
              <span className="stat-label">Average score</span>
            </li>
            <li className="stat">
              <span className="stat-value">{summary.bestScore}%</span>
              <span className="stat-label">Best score</span>
            </li>
            <li className="stat">
              <span className="stat-value">{summary.latestScore}%</span>
              <span className="stat-label">Latest score</span>
            </li>
          </ul>

          <section className="panel" aria-labelledby="trend-heading">
            <h2 id="trend-heading">Score trend</h2>
            <ScoreTrendChart points={summary.scoreTrend} />
          </section>

          <section className="panel" aria-labelledby="topics-heading">
            <h2 id="topics-heading">Topics</h2>
            {summary.weaknesses.length > 0 && (
              <p className="topic-tip">
                Study next: <strong>{summary.weaknesses.join(', ')}</strong>
              </p>
            )}
            <ul className="topic-list">
              {summary.topics.map((t) => (
                <li key={t.topic} className={`topic topic-${t.status}`}>
                  <div className="topic-head">
                    <span className="topic-name">{t.topic}</span>
                    <span className="topic-status">{STATUS_LABEL[t.status]}</span>
                  </div>
                  <div
                    className="topic-bar"
                    role="progressbar"
                    aria-label={`${t.topic} mastery`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(t.mastery * 100)}
                  >
                    <span style={{ width: `${Math.round(t.mastery * 100)}%` }} />
                  </div>
                  <span className="topic-meta">
                    {t.correct} of {t.answered} correct ({Math.round(t.mastery * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Quiz history</h2>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Quiz</th>
                    <th scope="col" className="col-optional">Subject</th>
                    <th scope="col">Date</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.history.map((h) => (
                    <tr key={h.attemptId}>
                      <td>{h.quizTitle}</td>
                      <td className="col-optional">{h.subject}</td>
                      <td>{formatDate(h.submittedAt)}</td>
                      <td>
                        {h.score}/{h.totalQuestions} ({h.percentage}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
