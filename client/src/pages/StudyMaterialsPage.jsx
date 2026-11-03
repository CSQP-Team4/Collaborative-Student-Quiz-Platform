import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from './dashboards/DashboardLayout';
import materialService from '../services/materialService';

const SUBJECTS = [
  'All subjects',
  'Operating Systems',
  'Database Management Systems',
  'Computer Networks',
  'Data Structures',
  'Software Engineering',
];

export default function StudyMaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All subjects');

  // Upload modal state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubject, setUploadSubject] = useState('Operating Systems');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedSubject !== 'All subjects') params.subject = selectedSubject;
      const data = await materialService.listMaterials(params);
      setMaterials(data);
    } catch {
      setError('Could not load study materials. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedSubject]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMaterials();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchMaterials]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    setUploadSubmitting(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle);
      formData.append('subject', uploadSubject);
      if (uploadTags.trim()) formData.append('tags', uploadTags);

      await materialService.uploadMaterial(formData);
      setUploadSuccess('Material uploaded successfully!');
      setUploadTitle('');
      setUploadTags('');
      setUploadFile(null);
      setIsUploading(false);
      fetchMaterials();
    } catch (err) {
      setUploadError(
        err.response?.data?.message || 'Upload failed. File must be PDF, DOCX, or PPTX under 25MB.'
      );
    } finally {
      setUploadSubmitting(false);
    }
  }

  return (
    <DashboardLayout
      title="Study materials"
      intro="Search, preview, and download peer-reviewed notes, cheat sheets, and summaries."
    >
      <div className="materials-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="material-search" className="sr-only">
              Search notes
            </label>
            <input
              id="material-search"
              type="search"
              placeholder="Search by title, topic, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label htmlFor="subject-filter" className="sr-only">
              Filter by subject
            </label>
            <select
              id="subject-filter"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="field-input"
              style={{ height: '40px' }}
            >
              {SUBJECTS.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setIsUploading(!isUploading);
            setUploadError('');
            setUploadSuccess('');
          }}
        >
          {isUploading ? 'Cancel upload' : '+ Upload notes'}
        </button>
      </div>

      {uploadSuccess && (
        <div className="alert-box alert-success" role="status" style={{ marginBottom: '16px' }}>
          {uploadSuccess}
        </div>
      )}

      {/* Upload Drawer / Form */}
      {isUploading && (
        <div className="panel" style={{ marginBottom: '24px', border: '1px solid var(--accent)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 16px' }}>
            Upload study material (PDF, DOCX, PPTX up to 25MB)
          </h2>
          {uploadError && (
            <div className="alert-box alert-error" role="alert" style={{ marginBottom: '16px' }}>
              {uploadError}
            </div>
          )}
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="upload-title" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>
                  Document title *
                </label>
                <input
                  id="upload-title"
                  type="text"
                  required
                  placeholder="e.g. Virtual Memory Summary"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="field-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="upload-subject" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>
                  Subject *
                </label>
                <select
                  id="upload-subject"
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  className="field-input"
                  style={{ width: '100%', height: '40px' }}
                >
                  {SUBJECTS.filter((s) => s !== 'All subjects').map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="upload-tags" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>
                  Tags (comma-separated)
                </label>
                <input
                  id="upload-tags"
                  type="text"
                  placeholder="paging, memory, lru"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="field-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="upload-file" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>
                Select document file (.pdf, .docx, .pptx) *
              </label>
              <input
                id="upload-file"
                type="file"
                required
                accept=".pdf,.docx,.pptx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={uploadSubmitting}>
                {uploadSubmitting ? 'Uploading…' : 'Publish material'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsUploading(false)}
                disabled={uploadSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <p role="status" className="page-status">
          Loading materials…
        </p>
      )}

      {!loading && error && (
        <div className="alert-box alert-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={fetchMaterials} style={{ marginTop: '8px' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && materials.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
            No study materials found matching your filters.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearch('');
              setSelectedSubject('All subjects');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && !error && materials.length > 0 && (
        <ul className="card-grid" style={{ listStyle: 'none', padding: 0 }}>
          {materials.map((mat) => (
            <li key={mat._id} className="card-item">
              <div className="card-header">
                <span className="pill pill-ok" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                  {mat.subject}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {new Date(mat.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h2 className="card-title" style={{ fontSize: '1rem', marginTop: '8px' }}>
                {mat.title}
              </h2>
              {mat.tags && mat.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '8px 0' }}>
                  {mat.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        background: 'var(--surface-raised)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <p className="card-description" style={{ fontSize: '0.85rem' }}>
                Uploaded by {mat.uploadedBy?.name || 'Classmate'}
              </p>
              <div className="card-footer" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => materialService.downloadFile(mat.fileUrl, `${mat.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)}
                  style={{ width: '100%', textAlign: 'center', minHeight: '36px', fontSize: '0.85rem' }}
                >
                  Download / View notes
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardLayout>
  );
}
