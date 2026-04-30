// Content script entry. Injects a single floating capture button into every
// page via a shadow-DOM root so the host page's CSS cannot bleed in or out
// (CLAUDE.md §6.3 + AC). Idempotent — a second injection attempt for the
// same document (e.g. SPA navigation, dev HMR) is a no-op.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingButton } from './FloatingButton';
import contentCss from './inject.css?inline';

const HOST_ID = 'clipcv-floating-host';

function mount(): void {
  if (document.getElementById(HOST_ID) !== null) return;
  if (document.documentElement === null) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Reset host element styling so neighbouring page CSS cannot pull layout
  // tricks on the shadow boundary itself.
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.inset = 'auto';
  host.style.zIndex = '2147483647';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = contentCss;
  const mountPoint = document.createElement('div');
  shadow.append(styleEl, mountPoint);

  createRoot(mountPoint).render(
    <StrictMode>
      <FloatingButton />
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
} else {
  mount();
}
