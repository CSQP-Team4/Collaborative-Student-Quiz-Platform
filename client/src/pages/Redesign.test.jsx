// Frontend redesign (CSQP-33): app shell navigation and the Quizzes page.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import quizService from '../services/quizService';
import { adminUser, apiError, instructorUser, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/quizService', () => ({
  default: { listQuizzes: vi.fn(), getQuiz: vi.fn(), startAttempt: vi.fn(), recordAntiCheatEvent: vi.fn(), submitAttempt: vi.fn() },
}));

const as = (user) => makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });
const sidebarLinks = async () =>
  within(await screen.findByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .map((a) => a.textContent);

const QUIZZES = {
  quizzes: [
    { id: 'q1', title: 'Data Structures Basics', subject: 'Data Structures', description: 'Lists and trees.', duration: 10, questionCount: 5, instructor: 'Demo Instructor' },
    { id: 'q2', title: 'OS Fundamentals', subject: 'Operating Systems', description: '', duration: 15, questionCount: 5, instructor: 'Demo Instructor' },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('App shell navigation', () => {
  it('shows each role only its own pages, and no pages that are not built yet', async () => {
    const { unmount } = renderApp('/student', as(studentUser));
    expect(await sidebarLinks()).toEqual(['Home', 'Quizzes', 'My progress', 'Leaderboard', 'Profile settings']);
    unmount();

    const second = renderApp('/instructor', as(instructorUser));
    expect(await sidebarLinks()).toEqual(['Home', 'Class analytics', 'Leaderboard']);
    second.unmount();

    renderApp('/admin', as(adminUser));
    expect(await sidebarLinks()).toEqual(['Home', 'Uptime report', 'Class analytics', 'Leaderboard']);
  });

  it('marks the current page in the sidebar', async () => {
    quizService.listQuizzes.mockResolvedValue(QUIZZES);
    renderApp('/quizzes', as(studentUser));
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Quizzes' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('dashboard tiles without a page say "Coming soon" and are not links', async () => {
    renderApp('/student', as(studentUser));
    const main = await screen.findByRole('main');
    expect(within(main).queryByRole('link', { name: 'Study materials' })).not.toBeInTheDocument();
    expect(within(main).getByText('Study materials')).toBeInTheDocument();
    expect(within(main).getAllByText('Coming soon')).toHaveLength(2);
    expect(within(main).getByRole('link', { name: 'Quizzes' })).toHaveAttribute('href', '/quizzes');
  });

  it('logs out from the top bar', async () => {
    const user = userEvent.setup();
    const service = as(studentUser);
    renderApp('/student', service);
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(service.logout).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Quizzes page', () => {
  it('lists published quizzes from the API with a start link for each', async () => {
    quizService.listQuizzes.mockResolvedValue(QUIZZES);
    renderApp('/quizzes', as(studentUser));

    const cards = within(await screen.findByRole('main')).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('heading', { name: 'Data Structures Basics' })).toBeInTheDocument();
    expect(cards[0]).toHaveTextContent('10 min');
    expect(within(cards[0]).getByRole('link', { name: 'Start quiz: Data Structures Basics' })).toHaveAttribute('href', '/quiz/q1');
    expect(cards[1]).toHaveTextContent('No description provided.');
  });

  it('is reachable from the student dashboard', async () => {
    const user = userEvent.setup();
    quizService.listQuizzes.mockResolvedValue(QUIZZES);
    renderApp('/student', as(studentUser));
    await user.click(within(await screen.findByRole('main')).getByRole('link', { name: 'Quizzes' }));
    expect(await screen.findByRole('heading', { name: 'Available quizzes', level: 1 })).toBeInTheDocument();
  });

  it('shows empty and error states', async () => {
    quizService.listQuizzes.mockResolvedValueOnce({ quizzes: [] });
    const { unmount } = renderApp('/quizzes', as(studentUser));
    expect(await screen.findByText('No quizzes have been published yet.')).toBeInTheDocument();
    unmount();

    quizService.listQuizzes.mockRejectedValueOnce(apiError(500));
    renderApp('/quizzes', as(studentUser));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load quizzes');
  });

  it('"Back to dashboard" goes to the right home for the role', async () => {
    quizService.listQuizzes.mockResolvedValue(QUIZZES);
    renderApp('/quizzes', as(adminUser));
    expect(await screen.findByRole('link', { name: '← Back to dashboard' })).toHaveAttribute('href', '/admin');
  });

  it('is not available to instructors (they cannot start attempts)', async () => {
    renderApp('/quizzes', as(instructorUser));
    expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
    expect(quizService.listQuizzes).not.toHaveBeenCalled();
  });
});

describe('Starting a quiz (StrictMode)', () => {
  it('sends ONE start-attempt request even though React runs the effect twice', async () => {
    const { StrictMode } = await import('react');
    const { render } = await import('@testing-library/react');
    const { MemoryRouter, Route, Routes } = await import('react-router-dom');
    const AuthProvider = (await import('../auth/AuthProvider')).default;
    const QuizAttemptPage = (await import('./QuizAttemptPage')).default;
    quizService.startAttempt.mockResolvedValue({
      attempt: {
        id: 'att1', quizId: 'q1', quizTitle: 'Data Structures Basics', duration: 10, status: 'in_progress',
        startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 600000).toISOString(),
        questions: [{ question: 'qa', text: 'Pick one', type: 'MCQ', options: ['A', 'B'] }],
      },
    });
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/quiz/q1']}>
          <AuthProvider service={as(studentUser)}>
            <Routes>
              <Route path="/quiz/:quizId" element={<QuizAttemptPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByRole('radiogroup', { name: 'Pick one' })).toBeInTheDocument();
    expect(quizService.startAttempt).toHaveBeenCalledTimes(1);
  });
});
