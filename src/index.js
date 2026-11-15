import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
