import { useEffect, useState, type FormEvent } from 'react';
import {
  loadByok,
  saveByok,
  type ByokSettings,
  type OutputFormat,
  type Provider,
} from '@/lib/storage/byok-store';
import {
  testConnection,
  type TestErrorCode,
  type TestResult,
} from '@/lib/llm/test-connection';
import { clearDisclaimerAcceptance } from '@/lib/storage/disclaimer-store';
import { scrubSecrets } from '@/lib/util/scrub-secrets';

interface ProviderPreset {
  id: Provider;
  label: string;
  baseUrl: string;
  modelHint: string;
}

const PRESETS: readonly ProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelHint: 'gpt-4o' },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'openai/gpt-4o',
  },
  { id: 'custom', label: 'OpenAI-compatible custom', baseUrl: '', modelHint: '' },
];

const OUTPUTS: readonly { id: OutputFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'both', label: 'Both' },
];

const DEFAULT_SETTINGS: ByokSettings = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  output: 'pdf',
};

const ERROR_LABELS: Record<TestErrorCode, string> = {
  auth_failed: 'Authentication failed — check API key.',
  timeout: 'Request timed out.',
  model_not_found: 'Model not found at this base URL.',
  bad_request: 'Bad request — check base URL and model name.',
  rate_limited: 'Rate limited by provider.',
  unknown: 'Unknown error.',
};

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'testing' }
  | { kind: 'tested'; result: TestResult }
  | { kind: 'error'; message: string };

type RevokeStatus =
  | { kind: 'idle' }
  | { kind: 'revoking' }
  | { kind: 'revoked' }
  | { kind: 'error'; message: string };

export function Options(): JSX.Element {
  const [settings, setSettings] = useState<ByokSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [revokeStatus, setRevokeStatus] = useState<RevokeStatus>({ kind: 'idle' });

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadByok();
        if (stored) {
          setSettings(stored.settings);
          setApiKey(stored.apiKey);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load settings.';
        setStatus({ kind: 'error', message: scrubSecrets(message) });
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function update<K extends keyof ByokSettings>(field: K, value: ByokSettings[K]): void {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
  }

  function applyProvider(id: Provider): void {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSettings((prev) => {
      if (id === 'custom') return { ...prev, provider: id };
      return {
        ...prev,
        provider: id,
        baseUrl: preset.baseUrl,
        model: prev.model.trim().length === 0 ? preset.modelHint : prev.model,
      };
    });
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
  }

  function validate(): string | null {
    if (apiKey.trim().length === 0) return 'API key is required.';
    if (!isValidHttpUrl(settings.baseUrl)) return 'Base URL must be a valid http(s) URL.';
    if (settings.model.trim().length === 0) return 'Model is required.';
    return null;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const err = validate();
    if (err) {
      setStatus({ kind: 'error', message: err });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await saveByok(settings, apiKey);
      setStatus({ kind: 'saved' });
    } catch (err2) {
      const m = err2 instanceof Error ? err2.message : 'Save failed.';
      setStatus({ kind: 'error', message: scrubSecrets(m) });
    }
  }

  async function handleTest(): Promise<void> {
    const err = validate();
    if (err) {
      setStatus({ kind: 'error', message: err });
      return;
    }
    setStatus({ kind: 'testing' });
    const result = await testConnection({
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey,
    });
    setStatus({ kind: 'tested', result });
  }

  async function handleRevoke(): Promise<void> {
    setRevokeStatus({ kind: 'revoking' });
    try {
      await clearDisclaimerAcceptance();
      setRevokeStatus({ kind: 'revoked' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Revoke failed.';
      setRevokeStatus({ kind: 'error', message: scrubSecrets(message) });
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8 text-slate-900">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">clipcv settings</h1>
        <span className="text-xs text-slate-500">BYOK · stored locally</span>
      </header>

      <p className="text-sm leading-snug text-slate-600">
        Provide your own Vision LLM API key. Your key is encrypted at rest in this browser
        with AES-GCM and never leaves your machine to a clipcv-controlled server.
      </p>

      <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2" disabled={!loaded}>
          <label className="text-sm font-medium" htmlFor="provider">
            Provider
          </label>
          <select
            id="provider"
            value={settings.provider}
            onChange={(e) => applyProvider(e.target.value as Provider)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-2" disabled={!loaded}>
          <label className="text-sm font-medium" htmlFor="baseUrl">
            Base URL
          </label>
          <input
            id="baseUrl"
            type="url"
            inputMode="url"
            placeholder="https://api.example.com/v1"
            value={settings.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2" disabled={!loaded}>
          <label className="text-sm font-medium" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            type="text"
            placeholder="gpt-4o"
            value={settings.model}
            onChange={(e) => update('model', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2" disabled={!loaded}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="apiKey">
              API key
            </label>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="text-xs text-slate-500 underline-offset-2 hover:underline"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="apiKey"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
            required
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2" disabled={!loaded}>
          <span className="text-sm font-medium">Default output format</span>
          <div className="flex gap-4 text-sm">
            {OUTPUTS.map((o) => (
              <label key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="output"
                  value={o.id}
                  checked={settings.output === o.id}
                  onChange={() => update('output', o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={!loaded || status.kind === 'saving'}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {status.kind === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={!loaded || status.kind === 'testing'}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {status.kind === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
        </div>

        <StatusBanner status={status} />
      </form>

      <section className="flex flex-col gap-2 border-t border-slate-200 pt-5">
        <h2 className="text-sm font-semibold tracking-tight">Disclaimer</h2>
        <p className="text-xs leading-snug text-slate-600">
          You accepted the clipcv disclaimer when you first opened the popup. You can revoke
          your acceptance below; the popup will re-show the disclaimer the next time you open it
          and the floating Capture button will hide until you accept again.
        </p>
        <div>
          <button
            type="button"
            onClick={() => void handleRevoke()}
            disabled={revokeStatus.kind === 'revoking'}
            className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
          >
            {revokeStatus.kind === 'revoking' ? 'Revoking…' : 'Revoke disclaimer acceptance'}
          </button>
        </div>
        <RevokeBanner status={revokeStatus} />
      </section>
    </main>
  );
}

function RevokeBanner({ status }: { status: RevokeStatus }): JSX.Element | null {
  if (status.kind === 'idle' || status.kind === 'revoking') return null;
  if (status.kind === 'revoked') {
    return (
      <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Disclaimer acceptance cleared. Open the popup to re-accept.
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {status.message}
    </p>
  );
}

function StatusBanner({ status }: { status: Status }): JSX.Element | null {
  if (status.kind === 'idle' || status.kind === 'saving' || status.kind === 'testing') {
    return null;
  }
  if (status.kind === 'saved') {
    return (
      <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Saved.
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {status.message}
      </p>
    );
  }
  const result = status.result;
  if (result.ok) {
    return (
      <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Connection OK · {result.latencyMs} ms
      </p>
    );
  }
  return (
    <div role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <p className="font-medium">{ERROR_LABELS[result.code]}</p>
      {result.detail.length > 0 && (
        <p className="mt-1 break-words font-mono text-xs text-rose-600">{result.detail}</p>
      )}
    </div>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
