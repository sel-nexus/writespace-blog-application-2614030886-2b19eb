/** Gate Admin-only pages using the browser-local role contract. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { isSession } from '../utils/ui';

/**
 * Reject guests and regular users before displaying Admin content.
 * Args:
 *   props (Object): Session from the route shell and Admin-only children.
 * Returns:
 *   JSX.Element: Guest login, regular-user blogs redirect, or Admin content.
 */
export default function AdminRoute({ session = null, children }) {
  if (!isSession(session)) return <Navigate to="/login" replace />;
  return session.role === 'admin' ? children : <Navigate to="/blogs" replace />;
}

AdminRoute.propTypes = { session: PropTypes.object, children: PropTypes.node.isRequired };
