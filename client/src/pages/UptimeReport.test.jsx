import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import opsService from '../services/opsService';
import { adminUser, apiError, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/opsService', () => ({
  default: { getUptimeReport: vi.fn(), scheduleMaintenance: vi.fn() },
}));

const REPORT = {
  target: 99.5,
  intervalSeconds: 60,
  latest: { checkedAt: '2026-10-30T14:00:00Z', ok: true, statusCode: 200, responseMs: 12, error: '' },
  months: [
    { month: '2026-10', checks: 1000, healthy: 996, failed: 4, excluded: 20, availability: 99.6, meetsTarget: true, downtimeMinutes: 4, allowedDowntimeMinutes: 223.2 },
    { month: '2026-09', checks: 1000, healthy: 990, failed: 10, excluded: 0, availability: 99, meetsTarget: false, downtimeMinutes: 10, allowedDowntimeMinutes: 216 },
  ],
  incidents: [{ start: '2026-10-12T10:05:00Z', end: '2026-10-12T10:09:00Z', durationMinutes: 4, failedChecks: 4, error: 'HTTP 500', ongoing: false }],
  maintenance: [{ id: 'm1', start: '2026-11-02T20:00:00Z', end: '2026-11-02T21:00:00Z', reason: 'Database upgrade', excludedFromTarget: true }],
};
const loggedInAs = (user) => makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });

beforeEach(() => vi.clearAllMocks());

describe('Uptime report (CSQP-35)', () => {
  it('is linked from the admin dashboard and shows status, monthly availability vs target and incidents', async () => {
    const user = userEvent.setup();
    opsService.getUptimeReport.mockResolvedValue(REPORT);
    renderApp('/admin', loggedInAs(adminUser));

    await user.click(await screen.findByRole('link', { name: 'Uptime report' }));
    expect(await screen.findByText('Operational')).toBeInTheDocument();

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('99.6%');
    expect(rows[1]).toHaveTextContent('Met');
    expect(rows[1]).toHaveTextContent('996 of 1000 (+20 in maintenance)');
    expect(rows[1]).toHaveTextContent('4 of 223.2 min allowed');
    expect(rows[2]).toHaveTextContent('99%');
    expect(rows[2]).toHaveTextContent('Missed');

    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
    expect(screen.getByText(/Database upgrade/)).toBeInTheDocument();
  });

  it('explains how to start the monitor when there is no data yet', async () => {
    opsService.getUptimeReport.mockResolvedValue({ ...REPORT, latest: null, months: [], incidents: [], maintenance: [] });
    renderApp('/admin/uptime', loggedInAs(adminUser));
    expect(await screen.findByText(/No checks recorded yet/)).toHaveTextContent('npm run monitor');
    expect(screen.getByText('No downtime recorded in this period.')).toBeInTheDocument();
  });

  it('shows a down status with the error', async () => {
    opsService.getUptimeReport.mockResolvedValue({
      ...REPORT,
      latest: { checkedAt: '2026-10-30T14:00:00Z', ok: false, statusCode: null, responseMs: 3, error: 'Unreachable: ECONNREFUSED' },
    });
    renderApp('/admin/uptime', loggedInAs(adminUser));
    expect(await screen.findByText('Down')).toBeInTheDocument();
    expect(screen.getByText(/Unreachable: ECONNREFUSED/)).toBeInTheDocument();
  });

  it('schedules maintenance at least 24 hours ahead', async () => {
    const user = userEvent.setup();
    opsService.getUptimeReport.mockResolvedValue(REPORT);
    opsService.scheduleMaintenance.mockResolvedValue({});
    renderApp('/admin/uptime', loggedInAs(adminUser));

    const pad = (n) => String(n).padStart(2, '0');
    const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const start = new Date(Date.now() + 48 * 3600e3);
    const end = new Date(start.getTime() + 3600e3);

    await user.type(await screen.findByLabelText('Start'), local(start));
    await user.type(screen.getByLabelText('End'), local(end));
    await user.type(screen.getByLabelText('Reason'), 'Patch MongoDB');
    await user.click(screen.getByRole('button', { name: 'Schedule maintenance' }));

    expect(opsService.scheduleMaintenance).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Patch MongoDB' }));
    expect(opsService.getUptimeReport).toHaveBeenCalledTimes(2); // refreshed after scheduling
  });

  it('blocks maintenance with less than 24 hours notice', async () => {
    const user = userEvent.setup();
    opsService.getUptimeReport.mockResolvedValue(REPORT);
    renderApp('/admin/uptime', loggedInAs(adminUser));

    const pad = (n) => String(n).padStart(2, '0');
    const soon = new Date(Date.now() + 2 * 3600e3);
    const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    await user.type(await screen.findByLabelText('Start'), local(soon));
    await user.type(screen.getByLabelText('End'), local(new Date(soon.getTime() + 3600e3)));
    await user.type(screen.getByLabelText('Reason'), 'Too soon');
    await user.click(screen.getByRole('button', { name: 'Schedule maintenance' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('at least 24 hours');
    expect(opsService.scheduleMaintenance).not.toHaveBeenCalled();
  });

  it('handles load errors', async () => {
    opsService.getUptimeReport.mockRejectedValue(apiError(500));
    renderApp('/admin/uptime', loggedInAs(adminUser));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the uptime report');
  });

  it('is only for admins', async () => {
    renderApp('/admin/uptime', loggedInAs(studentUser));
    expect(await screen.findByText(/student dashboard/i)).toBeInTheDocument();
    expect(opsService.getUptimeReport).not.toHaveBeenCalled();
  });
});
