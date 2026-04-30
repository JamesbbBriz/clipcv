import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import './options.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('clipcv options: #root container missing from options.html');
}

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
