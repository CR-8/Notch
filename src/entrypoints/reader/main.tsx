import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@/components/ui/toast';
import ReaderApp from './App.tsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ReaderApp />
    </ToastProvider>
  </React.StrictMode>,
);
