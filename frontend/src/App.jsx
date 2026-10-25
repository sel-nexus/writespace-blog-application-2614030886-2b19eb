/** Compose completed discovery, account-entry, reading, writing, and Admin post routes with local identity reads. */
import { Routes, Route, useLocation } from 'react-router-dom';
import PublicNavbar from './components/PublicNavbar';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFound from './pages/NotFound';
import { getSession } from './utils/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import AdminRoute from './components/AdminRoute';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';

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
        <Route
          path="/blogs"
          element={<ProtectedRoute session={session}><Home session={session} /></ProtectedRoute>}
        />
        <Route
          path="/blog/:id"
          element={<ProtectedRoute session={session}><ReadBlog session={session} /></ProtectedRoute>}
        />
        <Route
          path="/write"
          element={<ProtectedRoute session={session}><WriteBlog session={session} /></ProtectedRoute>}
        />
        <Route
          path="/edit/:id"
          element={<ProtectedRoute session={session}><WriteBlog session={session} /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={
            <AdminRoute session={session}>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute session={session}>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
