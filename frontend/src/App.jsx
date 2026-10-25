/** Compose only completed discovery routes and read the local demo identity. */
import { Routes, Route, useLocation } from 'react-router-dom';
import PublicNavbar from './components/PublicNavbar';
import LandingPage from './pages/LandingPage';
import NotFound from './pages/NotFound';
import { isSession } from './utils/ui';

/**
 * Decode a session defensively without writing or repairing browser data.
 * Returns:
 *   Object|null: A valid demo session or null for missing or unusable storage.
 * Notes:
 *   Discovery owns this temporary read until the account-entry auth utility exists.
 */
function readDiscoverySession() {
  try {
    const value = JSON.parse(localStorage.getItem('writespace_session'));
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Render discovery and a safe fallback with route-driven identity reads.
 * Returns:
 *   JSX.Element: Public shell and implemented route content.
 * Notes:
 *   Navigation causes a fresh storage read; render never writes or navigates.
 */
export default function App() {
  useLocation();
  const session = readDiscoverySession();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <PublicNavbar session={session} />
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
