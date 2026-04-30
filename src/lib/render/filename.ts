// Output filename formatter for clipped profiles.
//
// Pattern per CLAUDE.md §11: `{Name_or_Unknown}_{YYYYMMDD}.{ext}`.
// `Name` is sanitized per §10.1: drop `/`, `\`, `:`, `..`, control
// chars; cap to 64 chars; default to `Unknown` if empty after
// sanitization. For multi-token names we render `Last_First` so
// alphabetical sorting in the user's filesystem groups by surname.

const FILENAME_MAX = 64;
const FILENAME_FORBIDDEN = '/\\:*?"<>|';

export type RenderExt = 'pdf' | 'docx';

export function formatFilename(
  name: string | undefined,
  now: Date,
  ext: RenderExt,
): string {
  return `${sanitizeNameForFilename(name)}_${formatYyyymmdd(now)}.${ext}`;
}

export function formatYyyymmdd(now: Date): string {
  const y = now.getFullYear().toString().padStart(4, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

function sanitizeNameForFilename(name: string | undefined): string {
  if (!name) return 'Unknown';
  const tokens = name.trim().split(/\s+/).filter((t) => t.length > 0);
  let candidate: string;
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1] ?? '';
    const first = tokens[0] ?? '';
    candidate = `${last}_${first}`;
  } else {
    candidate = tokens[0] ?? '';
  }
  let stripped = '';
  for (const ch of candidate) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) continue;
    if (FILENAME_FORBIDDEN.includes(ch)) continue;
    stripped += ch;
  }
  const cleaned = stripped.replace(/\.\./g, '').slice(0, FILENAME_MAX);
  return cleaned.length > 0 ? cleaned : 'Unknown';
}
