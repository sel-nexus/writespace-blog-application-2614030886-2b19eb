/** Compose completed discovery and account-entry routes with local identity reads. */
import { Routes, Route, useLocation } from 'react-router-dom';
import PublicNavbar from './components/PublicNavbar';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFound from './pages/NotFound';
import { getSession } from './utils/auth';

/**
 * Render discovery and a safe fallback with route-driven identity reads.
 * Returns:
 *   JSX.Element: Public shell and implemented route content.
 * Notes:
 *   Navigation causes a fresh storage read; render never writes or navigates.
 */
export default function App() {
  const { pathname } = useLocation();
  const session = getSession();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {session && pathname !== '/' ? <Navbar session={session} /> : <PublicNavbar session={session} />}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route path="/register" element={<RegisterPage session={session} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
