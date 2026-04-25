
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

console.log('[DEBUG_START] Index.tsx initializing...');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[DEBUG_START] CRITICAL: Root element not found in DOM');
  throw new Error("Could not find root element to mount to");
} else {
  console.log('[DEBUG_START] Root element found:', rootElement);
}

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('[DEBUG_START] React Root created, rendering App...');
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('[DEBUG_START] Render command sent');

  // Registro do Service Worker para PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] ServiceWorker registrado com sucesso:', registration.scope);
        })
        .catch((error) => {
          console.log('[PWA] Falha ao registrar ServiceWorker:', error);
        });
    });
  }
} catch (e) {
  console.error('[DEBUG_START] Error during React mounting:', e);
}
