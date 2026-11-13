import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-mono/latin-400.css';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('The application root element is missing.');
}

// Scroll reveals hide content first, so opt in only when motion is welcome.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('has-reveal');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
