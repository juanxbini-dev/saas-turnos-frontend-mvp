import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('unhandledrejection', (event) => {
  window.dispatchEvent(new CustomEvent('app:error', {
    detail: {
      requestId: null,
      status: null,
      message: event.reason?.message || 'Error inesperado',
      url: window.location.pathname,
    },
  }));
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
