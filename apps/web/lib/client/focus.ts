'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Find = () => HTMLElement | null | undefined;

/**
 * Moves keyboard focus once the next render is on screen (WCAG 2.4.3, A3-01, A3-11, A3-13). For a
 * press that takes away the control it came from (Accept, Remove, a confirm form that closes),
 * `focusAfter(() => element)` names where focus goes instead of letting it fall to `<body>`. The
 * element is looked up after React has rendered, so it can be one the same update creates.
 */
export function useFocusAfter() {
  const pending = useRef<Find | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const find = pending.current;
    pending.current = null;
    if (tick > 0) find?.()?.focus();
  }, [tick]);
  return useCallback((find: Find) => {
    pending.current = find;
    setTick((n) => n + 1);
  }, []);
}
