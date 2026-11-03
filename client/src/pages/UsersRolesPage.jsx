import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from './dashboards/DashboardLayout';
import userService from '../services/userService';

const ROLES = ['student', 'instructor', 'admin'];

export default function UsersRolesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  function loadUsers() {
    setLoading(true);
    setError('');
    userService
      .getUsers()
      .then((data) => setUsers(data || []))
      .catch(() => setError('Failed to load registered accounts.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleRoleChange(userId, newRole) {
    setUpdatingId(userId);
    setError('');
    setNotice('');
    try {
      const res = await userService.updateUserRole(userId, newRole);
      setNotice(res.message || 'Role updated successfully.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update user role.';
      setError(msg);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.usn && u.usn.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout
      title="Users & Roles Management"
      intro="View registered university accounts and manage role-based authorization (Student, Instructor, Admin)."
    >
      <div className="page-actions" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/admin" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
        <div>
          <input
            type="text"
            placeholder="Search by name, email, or USN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '13px',
              width: '260px',
            }}
          />
        </div>
      </div>

      <section className="panel">
        <h2>Registered Accounts ({filteredUsers.length})</h2>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {notice && (
          <div className="notice notice-success" role="status" style={{ marginBottom: '16px' }}>
            {notice}
          </div>
        )}

        {loading && <p role="status">Loading accounts…</p>}

        {!loading && filteredUsers.length === 0 && (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            No accounts matching search.
          </p>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">USN & Dept</th>
                  <th scope="col">Status</th>
                  <th scope="col">Current Role</th>
                  <th scope="col">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {u.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--mono)' }}>
                        {u.usn || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {u.department ? `${u.department} (Sem ${u.semester})` : '—'}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: u.isVerified ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: u.isVerified ? '#86efac' : '#fcd34d',
                        }}
                      >
                        {u.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background:
                            u.role === 'admin'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : u.role === 'instructor'
                              ? 'rgba(168, 85, 247, 0.2)'
                              : 'rgba(59, 130, 246, 0.2)',
                          color:
                            u.role === 'admin'
                              ? '#fca5a5'
                              : u.role === 'instructor'
                              ? '#d8b4fe'
                              : '#93c5fd',
                        }}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <select
                        aria-label={`Change role for ${u.name}`}
                        value={u.role}
                        disabled={updatingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text)',
                          fontSize: '12px',
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            Assign {r}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
