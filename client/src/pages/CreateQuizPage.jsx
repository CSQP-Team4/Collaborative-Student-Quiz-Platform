import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from './dashboards/DashboardLayout';
import quizService from '../services/quizService';
import questionService from '../services/questionService';

const SUBJECTS = [
  'Operating Systems',
  'Computer Networks',
  'Database Management Systems',
  'Software Engineering',
  'Data Structures',
];

export default function CreateQuizPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(15);
  const [attemptCap, setAttemptCap] = useState(1);
  const [selectionMode, setSelectionMode] = useState('random');
  const [questionCount, setQuestionCount] = useState(5);
  const [isPublished, setIsPublished] = useState(true);

  // Manual selection state
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Fetch subject questions if manual mode is chosen
  useEffect(() => {
    if (selectionMode === 'manual') {
      setLoadingQuestions(true);
      questionService
        .listQuestions({ subject })
        .then((data) => {
          setAvailableQuestions(data || []);
          // Preselect first few if none selected yet
          if (selectedIds.length === 0 && data?.length > 0) {
            setSelectedIds(data.slice(0, Math.min(5, data.length)).map((q) => q.id));
          }
        })
        .catch(() => setError('Failed to load questions for the selected subject.'))
        .finally(() => setLoadingQuestions(false));
    }
  }, [selectionMode, subject]);

  function handleToggleQuestion(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!title.trim()) {
      setError('Quiz title is required.');
      return;
    }

    if (selectionMode === 'manual' && selectedIds.length === 0) {
      setError('Please select at least one question for manual quiz assembly.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subject,
        description: description.trim(),
        duration: parseInt(duration, 10),
        attemptCap: parseInt(attemptCap, 10),
        selectionMode,
        isPublished,
      };

      if (selectionMode === 'random') {
        payload.questionCount = parseInt(questionCount, 10);
      } else {
        payload.questionIds = selectedIds;
      }

      const res = await quizService.createQuiz(payload);
      setStatus(`Quiz "${res.quiz.title}" created successfully!`);
      setTimeout(() => {
        navigate('/quizzes');
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create quiz.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      title="Create Quiz"
      intro="Assemble a new quiz by selecting approved questions or randomizing from the question bank."
    >
      <div className="page-actions" style={{ marginBottom: '16px' }}>
        <Link to="/instructor" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
      </div>

      <section className="panel" style={{ maxWidth: '800px' }}>
        <h2>Quiz Details</h2>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {status && (
          <div className="notice notice-success" role="status" style={{ marginBottom: '16px' }}>
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="quiz-title" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
              Quiz Title *
            </label>
            <input
              id="quiz-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems Midterm Quiz"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="quiz-subject" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Subject *
              </label>
              <select
                id="quiz-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quiz-duration" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Duration (minutes) *
              </label>
              <input
                id="quiz-duration"
                type="number"
                min="1"
                max="180"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label htmlFor="quiz-attempts" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Attempt Cap *
              </label>
              <input
                id="quiz-attempts"
                type="number"
                min="1"
                max="10"
                value={attemptCap}
                onChange={(e) => setAttemptCap(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="quiz-description" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              id="quiz-description"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide test instructions, topics covered, or scoring details..."
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
              Question Selection Method
            </span>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="selectionMode"
                  value="random"
                  checked={selectionMode === 'random'}
                  onChange={() => setSelectionMode('random')}
                />
                Random Sample from Bank
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="selectionMode"
                  value="manual"
                  checked={selectionMode === 'manual'}
                  onChange={() => setSelectionMode('manual')}
                />
                Manual Question Selection
              </label>
            </div>
          </div>

          {selectionMode === 'random' ? (
            <div>
              <label htmlFor="quiz-count" style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Number of Random Questions *
              </label>
              <input
                id="quiz-count"
                type="number"
                min="1"
                max="50"
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                style={{
                  width: '200px',
                  padding: '10px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                }}
              />
              <span className="field-hint" style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Questions will be randomly sampled from approved {subject} questions.
              </span>
            </div>
          ) : (
            <div>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '6px' }}>
                Select Questions ({selectedIds.length} selected)
              </span>
              {loadingQuestions && <p role="status">Loading available questions…</p>}
              {!loadingQuestions && availableQuestions.length === 0 && (
                <p className="field-hint">No approved questions found for {subject}.</p>
              )}
              {!loadingQuestions && availableQuestions.length > 0 && (
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {availableQuestions.map((q) => (
                    <label
                      key={q.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px',
                        background: selectedIds.includes(q.id) ? 'var(--surface-raised)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(q.id)}
                        onChange={() => handleToggleQuestion(q.id)}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div>{q.text}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Topic: {q.topic} · Difficulty: {q.difficulty} · Type: {q.type}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <strong>Publish immediately</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Makes quiz immediately visible on student Quizzes page)
              </span>
            </label>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating quiz…' : 'Create & Assemble Quiz'}
            </button>
          </div>
        </form>
      </section>
    </DashboardLayout>
  );
}
