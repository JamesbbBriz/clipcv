// Disclaimer acceptance gate. US-012 lands the modal that writes this record;
// US-004's content script reads it to decide whether the floating button is
// visible. Keying on manifest.version means a version bump invalidates prior
// acceptance and re-shows the modal (per US-012 AC).

export const DISCLAIMER_KEY = 'disclaimer_acceptance';

export interface DisclaimerAcceptance {
  accepted: boolean;
  version: string;
  acceptedAt: string;
}

export async function loadDisclaimerAcceptance(): Promise<DisclaimerAcceptance | null> {
  const raw = await chrome.storage.local.get(DISCLAIMER_KEY);
  const stored = raw[DISCLAIMER_KEY] as DisclaimerAcceptance | undefined;
  return stored ?? null;
}

export async function isDisclaimerAccepted(currentVersion: string): Promise<boolean> {
  const stored = await loadDisclaimerAcceptance();
  return stored?.accepted === true && stored.version === currentVersion;
}
