import React from 'react';
import ReactDOM from 'react-dom/client';
import LibraryApp from './App.tsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LibraryApp />
  </React.StrictMode>,
);
