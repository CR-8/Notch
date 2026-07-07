import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import WelcomeApp from './App';
import './style.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <WelcomeApp />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
