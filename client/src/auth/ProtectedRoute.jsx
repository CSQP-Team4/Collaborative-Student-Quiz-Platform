import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { homeFor } from './roles';

// Client-side guard for role pages. The API enforces RBAC for real
// (CSQP-F-003 / SR-004); this only keeps users on screens they can use.
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <p className="page-status" role="status">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return children;
}
