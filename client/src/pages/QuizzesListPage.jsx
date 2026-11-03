import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homeFor } from '../auth/roles';
import quizService from '../services/quizService';
import DashboardLayout from './dashboards/DashboardLayout';

// Published quizzes a student can start (frontend redesign). Until now the
// only way to open a quiz was to type its /quiz/:id URL.
export default function QuizzesListPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    quizService
      .listQuizzes()
      .then((res) => setQuizzes(res.quizzes || []))
      .catch((err) =>
        setError(err?.response?.data?.message || 'Could not load quizzes. Check your connection and try again.'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout
      title="Available quizzes"
      intro="Timed quizzes with randomized questions, anti-cheat monitoring and instant scoring."
    >
      <div className="page-actions">
        <Link to={homeFor(user)}>← Back to dashboard</Link>
      </div>

      {loading && (
        <p role="status" className="page-status">
          Loading quizzes…
        </p>
      )}

      {!loading && error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && quizzes.length === 0 && (
        <p className="empty-state">No quizzes have been published yet.</p>
      )}

      {!loading && !error && quizzes.length > 0 && (
        <ul className="quiz-list-grid">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="quiz-card-item panel">
              <div>
                <div className="quiz-badge-row">
                  <span className="role-tag">{quiz.subject || 'General'}</span>
                  <span className="time-tag">{quiz.duration} min</span>
                </div>
                <h2 className="quiz-card-title">{quiz.title}</h2>
                <p className="quiz-card-desc">{quiz.description || 'No description provided.'}</p>
              </div>

              <dl className="quiz-card-meta">
                <div>
                  <dt className="meta-label">QUESTIONS</dt>
                  <dd className="meta-val">{quiz.questionCount || 0}</dd>
                </div>
                <div>
                  <dt className="meta-label">INSTRUCTOR</dt>
                  <dd className="meta-val">{quiz.instructor || 'Instructor'}</dd>
                </div>
              </dl>

              <Link
                to={`/quiz/${quiz.id}`}
                className="btn btn-primary quiz-start"
                aria-label={`Start quiz: ${quiz.title}`}
              >
                Start quiz
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardLayout>
  );
}
