import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/components/ui/toast';
import SettingsApp from './App';
import '../../assets/globals.css';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <ToastProvider>
      <SettingsApp />
    </ToastProvider>
  );
}