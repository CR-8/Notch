import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LibraryApp from './App.tsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <LibraryApp />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
