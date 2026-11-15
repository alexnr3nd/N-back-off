import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

class StartupErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[OfflineApp] Startup render failed', error, info); }
  render() {
    if (this.state.error) return <main style={{ minHeight: '100vh', padding: 24, background: '#0d0b09', color: '#fff', fontFamily: 'sans-serif', overflowWrap: 'anywhere' }}>
      <h2>Falha ao iniciar o Dual N-Back</h2><p>O aplicativo encontrou um erro ao abrir. Envie esta mensagem para corrigirmos:</p>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#ffb4a9' }}>{String(this.state.error?.stack || this.state.error)}</pre>
    </main>;
    return this.props.children;
  }
}

window.addEventListener('error', event => {
  console.error('[OfflineApp] Uncaught error', event.error || event.message);
});
window.addEventListener('unhandledrejection', event => {
  console.error('[OfflineApp] Unhandled promise rejection', event.reason);
});

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<StartupErrorBoundary><App /></StartupErrorBoundary>);
