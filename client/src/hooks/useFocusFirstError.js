import { useCallback } from 'react';

// After a failed submit, move keyboard focus to the first invalid field so
// keyboard and screen-reader users land on the problem.
export default function useFocusFirstError(fieldOrder, refs) {
  return useCallback(
    (errors) => {
      const first = fieldOrder.find((name) => errors[name]);
      if (first) refs[first]?.current?.focus();
    },
    [fieldOrder, refs],
  );
}
