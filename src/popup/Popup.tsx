export function Popup(): JSX.Element {
  return (
    <main className="flex w-72 flex-col gap-3 bg-white p-4 font-sans text-slate-900">
      <header className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold tracking-tight">clipcv</h1>
        <span className="text-xs text-slate-500">v0.1.0</span>
      </header>

      <p className="text-xs leading-snug text-slate-600">
        Convert the page you are viewing into a clean PDF or DOCX file using your own Vision LLM API key.
      </p>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Capture is wired up in a later iteration."
        className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400"
      >
        Capture this page
      </button>

      <p className="text-[11px] text-slate-400">
        Set up your API key in Settings before the first capture.
      </p>
    </main>
  );
}
