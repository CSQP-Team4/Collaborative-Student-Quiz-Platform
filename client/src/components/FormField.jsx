import { forwardRef } from 'react';

// Labelled input with an accessible error message (WCAG 2.1 AA, CSQP-NF-004):
// the error is linked with aria-describedby and the input marked aria-invalid.
const FormField = forwardRef(function FormField(
  { id, label, error, hint, type = 'text', ...inputProps },
  ref,
) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      <input
        ref={ref}
        id={id}
        name={id}
        type={type}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
});

export default FormField;
