'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * Whether Read aloud is offered on this page (owner's choice of 2026-10-22: ElevenLabs only). The
 * signed-in layout knows whether the server has an ElevenLabs voice and says so here; anywhere it
 * doesn't, there is no Read aloud button, and never a browser voice instead.
 */
const ReadAloudContext = createContext(false);

export function ReadAloudProvider({
  available,
  children,
}: {
  available: boolean;
  children: ReactNode;
}) {
  return <ReadAloudContext.Provider value={available}>{children}</ReadAloudContext.Provider>;
}

export function useReadAloud(): boolean {
  return useContext(ReadAloudContext);
}
