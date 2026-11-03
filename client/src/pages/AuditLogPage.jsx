import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from './dashboards/DashboardLayout';
import opsService from '../services/opsService';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    opsService
      .getAuditLogs()
      .then((data) => setLogs(data || []))
      .catch(() => setError('Failed to load audit logs. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const actionTypes = ['ALL', ...new Set(logs.map((l) => l.action))];

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter((l) => l.action === filterAction);

  function getActionBadgeStyle(action) {
    if (action.includes('FAIL') || action.includes('LOCKED')) {
      return { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' };
    }
    if (action.includes('ROLE') || action.includes('PASSWORD')) {
      return { background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d' };
    }
    return { background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' };
  }

  return (
    <DashboardLayout
      title="Security & System Audit Log"
      intro="Immutable audit trail of authentication attempts, account actions, role updates, and resource events (CSQP-11 / CSQP-SR-005)."
    >
      <div className="page-actions" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/admin" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="filter-action" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Filter by Action:
          </label>
          <select
            id="filter-action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '13px',
            }}
          >
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="panel">
        <h2>Audit Trail Events ({filteredLogs.length})</h2>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {loading && <p role="status">Loading audit logs…</p>}

        {!loading && filteredLogs.length === 0 && (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            No audit events found.
          </p>
        )}

        {!loading && filteredLogs.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Action</th>
                  <th scope="col">User</th>
                  <th scope="col">IP Address</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(log.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: 'var(--mono)',
                          ...getActionBadgeStyle(log.action),
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.user ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{log.user.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {log.user.email} ({log.user.role})
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>System / Anonymous</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {log.resource || '—'}
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '300px' }}>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: '11px',
                          fontFamily: 'var(--mono)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {JSON.stringify(log.details)}
                      </pre>
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
