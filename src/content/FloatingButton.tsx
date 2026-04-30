import { useEffect, useRef, useState } from 'react';
import { isDisclaimerAccepted } from '@/lib/storage/disclaimer-store';
import {
  PipelineError,
  runPipeline,
  type PipelineStage,
} from '@/lib/pipeline/run-pipeline';
import { pipelineUserMessage } from '@/lib/pipeline/user-messages';
import { requestCapture } from './capture';

const EXTENSION_VERSION = chrome.runtime.getManifest().version;

type Phase = 'idle' | 'capturing' | PipelineStage;
type ToastKind = 'success' | 'error';
interface Toast {
  kind: ToastKind;
  text: string;
}

const ACTIVE_PHASES: ReadonlySet<Phase> = new Set([
  'capturing',
  'extracting',
  'rendering',
  'downloading',
]);
const TOAST_AUTO_DISMISS_MS = 4000;

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'capturing':
      return 'Capturing…';
    case 'extracting':
      return 'Reading page…';
    case 'rendering':
      return 'Building file…';
    case 'downloading':
      return 'Saving…';
    case 'done':
    case 'idle':
      return 'Capture this page';
  }
}

export function FloatingButton(): JSX.Element | null {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [toast, setToast] = useState<Toast | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await isDisclaimerAccepted(EXTENSION_VERSION);
      if (!cancelled) setAccepted(ok);
    })();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ): void => {
      if (area !== 'local' || !changes['disclaimer_acceptance']) return;
      void (async () => {
        const ok = await isDisclaimerAccepted(EXTENSION_VERSION);
        if (!cancelled) setAccepted(ok);
      })();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  if (accepted !== true) return null;

  function showToast(next: Toast): void {
    setToast(next);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_AUTO_DISMISS_MS);
  }

  async function handleClick(): Promise<void> {
    if (ACTIVE_PHASES.has(phase)) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('capturing');
    setToast(null);
    try {
      const payload = await requestCapture();
      if (ctrl.signal.aborted) {
        showToast({ kind: 'error', text: pipelineUserMessage('CANCELLED') });
        return;
      }
      const result = await runPipeline({
        payload,
        signal: ctrl.signal,
        onStage: (s) => setPhase(s),
      });
      const count = result.filenames.length;
      showToast({
        kind: 'success',
        text:
          count === 1
            ? `Saved ${result.filenames[0] ?? 'file'}.`
            : `Saved ${count} files.`,
      });
    } catch (err) {
      const code =
        err instanceof PipelineError
          ? err.code
          : err instanceof Error && err.message.toLowerCase().includes('cancel')
            ? 'CANCELLED'
            : 'UNKNOWN_LLM';
      showToast({ kind: 'error', text: pipelineUserMessage(code) });
    } finally {
      abortRef.current = null;
      setPhase('idle');
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  const isActive = ACTIVE_PHASES.has(phase);
  const label = phaseLabel(phase);

  return (
    <div className="fixed right-4 bottom-4 z-[2147483647] flex flex-col items-end gap-2">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={
            toast.kind === 'success'
              ? 'max-w-xs rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow-lg'
              : 'max-w-xs rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 shadow-lg'
          }
        >
          {toast.text}
        </div>
      )}
      <div className="flex items-center gap-2">
        {isActive && (
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel capture"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleClick()}
          aria-label="Capture this page with clipcv"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-lg hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isActive}
        >
          {isActive ? (
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-slate-900"
            />
          )}
          {label}
        </button>
      </div>
    </div>
  );
}
