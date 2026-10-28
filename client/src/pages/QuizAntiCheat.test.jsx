import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderApp, makeService, studentUser } from '../test/renderWithAuth';
import quizService from '../services/quizService';

vi.mock('../services/quizService', () => ({
  quizService: {
    startAttempt: vi.fn(),
    recordAntiCheatEvent: vi.fn(),
    submitAttempt: vi.fn(),
  },
  default: {
    startAttempt: vi.fn(),
    recordAntiCheatEvent: vi.fn(),
    submitAttempt: vi.fn(),
  },
}));

describe('CSQP-23 & CSQP-24: Frontend Anti-Cheat & Single Attempt (TC-Att-03, TC-Att-04)', () => {
  const mockQuizId = 'quiz_abc123';
  const mockAttempt = {
    id: 'attempt_xyz789',
    quizId: mockQuizId,
    quizTitle: 'CS101 Fundamentals',
    duration: 30,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: 'in_progress',
    questions: [
      {
        question: 'q1',
        text: 'What is the time complexity of binary search?',
        options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'],
        difficulty: 'Easy',
      },
      {
        question: 'q2',
        text: 'Which protocol is connection-oriented?',
        options: ['TCP', 'UDP', 'DNS', 'ICMP'],
        difficulty: 'Medium',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const loggedInStudentService = () =>
    makeService({
      refresh: vi.fn().mockResolvedValue({
        accessToken: 'mock_token',
        user: studentUser,
      }),
    });

  describe('CSQP-24: Single Active Attempt Concurrency Lock', () => {
    it('displays 409 conflict message and allows student to resume active attempt', async () => {
      const user = userEvent.setup();
      const conflictError = Object.assign(new Error('Active attempt exists'), {
        response: {
          status: 409,
          data: {
            error: 'ACTIVE_ATTEMPT_EXISTS',
            message: 'An active attempt is already in progress for this quiz.',
            activeAttemptId: 'attempt_xyz789',
          },
        },
      });

      quizService.startAttempt.mockRejectedValueOnce(conflictError);
      quizService.startAttempt.mockResolvedValueOnce({
        attempt: mockAttempt,
        resumed: true,
      });

      renderApp(`/quiz/${mockQuizId}`, loggedInStudentService());

      // Verify 409 banner
      expect(await screen.findByText('Active Attempt in Progress')).toBeInTheDocument();
      expect(
        screen.getByText(/The anti-cheat concurrency lock blocks opening multiple tabs/)
      ).toBeInTheDocument();

      // Click resume button
      const resumeBtn = screen.getByRole('button', { name: 'Resume Active Attempt' });
      await user.click(resumeBtn);

      expect(quizService.startAttempt).toHaveBeenCalledWith(mockQuizId, { resume: true });
      expect(await screen.findByText('What is the time complexity of binary search?')).toBeInTheDocument();
    });
  });

  describe('CSQP-23: Anti-Cheat Protection & Telemetry Enforcement', () => {
    it('intercepts copy/cut/paste and tab switching, sending telemetry and showing warning banner', async () => {
      quizService.startAttempt.mockResolvedValue({ attempt: mockAttempt });
      quizService.recordAntiCheatEvent.mockResolvedValue({ success: true, count: 1 });

      renderApp(`/quiz/${mockQuizId}`, loggedInStudentService());

      expect(
        await screen.findByText('What is the time complexity of binary search?')
      ).toBeInTheDocument();

      // 1. Simulate copy attempt
      fireEvent.copy(window);
      expect(quizService.recordAntiCheatEvent).toHaveBeenCalledWith(
        'attempt_xyz789',
        expect.objectContaining({ type: 'CLIPBOARD_ATTEMPT' })
      );

      // Warning banner appears
      expect(await screen.findByText(/Anti-Cheat Warning:/)).toBeInTheDocument();

      // 2. Simulate tab switch (document visibility hidden)
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      fireEvent(document, new Event('visibilitychange'));

      expect(quizService.recordAntiCheatEvent).toHaveBeenCalledWith(
        'attempt_xyz789',
        expect.objectContaining({ type: 'TAB_SWITCH' })
      );

      // 3. Simulate 3rd violation triggering flag
      quizService.recordAntiCheatEvent.mockResolvedValueOnce({
        success: true,
        isFlaggedForReview: true,
        count: 3,
      });
      fireEvent(window, new Event('blur'));

      expect(await screen.findByText(/This attempt has been flagged for instructor review/)).toBeInTheDocument();
    });

    it('allows navigating questions, selecting options, and submitting quiz', async () => {
      const user = userEvent.setup();
      quizService.startAttempt.mockResolvedValue({ attempt: mockAttempt });
      quizService.submitAttempt.mockResolvedValue({
        success: true,
        score: 2,
        totalQuestions: 2,
        percentage: 100,
        status: 'completed',
        isFlaggedForReview: false,
      });

      renderApp(`/quiz/${mockQuizId}`, loggedInStudentService());

      expect(
        await screen.findByText('What is the time complexity of binary search?')
      ).toBeInTheDocument();

      // Select option on Question 1
      const q1Option = screen.getByLabelText('O(log n)');
      await user.click(q1Option);
      expect(q1Option).toBeChecked();

      // Click Next
      await user.click(screen.getByRole('button', { name: 'Next' }));

      // Question 2
      expect(await screen.findByText('Which protocol is connection-oriented?')).toBeInTheDocument();
      const q2Option = screen.getByLabelText('TCP');
      await user.click(q2Option);
      expect(q2Option).toBeChecked();

      // Submit
      await user.click(screen.getByRole('button', { name: 'Submit Quiz' }));

      expect(quizService.submitAttempt).toHaveBeenCalledWith('attempt_xyz789', [
        { question: 'q1', selectedOption: 'O(log n)' },
        { question: 'q2', selectedOption: 'TCP' },
      ]);

      expect(await screen.findByText('Quiz Completed')).toBeInTheDocument();
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
