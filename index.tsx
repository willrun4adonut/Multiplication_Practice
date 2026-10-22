import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Safely stub Playground global environment variables
if (typeof window !== 'undefined') {
  (window as any).playground = (window as any).playground || {
    onReady: (cb: () => void) => cb(),
    getState: () => ({}),
    setState: () => {},
  };
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
