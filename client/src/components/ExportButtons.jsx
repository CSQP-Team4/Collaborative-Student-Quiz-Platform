import { useState } from 'react';
import { saveFile } from '../utils/saveFile';

const FORMATS = [
  { id: 'pdf', label: 'Download PDF' },
  { id: 'csv', label: 'Download CSV' },
];

// CSQP-30 / CSQP-F-043: export the report on screen as PDF or CSV.
// `onExport(format)` must resolve to { blob, filename }.
export default function ExportButtons({ onExport }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function handleExport(format) {
    setBusy(format);
    setError('');
    try {
      const { blob, filename } = await onExport(format);
      saveFile(blob, filename);
    } catch (err) {
      setError(
        err?.response?.status === 503
          ? 'Export is temporarily unavailable. Please try again in a moment.'
          : 'Could not create the file. Please try again.',
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="export-buttons">
      <div className="export-row" role="group" aria-label="Export report">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="btn btn-secondary"
            onClick={() => handleExport(f.id)}
            disabled={Boolean(busy)}
          >
            {busy === f.id ? 'Preparing…' : f.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
