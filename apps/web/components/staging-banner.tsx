import { deploy } from '@universityflow/content';

/**
 * On every page of a staging site (UF_DEPLOYMENT=staging): a test copy, never to be taken for the
 * real UniversityFlow or given a real learner's details. Static, no motion.
 */
export function StagingBanner({ staging }: { staging: boolean }) {
  if (!staging) return null;
  return (
    <div
      role="note"
      aria-label={deploy.stagingLabel}
      className="border-b border-warning bg-warning-soft px-4 py-2 text-center text-sm text-ink"
    >
      <strong className="font-semibold">{deploy.stagingLabel}</strong> {deploy.stagingNotice}
    </div>
  );
}
