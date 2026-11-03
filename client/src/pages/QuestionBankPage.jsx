import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from './dashboards/DashboardLayout';
import questionService from '../services/questionService';

const SUBJECT_TABS = [
  'All',
  'Operating Systems',
  'Computer Networks',
  'Database Management Systems',
  'Software Engineering',
  'Data Structures',
];

export default function QuestionBankPage() {
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Import state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');

  function loadQuestions() {
    setLoading(true);
    setError('');
    const params = {};
    if (selectedSubject !== 'All') {
      params.subject = selectedSubject;
    }
    if (search.trim()) {
      params.search = search.trim();
    }

    questionService
      .listQuestions(params)
      .then((data) => setQuestions(data || []))
      .catch(() => setError('Failed to load question bank.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQuestions();
  }, [selectedSubject]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadQuestions();
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a CSV or XLSX file to import.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadNotice('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await questionService.importQuestions(formData);
      setUploadNotice(
        `Successfully imported ${res.importedCount || res.count || 'new'} questions!`
      );
      setUploadFile(null);
      // Reset input
      const fileInput = document.getElementById('csv-file-input');
      if (fileInput) fileInput.value = '';
      loadQuestions();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Import failed. Check CSV format.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardLayout
      title="Question Bank & Import"
      intro="Manage subject questions, browse question pools, or bulk import questions from CSV / Excel."
    >
      <div className="page-actions" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/instructor" className="btn btn-secondary">
          ← Back to dashboard
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/instructor/create-quiz" className="btn btn-primary">
            + Create Quiz
          </Link>
          <a
            href={questionService.getExportUrl('csv')}
            download="questions.csv"
            className="btn btn-secondary"
          >
            Export All (CSV)
          </a>
        </div>
      </div>

      {/* CSV / Excel Import Card */}
      <section className="panel" style={{ marginBottom: '24px' }}>
        <h2>Bulk Import Questions (CSV / Excel)</h2>
        <p className="panel-sub" style={{ marginBottom: '14px' }}>
          Upload a <code>.csv</code> or <code>.xlsx</code> file with headers: <code>type, text, options, answer, subject, topic, difficulty</code>.
          You can test using <code>docs/sample_questions_for_import.csv</code>.
        </p>

        {uploadError && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '12px' }}>
            {uploadError}
          </div>
        )}
        {uploadNotice && (
          <div className="notice notice-success" role="status" style={{ marginBottom: '12px' }}>
            {uploadNotice}
          </div>
        )}

        <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => setUploadFile(e.target.files[0] || null)}
            style={{
              padding: '8px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={uploading || !uploadFile}>
            {uploading ? 'Importing…' : 'Upload & Import Questions'}
          </button>
        </form>
      </section>

      {/* Filters and Tabs */}
      <section className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {/* Subject Tab Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SUBJECT_TABS.map((sub) => (
              <button
                key={sub}
                type="button"
                className={`btn ${selectedSubject === sub ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setSelectedSubject(sub)}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Search box */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search question text or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '13px',
                width: '240px',
              }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {loading && <p role="status">Loading question bank…</p>}

        {!loading && questions.length === 0 && (
          <p className="field-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
            No questions found for this subject filter.
          </p>
        )}

        {!loading && questions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {questions.length} questions
            </span>
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text)' }}>
                    {idx + 1}. {q.text}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background:
                          q.difficulty === 'hard'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : q.difficulty === 'medium'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(34, 197, 94, 0.2)',
                        color:
                          q.difficulty === 'hard'
                            ? '#fca5a5'
                            : q.difficulty === 'medium'
                            ? '#fcd34d'
                            : '#86efac',
                      }}
                    >
                      {q.difficulty}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: 'rgba(96, 165, 250, 0.2)',
                        color: '#93c5fd',
                      }}
                    >
                      {q.type}
                    </span>
                  </div>
                </div>

                {q.options && q.options.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '8px',
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} style={{ color: 'var(--text-secondary)' }}>
                        • {opt}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Subject: <strong style={{ color: 'var(--text-secondary)' }}>{q.subject}</strong></span>
                  <span>Topic: <strong style={{ color: 'var(--text-secondary)' }}>{q.topic}</strong></span>
                  <span>Status: <strong style={{ color: q.status === 'approved' ? '#86efac' : '#fcd34d' }}>{q.status}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
