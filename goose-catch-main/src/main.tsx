import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './style.css'
import { inject } from '@vercel/analytics';
import { SpeedInsights } from '@vercel/speed-insights/react';
inject();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    
    <App />
    <SpeedInsights />
    
  </StrictMode>,
)
