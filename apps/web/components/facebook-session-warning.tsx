interface FacebookSessionWarningProps {
  show: boolean;
}

export function FacebookSessionWarning({ show }: FacebookSessionWarningProps) {
  if (!show) {
    return null;
  }

  return (
    <section
      className="mb-10 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
      role="alert"
    >
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Facebook session needs refresh
      </h2>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
        Recent polls failed because the worker lost its Facebook login. This usually happens every
        few weeks on Render.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-100/90">
        <li>On your PC, run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">npm run save:facebook-session</code> and sign in to Facebook.</li>
        <li>Open Render → worker service → Environment → Secret Files.</li>
        <li>
          Replace <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">/etc/secrets/facebook-storage-state.json</code>{" "}
          with the new file contents.
        </li>
        <li>Redeploy the worker, then click Poll now again.</li>
      </ol>
      <p className="mt-3 text-sm">
        <a
          href="https://github.com/hudsonferraz/price-monitor/blob/main/docs/render-deploy.md#step-4--upload-facebook-session-secret-file"
          className="font-medium text-amber-900 underline dark:text-amber-200"
          target="_blank"
          rel="noreferrer"
        >
          Full walkthrough in render-deploy.md
        </a>
      </p>
    </section>
  );
}
