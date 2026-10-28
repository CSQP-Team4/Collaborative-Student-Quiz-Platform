import { useEffect, useState, useCallback, useRef } from 'react';
import quizService from '../services/quizService';

/**
 * useAntiCheat Hook (CSQP-23 / SAD 3.9)
 *
 * Implements client-side proctoring and anti-cheat enforcement:
 * 1. Blocks clipboard interactions (copy, cut, paste).
 * 2. Blocks context menu (right click).
 * 3. Detects tab switching via document.visibilityState.
 * 4. Detects window defocusing via window.blur.
 * 5. Dispatches telemetry violations to POST /api/attempts/:id/anti-cheat.
 * 6. Local warning tracking: 3 violations flags attempt for instructor review.
 */
export function useAntiCheat({ attemptId, enabled = true, onViolation } = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [isFlagged, setIsFlagged] = useState(false);
  const [lastViolation, setLastViolation] = useState(null);
  const countRef = useRef(0);

  const reportViolation = useCallback(
    async (type, details = {}) => {
      if (!attemptId || !enabled) return;

      countRef.current += 1;
      const currentCount = countRef.current;
      setViolationCount(currentCount);
      setLastViolation({ type, timestamp: new Date().toISOString() });

      if (currentCount >= 3) {
        setIsFlagged(true);
      }

      if (typeof onViolation === 'function') {
        onViolation({ type, details, count: currentCount });
      }

      try {
        const res = await quizService.recordAntiCheatEvent(attemptId, { type, details });
        if (res?.isFlaggedForReview) {
          setIsFlagged(true);
        }
      } catch (err) {
        console.warn('Anti-cheat event dispatch error:', err?.message);
      }
    },
    [attemptId, enabled, onViolation]
  );

  useEffect(() => {
    if (!enabled || !attemptId) return;

    const handleCopy = (e) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', { action: 'copy' });
    };

    const handleCut = (e) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', { action: 'cut' });
    };

    const handlePaste = (e) => {
      e.preventDefault();
      reportViolation('CLIPBOARD_ATTEMPT', { action: 'paste' });
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('TAB_SWITCH', { action: 'tab_hidden' });
      }
    };

    const handleBlur = () => {
      reportViolation('WINDOW_BLUR', { action: 'window_blur' });
    };

    window.addEventListener('copy', handleCopy);
    window.addEventListener('cut', handleCut);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, attemptId, reportViolation]);

  return {
    violationCount,
    isFlagged,
    lastViolation,
    reportViolation,
  };
}

export default useAntiCheat;
