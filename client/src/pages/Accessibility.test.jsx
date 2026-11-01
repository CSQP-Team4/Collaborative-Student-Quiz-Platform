// CSQP-33 / CSQP-NF-004 (TC-UX-01): every core screen passes axe-core's
// WCAG 2.1 AA checks and the key keyboard / screen-reader behaviour works.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import analyticsService from '../services/analyticsService';
import leaderboardService from '../services/leaderboardService';
import opsService from '../services/opsService';
import quizService from '../services/quizService';
import { axeViolations } from '../test/axe';
import { adminUser, instructorUser, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/analyticsService', () => ({
  default: { getMyPerformance: vi.fn(), getClassAnalytics: vi.fn(), exportMyPerformance: vi.fn(), exportClassAnalytics: vi.fn() },
}));
vi.mock('../services/leaderboardService', () => ({
  default: { getLeaderboard: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn() },
}));
vi.mock('../services/opsService', () => ({ default: { getUptimeReport: vi.fn(), scheduleMaintenance: vi.fn() } }));
vi.mock('../services/quizService', () => ({
  default: { getQuiz: vi.fn(), startAttempt: vi.fn(), recordAntiCheatEvent: vi.fn(), submitAttempt: vi.fn() },
}));

const as = (user) => makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });

const ATTEMPT = {
  attempt: {
    id: 'att1', quizId: 'q1', quizTitle: 'Data Structures Basics', duration: 10, status: 'in_progress',
    startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 600000).toISOString(),
    questions: [
      { question: 'qa', text: 'Which traversal visits a BST in order?', type: 'MCQ', options: ['Inorder', 'Preorder'] },
      { question: 'qb', text: 'Is a heap a complete tree?', type: 'TRUE_FALSE', options: ['True', 'False'] },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  analyticsService.getMyPerformance.mockResolvedValue({
    attemptsCompleted: 1, averageScore: 80, bestScore: 80, latestScore: 80,
    scoreTrend: [{ attemptId: 'a', quizTitle: 'Quiz', date: '2026-10-20T10:00:00Z', percentage: 80 }],
    history: [{ attemptId: 'a', quizId: 'q', quizTitle: 'Quiz', subject: 'DSA', submittedAt: '2026-10-20T10:00:00Z', score: 4, totalQuestions: 5, percentage: 80 }],
    topics: [{ topic: 'Trees', answered: 5, correct: 4, mastery: 0.8, status: 'strength' }], strengths: ['Trees'], weaknesses: [],
  });
  analyticsService.getClassAnalytics.mockResolvedValue({
    totalStudents: 3,
    quizzes: [{ quizId: 'q', title: 'Quiz', subject: 'DSA', questionCount: 5, totalStudents: 3, participants: 2, participationRate: 0.67,
      totalAttempts: 2, averageScore: 70, highestScore: 80, lowestScore: 60,
      mostMissedQuestions: [{ questionId: 'x', text: 'What is BFS?', topic: 'Graphs', attempted: 2, missed: 1, correctRate: 0.5 }] }],
  });
  leaderboardService.getLeaderboard.mockResolvedValue({
    options: { quizzes: [{ id: 'q', title: 'Quiz', subject: 'DSA' }], subjects: ['DSA'] }, scope: 'quiz', selectedId: 'q', label: 'Quiz',
    viewerOptedIn: true, entries: [{ rank: 1, name: 'Asha Rao', score: 80, quizzes: 1, attempts: 1, isYou: true }],
  });
  leaderboardService.getSettings.mockResolvedValue(false);
  opsService.getUptimeReport.mockResolvedValue({
    target: 99.5, intervalSeconds: 60, latest: { checkedAt: '2026-10-30T10:00:00Z', ok: true, responseMs: 5 },
    months: [{ month: '2026-10', checks: 100, healthy: 100, failed: 0, excluded: 0, availability: 100, meetsTarget: true, downtimeMinutes: 0, allowedDowntimeMinutes: 223.2 }],
    incidents: [], maintenance: [],
  });
  quizService.startAttempt.mockResolvedValue(ATTEMPT);
});

const SCREENS = [
  ['login page', '/login', undefined, { name: 'Log in' }],
  ['register page', '/register', undefined, { name: 'Create your account' }],
  ['verify email page', '/verify-email?email=a%40pes.edu', undefined, { name: 'Verify your email' }],
  ['forgot password page', '/forgot-password', undefined, { name: 'Reset your password' }],
  ['student dashboard', '/student', studentUser, { name: /Welcome/ }],
  ['my progress', '/student/progress', studentUser, { name: 'Quiz history' }],
  ['leaderboard', '/leaderboard', studentUser, { name: 'Quiz', level: 2 }],
  ['profile settings', '/student/settings', studentUser, { name: 'Leaderboard', level: 2 }],
  ['quiz attempt', '/quiz/q1', studentUser, { name: 'Data Structures Basics', level: 1 }],
  ['instructor dashboard', '/instructor', instructorUser, { name: /Welcome/ }],
  ['class analytics', '/instructor/analytics', instructorUser, { name: 'Quiz', level: 2 }],
  ['admin dashboard', '/admin', adminUser, { name: /Welcome/ }],
  ['uptime report', '/admin/uptime', adminUser, { name: 'Monthly availability' }],
];

describe('WCAG 2.1 AA automated checks (CSQP-33)', () => {
  it.each(SCREENS)('%s has no axe violations', async (_label, route, user, heading) => {
    const { container } = renderApp(route, user ? as(user) : undefined);
    await screen.findByRole('heading', heading);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('every page has exactly one h1', async () => {
    for (const [, route, user, heading] of SCREENS) {
      const { unmount } = renderApp(route, user ? as(user) : undefined);
      await screen.findByRole('heading', heading);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      unmount();
    }
  });
});

describe('Keyboard and screen-reader behaviour (CSQP-33)', () => {
  it('the login form can be completed with the keyboard only', async () => {
    const user = userEvent.setup();
    const service = makeService({ login: vi.fn().mockResolvedValue({ accessToken: 't', user: studentUser }) });
    renderApp('/login', service);
    await screen.findByRole('heading', { name: 'Log in' });

    await user.tab();
    expect(screen.getByLabelText('College email')).toHaveFocus();
    await user.keyboard('asha@pes.edu');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('Password1{Enter}');
    expect(service.login).toHaveBeenCalledWith({ email: 'asha@pes.edu', password: 'Password1' });
  });

  it('dashboards offer a "Skip to main content" link as the first Tab stop', async () => {
    const user = userEvent.setup();
    renderApp('/student', as(studentUser));
    await screen.findByRole('heading', { name: /Welcome/ });
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content').tagName).toBe('MAIN');
  });

  it('quiz answers are a named radio group that works with arrow keys', async () => {
    const user = userEvent.setup();
    renderApp('/quiz/q1', as(studentUser));
    const group = await screen.findByRole('radiogroup', { name: 'Which traversal visits a BST in order?' });
    const [first, second] = within(group).getAllByRole('radio');

    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    expect(second).toBeChecked();
  });

  it('the quiz timer is exposed as a timer, and buttons are real buttons', async () => {
    renderApp('/quiz/q1', as(studentUser));
    const timer = await screen.findByRole('timer');
    expect(timer).toHaveAccessibleName(/Time remaining \d\d:\d\d/);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
