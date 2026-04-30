import { useState } from 'react';
import { saveDisclaimerAcceptance } from '@/lib/storage/disclaimer-store';
import disclaimerMd from '../../DISCLAIMER.md?raw';

export const DISCLAIMER_TEXT = disclaimerMd;

interface DisclaimerModalProps {
  version: string;
}

export function DisclaimerModal({ version }: DisclaimerModalProps): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await saveDisclaimerAcceptance(version);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.';
      setError(message);
      setSaving(false);
    }
  }

  return (
    <main className="flex h-[600px] w-[480px] flex-col bg-white text-slate-900">
      <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight">clipcv disclaimer</h1>
        <span className="text-xs text-slate-500">v{version}</span>
      </header>

      <div
        role="document"
        className="flex-1 overflow-y-auto px-4 py-3"
        data-testid="disclaimer-text"
      >
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
{DISCLAIMER_TEXT}
        </pre>
      </div>

      <footer className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3">
        {error !== null && (
          <p
            role="alert"
            className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          Click I accept to record your acceptance locally and unlock the capture button.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? 'Saving…' : 'I accept'}
          </button>
        </div>
      </footer>
    </main>
  );
}
