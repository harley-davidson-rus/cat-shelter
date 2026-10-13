import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CatGameDemo = lazy(() => import('./components/CatGameDemo').then((module) => ({ default: module.CatGameDemo })));

document.getElementById('seo-prerender')?.remove();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/cat-game-demo' ? (
      <Suspense fallback={<div className="min-h-screen bg-amber-50" />}>
        <CatGameDemo />
      </Suspense>
    ) : <App />}
  </StrictMode>,
);
