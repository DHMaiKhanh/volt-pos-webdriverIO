/** Shown before the first run has been recorded. */
export function EmptyState(): JSX.Element {
  return (
    <div className="empty">
      <h2>No runs yet</h2>
      <p>
        Run the E2E suite and results land here automatically.
        <br />
        From the test project root:
      </p>
      <p style={{ marginTop: 16 }}>
        <code>npm run test:regression</code>
        &nbsp;&nbsp;or&nbsp;&nbsp;
        <code>npm test</code>
      </p>
      <p className="muted" style={{ marginTop: 20, fontSize: 13 }}>
        The <b>DashboardReporter</b> writes <code>dashboard/public/data/history.json</code> when the
        run completes. This page polls it every few seconds — leave it open during a run.
      </p>
    </div>
  );
}
