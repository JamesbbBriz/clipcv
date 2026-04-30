// User-facing strings keyed off PipelineErrorCode. Kept in a separate module
// so the toast UI in the floating button has a single import point and tests
// can pin every code → message pair without depending on the orchestrator's
// implementation. CLAUDE.md §6.4 — no copy here may direct the user toward
// any specific destination service / ATS / CRM / workflow.

import type { PipelineErrorCode } from './run-pipeline';

export function pipelineUserMessage(code: PipelineErrorCode): string {
  switch (code) {
    case 'SETTINGS_MISSING':
      return 'Open Settings to configure your LLM provider before capturing.';
    case 'AUTH':
      return 'Authentication failed. Check your API key in Settings.';
    case 'TIMEOUT':
      return 'The request timed out. Try again or pick a faster model.';
    case 'NO_PROFILE_DETECTED':
      return 'This page does not appear to contain a person profile.';
    case 'SCHEMA_MISMATCH':
      return 'The model returned an unexpected response. Try again.';
    case 'UNKNOWN_LLM':
      return 'The LLM call failed. Try again in a moment.';
    case 'RENDER_FAILED':
      return 'The file could not be rendered. Try again.';
    case 'DOWNLOAD_FAILED':
      return 'The download could not be started.';
    case 'CANCELLED':
      return 'Capture cancelled.';
  }
}
