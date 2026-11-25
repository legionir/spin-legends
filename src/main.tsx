import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import { soundEngine } from './audio/soundEngine.ts';
// Fonts are bundled (no Google Fonts request): latin subsets, only the weights in use.
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/chakra-petch/latin-700-italic.css';
import '@fontsource/exo-2/latin-500.css';
import '@fontsource/exo-2/latin-600.css';
import '@fontsource/exo-2/latin-700.css';
import '@fontsource/exo-2/latin-800.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('sl-sw-update'));
    },
  });
}

// iOS Safari requires WebAudio unlock inside touchend / pointerup user gestures
const handleFirstAudioGesture = () => {
  soundEngine.unlock();
};
window.addEventListener('touchend', handleFirstAudioGesture, { passive: true });
window.addEventListener('pointerup', handleFirstAudioGesture, { passive: true });

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
