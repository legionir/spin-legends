import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import { soundEngine } from './audio/soundEngine.ts';
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
