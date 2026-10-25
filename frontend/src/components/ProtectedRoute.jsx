/** Gate authenticated routes without performing account mutations. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { isSession } from '../utils/ui';

/**
 * Show completed page content only for a valid local identity.
 * Args:
 *   props (Object): Session from the route shell and protected children.
 * Returns:
 *   JSX.Element: Children or a replacing guest redirect.
 */
export default function ProtectedRoute({ session = null, children }) {
  return isSession(session) ? children : <Navigate to="/login" replace />;
}

ProtectedRoute.propTypes = { session: PropTypes.object, children: PropTypes.node.isRequired };
