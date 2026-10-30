import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import opsService from '../services/opsService';
import DashboardLayout from './dashboards/DashboardLayout';

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// <input type="datetime-local"> wants local time without a zone: YYYY-MM-DDTHH:mm
function toLocalInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function MaintenanceForm({ onScheduled }) {
  // Earliest allowed start: 24 h (+5 min margin) from when the form opened.
  const [earliest] = useState(() => toLocalInput(new Date(Date.now() + DAY_MS + 5 * 60000)));
  const [form, setForm] = useState({ start: '', end: '', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.start || !form.end || !form.reason.trim()) {
      setError('Fill in start, end and reason.');
      return;
    }
    const start = new Date(form.start);
    const end = new Date(form.end);
    if (start.getTime() < Date.now() + DAY_MS) {
      setError('Maintenance must be announced at least 24 hours before it starts.');
      return;
    }
    if (end <= start) {
      setError('End must be after start.');
      return;
    }
    setSaving(true);
    try {
      await opsService.scheduleMaintenance({ start: start.toISOString(), end: end.toISOString(), reason: form.reason.trim() });
      setForm({ start: '', end: '', reason: '' });
      onScheduled();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not schedule maintenance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="maintenance-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="mw-start">Start</label>
        <input id="mw-start" name="start" type="datetime-local" min={earliest} value={form.start} onChange={update} />
      </div>
      <div className="field">
        <label htmlFor="mw-end">End</label>
        <input id="mw-end" name="end" type="datetime-local" min={form.start || earliest} value={form.end} onChange={update} />
      </div>
      <div className="field mw-reason">
        <label htmlFor="mw-reason">Reason</label>
        <input id="mw-reason" name="reason" maxLength={200} value={form.reason} onChange={update} placeholder="e.g. Database upgrade" />
      </div>
      <button type="submit" className="btn btn-secondary" disabled={saving}>
        {saving ? 'Scheduling…' : 'Schedule maintenance'}
      </button>
      {error && (
        <p className="field-error mw-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// CSQP-35 / CSQP-NF-002: ops dashboard — availability vs the 99.5% target.
export default function UptimeReportPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(() => {
    opsService
      .getUptimeReport(3)
      .then((r) => {
        setReport(r);
        setError('');
      })
      .catch(() => setError('Could not load the uptime report. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchReport, [fetchReport]);

  function refresh() {
    setLoading(true);
    fetchReport();
  }

  const latest = report?.latest;

  return (
    <DashboardLayout
      title="Uptime report"
      intro={`Target: ${report?.target ?? 99.5}% availability per month, excluding maintenance announced 24 hours ahead.`}
    >
      <div className="page-actions">
        <Link to="/admin">← Back to dashboard</Link>
        {!loading && (
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <p role="status" className="page-status">
          Loading uptime report…
        </p>
      )}
      {!loading && error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && report && (
        <>
          <section className="panel" aria-labelledby="status-heading">
            <h2 id="status-heading">Current status</h2>
            {latest ? (
              <p className={`status-line ${latest.ok ? 'status-up' : 'status-down'}`}>
                <span className="status-dot" aria-hidden="true" />
                <strong>{latest.ok ? 'Operational' : 'Down'}</strong>
                <span className="panel-sub-inline">
                  Last check {fmtDateTime(latest.checkedAt)}
                  {latest.responseMs != null && ` · ${latest.responseMs} ms`}
                  {!latest.ok && latest.error && ` · ${latest.error}`}
                </span>
              </p>
            ) : (
              <p className="empty-state">
                No checks recorded yet. Start the monitor with <code>cd server &amp;&amp; npm run monitor</code>.
              </p>
            )}
            <p className="panel-sub">Checked every {report.intervalSeconds} seconds by the uptime monitor.</p>
          </section>

          {report.months.length > 0 && (
            <section className="panel" aria-labelledby="months-heading">
              <h2 id="months-heading">Monthly availability</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">Availability</th>
                      <th scope="col">Target</th>
                      <th scope="col" className="col-optional">Checks</th>
                      <th scope="col" className="col-optional">Downtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.months.map((m) => (
                      <tr key={m.month}>
                        <td>{fmtMonth(m.month)}</td>
                        <td>{m.availability === null ? '–' : `${m.availability}%`}</td>
                        <td>
                          {m.meetsTarget === null ? (
                            '–'
                          ) : (
                            <span className={m.meetsTarget ? 'pill pill-ok' : 'pill pill-bad'}>
                              {m.meetsTarget ? 'Met' : 'Missed'}
                            </span>
                          )}
                        </td>
                        <td className="col-optional">
                          {m.healthy} of {m.checks}
                          {m.excluded > 0 && ` (+${m.excluded} in maintenance)`}
                        </td>
                        <td className="col-optional">
                          {m.downtimeMinutes} of {m.allowedDowntimeMinutes} min allowed
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="panel" aria-labelledby="incidents-heading">
            <h2 id="incidents-heading">Incidents</h2>
            {report.incidents.length === 0 ? (
              <p className="panel-sub">No downtime recorded in this period.</p>
            ) : (
              <ul className="incident-list">
                {report.incidents.map((i) => (
                  <li key={i.start}>
                    <strong>{fmtDateTime(i.start)}</strong> – {i.ongoing ? 'ongoing' : fmtDateTime(i.end)} ·{' '}
                    {i.durationMinutes} min · {i.error}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="mw-heading">
            <h2 id="mw-heading">Planned maintenance</h2>
            {report.maintenance.length > 0 && (
              <ul className="incident-list">
                {report.maintenance.map((w) => (
                  <li key={w.id}>
                    <strong>{fmtDateTime(w.start)}</strong> – {fmtDateTime(w.end)} · {w.reason}
                    {!w.excludedFromTarget && ' (announced late: counts as downtime)'}
                  </li>
                ))}
              </ul>
            )}
            <MaintenanceForm onScheduled={refresh} />
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
