import { useCallback, useState } from 'react';

/** What a status line says, and how many times something has been said (A2-51). */
export interface Said {
  readonly text: string;
  readonly n: number;
}

/**
 * A page's status line (`StatusLine said={…}` in components/ui.tsx): `say(words)` announces an
 * outcome, and saying the same words again announces them again (A2-51, WCAG 4.1.3): each saying
 * is counted, and the line draws each as a new node in the live region. `say('')` falls silent.
 */
export function useStatus(): readonly [Said, (text: string) => void] {
  const [said, setSaid] = useState<Said>({ text: '', n: 0 });
  const say = useCallback((text: string) => setSaid((last) => ({ text, n: last.n + 1 })), []);
  return [said, say] as const;
}
