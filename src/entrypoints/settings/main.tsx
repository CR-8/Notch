import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import SettingsApp from './App';
import '../../assets/globals.css';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <ToastProvider>
        <SettingsApp />
      </ToastProvider>
    </ErrorBoundary>,
  );
}
