import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

// Lazy, matching every other routed page in AppRouter.jsx — the marketing
// page's bundle only loads for visitors who actually hit the public root,
// never bloating the authenticated app's initial chunk.
const Landing = lazy(() => import('../pages/landing/Landing'));

// The public root. Mirrors ProtectedRoute.jsx's isAuthenticated/initializing
// read exactly — logged-out visitors see the marketing Landing page,
// logged-in visitors are sent straight to their dashboard.
function HomeGate() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Landing />;
}

export default HomeGate;
