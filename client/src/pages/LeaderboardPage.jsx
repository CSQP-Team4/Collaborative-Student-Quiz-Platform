import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import leaderboardService from '../services/leaderboardService';
import DashboardLayout from './dashboards/DashboardLayout';

function errorMessage(error) {
  if (error?.response?.status === 503) {
    return 'The leaderboard is temporarily unavailable. Please try again in a moment.';
  }
  return 'Could not load the leaderboard. Check your connection and try again.';
}

// CSQP-29 / CSQP-F-042: opt-in leaderboard per quiz or per subject.
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState('quiz');
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBoard = useCallback((nextScope, nextId) => {
    leaderboardService
      .getLeaderboard({ scope: nextScope, id: nextId || undefined })
      .then((result) => {
        setData(result);
        setSelectedId(result.selectedId || '');
        setError('');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => fetchBoard('quiz', ''), [fetchBoard]);

  function load(nextScope, nextId) {
    setLoading(true);
    setScope(nextScope);
    setSelectedId(nextId);
    fetchBoard(nextScope, nextId);
  }

  const choices =
    scope === 'quiz'
      ? (data?.options.quizzes || []).map((q) => ({ value: q.id, label: q.title }))
      : (data?.options.subjects || []).map((s) => ({ value: s, label: s }));
  const back = user?.role === 'student' ? '/student' : '/';

  return (
    <DashboardLayout title="Leaderboard" intro="Only students who choose to appear are listed.">
      <div className="page-actions">
        <Link to={back}>← Back to dashboard</Link>
      </div>

      {data?.viewerOptedIn === false && (
        <p className="notice notice-info">
          You&apos;re hidden from the leaderboard.{' '}
          <Link to="/student/settings">Change this in profile settings</Link>.
        </p>
      )}
      {data?.viewerOptedIn === true && (
        <p className="panel-sub">
          You appear on the leaderboard. <Link to="/student/settings">Hide me</Link>
        </p>
      )}

      <div className="panel leaderboard-controls">
        <div className="segmented" role="group" aria-label="Rank by">
          {[
            ['quiz', 'Per quiz'],
            ['subject', 'Per subject'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={scope === value ? 'segment segment-on' : 'segment'}
              aria-pressed={scope === value}
              onClick={() => scope !== value && load(value, '')}
            >
              {label}
            </button>
          ))}
        </div>
        {choices.length > 0 && (
          <div className="field leaderboard-select">
            <label htmlFor="leaderboard-choice">{scope === 'quiz' ? 'Quiz' : 'Subject'}</label>
            <select
              id="leaderboard-choice"
              value={selectedId}
              onChange={(e) => load(scope, e.target.value)}
            >
              {choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <p role="status" className="page-status">
          Loading leaderboard…
        </p>
      )}

      {!loading && error && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => load(scope, selectedId)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && data.entries.length === 0 && (
        <p className="empty-state">
          {choices.length === 0
            ? 'There are no published quizzes yet.'
            : 'No one on the leaderboard for this yet. Scores appear here once students who opted in submit this quiz.'}
        </p>
      )}

      {!loading && !error && data?.entries.length > 0 && (
        <section className="panel" aria-labelledby="board-heading">
          <h2 id="board-heading">{data.label}</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Student</th>
                  <th scope="col">{scope === 'quiz' ? 'Best score' : 'Avg. best score'}</th>
                  <th scope="col" className="col-optional">
                    {scope === 'quiz' ? 'Attempts' : 'Quizzes'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={`${e.rank}-${e.name}`} className={e.isYou ? 'row-you' : undefined}>
                    <td>{e.rank}</td>
                    <td>
                      {e.name}
                      {e.isYou && <span className="you-badge">You</span>}
                    </td>
                    <td>{e.score}%</td>
                    <td className="col-optional">{scope === 'quiz' ? e.attempts : e.quizzes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
