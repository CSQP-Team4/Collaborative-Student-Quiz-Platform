import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import leaderboardService from '../services/leaderboardService';
import DashboardLayout from './dashboards/DashboardLayout';

// CSQP-29 / CSQP-F-042: profile settings with the leaderboard opt-in toggle.
export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    leaderboardService
      .getSettings()
      .then(setOptIn)
      .catch(() => setError('Could not load your settings. Please refresh the page.'));
  }, []);

  async function handleToggle(event) {
    const next = event.target.checked;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const result = await leaderboardService.updateSettings(next);
      setOptIn(result.optIn);
      setStatus(result.message);
    } catch {
      setError('Could not save your choice. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout title="Profile settings" intro={`${user?.name || ''} · ${user?.email || ''}`}>
      <div className="page-actions">
        <Link to="/student">← Back to dashboard</Link>
      </div>

      <section className="panel" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Leaderboard</h2>
        {optIn === null && !error && <p role="status">Loading…</p>}
        {optIn !== null && (
          <label className="switch-row" htmlFor="leaderboard-opt-in">
            <input
              id="leaderboard-opt-in"
              type="checkbox"
              role="switch"
              checked={optIn}
              disabled={saving}
              onChange={handleToggle}
            />
            <span>
              <strong>Show me on the leaderboard</strong>
              <span className="field-hint">
                Your name and best scores are visible to classmates and instructors. Off by
                default; you can turn it off again at any time.
              </span>
            </span>
          </label>
        )}
        {status && (
          <p className="notice notice-success" role="status">
            {status} <Link to="/leaderboard">View leaderboard</Link>
          </p>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </DashboardLayout>
  );
}
