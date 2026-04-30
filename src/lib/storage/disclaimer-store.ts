// Disclaimer acceptance gate. The modal that writes this record lives in the
// popup (US-012); US-004's content script reads it to decide whether the
// floating button is visible. Keying on manifest.version means a version bump
// invalidates prior acceptance and re-shows the modal.

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

export async function saveDisclaimerAcceptance(
  version: string,
  now: Date = new Date(),
): Promise<void> {
  const record: DisclaimerAcceptance = {
    accepted: true,
    version,
    acceptedAt: now.toISOString(),
  };
  await chrome.storage.local.set({ [DISCLAIMER_KEY]: record });
}

export async function clearDisclaimerAcceptance(): Promise<void> {
  await chrome.storage.local.remove(DISCLAIMER_KEY);
}
