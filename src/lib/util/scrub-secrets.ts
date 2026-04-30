// Mask anything that looks like a user-provided API key before surfacing
// strings to UI / logs. CLAUDE.md §6.2 requires this on every user-facing
// error path.

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9]{16,}/g,
  /Bearer\s+[A-Za-z0-9._-]{20,}/g,
];

export function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}
