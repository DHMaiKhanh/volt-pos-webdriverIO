import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme.css';

// Apply the saved theme before first paint so there is no light→dark flash.
const saved = localStorage.getItem('volt-dashboard-theme');
if (saved === 'light' || saved === 'dark') {
  document.documentElement.dataset.theme = saved;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
