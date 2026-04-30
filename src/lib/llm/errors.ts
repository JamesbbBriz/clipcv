// Typed Error subclasses for the BYOK Vision LLM client. Callers
// pattern-match via `instanceof` to render user-friendly toasts in
// US-011 and to drive retry/UX branching in US-008's extraction
// pipeline. The thrown messages are pre-scrubbed of secret-shaped
// substrings (see scrub-secrets.ts), so they are safe to display.

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export class AuthError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class TimeoutError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RateLimitedError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

export class BadRequestError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnknownLlmError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownLlmError';
  }
}
