
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
} catch (e) {
  console.error('[DEBUG_START] Error during React mounting:', e);
}
