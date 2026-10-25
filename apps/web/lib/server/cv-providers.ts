import 'server-only';
import type { CvEngine } from '@universityflow/cv';

/**
 * The live CV engines, by the name `UF_CV_PROVIDER` selects (docs/design/mmereko-api-proposal.md
 * §6.3, §10.2). Each one passes `cvEngineContract` (`@universityflow/cv/contract`) against its
 * real service before it is listed here (D8).
 *
 * Empty on purpose: the Mmereko adapter (`mmereko.ts`) is written and tested against a local fake
 * of Mmereko's API, but it joins this list only after it passes the contract against Mmereko's
 * sandbox, which needs the owner's sandbox credentials. Until then `UF_CV=1` with live providers
 * refuses to start, naming the missing adapter, rather than fall back to the stand-in.
 */
export type CvAdapter = (env: Record<string, string | undefined>) => CvEngine;

export const CV_ADAPTERS: Readonly<Record<string, CvAdapter>> = {};
