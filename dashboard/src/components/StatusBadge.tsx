import type { TestState } from '../types';

const LABEL: Record<TestState, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
};

/**
 * Status as colour + dot + word — never colour alone, so it stays legible under
 * colour-vision deficiency and in the table view.
 */
export function StatusBadge({ state }: { state: TestState }): JSX.Element {
  return (
    <span className={`badge ${state}`}>
      <span className="dot" />
      {LABEL[state]}
    </span>
  );
}
