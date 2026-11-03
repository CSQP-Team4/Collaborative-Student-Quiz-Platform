import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import leaderboardService from '../services/leaderboardService';
import userService from '../services/userService';
import DashboardLayout from './dashboards/DashboardLayout';

// CSQP-29 / CSQP-F-042: profile settings with student details, password change, and leaderboard opt-in toggle.
export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Student profile form state
  const [name, setName] = useState(user?.name || '');
  const [usn, setUsn] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState(5);
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdStatus, setPwdStatus] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    leaderboardService
      .getSettings()
      .then(setOptIn)
      .catch(() => setError('Could not load your settings. Please refresh the page.'));

    userService
      .getProfile()
      .then((profile) => {
        if (profile) {
          setName(profile.name || user?.name || '');
          setUsn(profile.usn || '');
          setDepartment(profile.department || 'Computer Science & Engineering');
          setSemester(profile.semester || 5);
          setBio(profile.bio || '');
        }
      })
      .catch(() => {
        // Fallback gracefully to auth user
        setName(user?.name || '');
      });
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

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileStatus('');
    setProfileError('');
    try {
      await userService.updateProfile({
        name,
        usn,
        department,
        semester: Number(semester),
        bio,
      });
      setProfileStatus('Profile information updated successfully.');
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwdStatus('');
    setPwdError('');

    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await userService.changePassword({ currentPassword, newPassword });
      setPwdStatus('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError(err.response?.data?.message || err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <DashboardLayout title="Profile settings" intro={`${user?.name || ''} · ${user?.email || ''}`}>
      <div className="page-actions" style={{ marginBottom: '16px' }}>
        <Link to="/student" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
        {/* Student Personal Info */}
        <section className="panel" aria-labelledby="profile-heading">
          <h2 id="profile-heading">Student Information</h2>
          <p className="panel-sub" style={{ marginBottom: '14px' }}>
            Update your academic details and public profile information.
          </p>

          {profileStatus && (
            <p className="notice notice-success" role="status" style={{ marginBottom: '12px' }}>
              {profileStatus}
            </p>
          )}
          {profileError && (
            <p className="notice notice-error" role="alert" style={{ marginBottom: '12px' }}>
              {profileError}
            </p>
          )}

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label htmlFor="student-name" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="student-usn" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                  USN (University Seat No.)
                </label>
                <input
                  id="student-usn"
                  type="text"
                  placeholder="e.g. 1PE22CS001"
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontFamily: 'var(--mono)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label htmlFor="student-dept" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                  Department
                </label>
                <input
                  id="student-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="student-sem" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                  Semester
                </label>
                <select
                  id="student-sem"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="student-bio" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Bio / Learning Goals
              </label>
              <textarea
                id="student-bio"
                rows="2"
                placeholder="What subjects are you focusing on this semester?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving profile…' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password Panel */}
        <section className="panel" aria-labelledby="security-heading">
          <h2 id="security-heading">Account Security</h2>
          <p className="panel-sub" style={{ marginBottom: '14px' }}>
            Change your account password securely (salted bcrypt hashing).
          </p>

          {pwdStatus && (
            <p className="notice notice-success" role="status" style={{ marginBottom: '12px' }}>
              {pwdStatus}
            </p>
          )}
          {pwdError && (
            <p className="notice notice-error" role="alert" style={{ marginBottom: '12px' }}>
              {pwdError}
            </p>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
            <div>
              <label htmlFor="curr-pwd" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Current Password
              </label>
              <input
                id="curr-pwd"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label htmlFor="new-pwd" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                New Password (min 8 chars)
              </label>
              <input
                id="new-pwd"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label htmlFor="confirm-pwd" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <input
                id="confirm-pwd"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <button type="submit" className="btn btn-secondary" disabled={changingPassword}>
                {changingPassword ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>

        {/* Leaderboard Opt-In Switch (CSQP-29 / CSQP-F-042) */}
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
      </div>
    </DashboardLayout>
  );
}
