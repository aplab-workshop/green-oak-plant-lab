import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { startConnection } from './store/wsClient';
import { startRunLogUploader } from './store/runLogUploader';

// W8 (SPEC § 4.45): ?admin = หน้าครู — ไม่ต่อ Lab/ไม่โหลดฉาก 3D
const ADMIN = new URLSearchParams(window.location.search).has('admin');
const AdminApp = lazy(() => import('./admin/AdminApp'));

if (!ADMIN) {
  startConnection();
  startRunLogUploader();
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    {ADMIN ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
